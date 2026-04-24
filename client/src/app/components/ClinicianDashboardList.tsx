/* eslint-disable react-hooks/incompatible-library */
import { Search, ChevronLeft, Plus, Phone } from "lucide-react";
import { useNavigate } from "react-router";
import { useVirtualizer } from "@tanstack/react-virtual";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../../lib/supabase";
import { PatientForm } from "./PatientForm";

interface PatientRow {
  id: string;
  full_name: string;
  phone: string;
  date_of_birth: string | null;
  created_at: string;
  tests: number;
  completed: number;
  lastActive: string | null;
  latestScore: number | null;
  needsReview: boolean;
  status: "new" | "in_progress" | "review" | "completed";
}

interface PatientWithSessions {
  id: string;
  full_name: string;
  phone: string;
  date_of_birth: string | null;
  created_at: string;
  sessions:
    | {
        id: string;
        status: "pending" | "in_progress" | "completed" | "awaiting_review";
        created_at: string;
        scoring_reports: { total_score: number | null; needs_review: boolean }[] | null;
      }[]
    | null;
}

function deriveStatus(sessions: PatientWithSessions["sessions"]): PatientRow["status"] {
  if (!sessions || sessions.length === 0) return "new";
  if (sessions.some((s) => s.scoring_reports?.some((r) => r.needs_review))) return "review";
  if (sessions.some((s) => s.status === "in_progress")) return "in_progress";
  if (sessions.every((s) => s.status === "completed")) return "completed";
  return "new";
}

function latestOf<T>(arr: T[] | null | undefined, key: (v: T) => string | null): string | null {
  if (!arr || arr.length === 0) return null;
  const times = arr.map(key).filter((v): v is string => Boolean(v));
  if (times.length === 0) return null;
  return times.sort().slice(-1)[0];
}

function ageFromDob(dob: string | null): number | null {
  if (!dob) return null;
  const d = new Date(dob);
  if (Number.isNaN(d.getTime())) return null;
  return Math.floor((Date.now() - d.getTime()) / (365.25 * 24 * 60 * 60 * 1000));
}

export function ClinicianDashboardList() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [rows, setRows] = useState<PatientRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);

  const loadPatients = useCallback(async () => {
    setLoading(true);
    const { data: authData } = await supabase.auth.getSession();
    const session = authData.session;
    if (!session) {
      setRows([]);
      setLoading(false);
      return;
    }

    const { data, error } = await supabase
      .from("patients")
      .select(
        "id, full_name, phone, date_of_birth, created_at, sessions(id, status, created_at, scoring_reports(total_score, needs_review))",
      )
      .eq("clinician_id", session.user.id)
      .order("created_at", { ascending: false });

    if (error || !data) {
      console.error("Failed to fetch patients", error);
      setRows([]);
      setLoading(false);
      return;
    }

    const mapped: PatientRow[] = (data as PatientWithSessions[]).map((p) => {
      const sessions = p.sessions ?? [];
      const completed = sessions.filter((s) => s.status === "completed").length;
      const latestSession = latestOf(sessions, (s) => s.created_at);
      const latestScore =
        sessions
          .flatMap((s) => s.scoring_reports ?? [])
          .filter((r) => r?.total_score != null)
          .map((r) => r!.total_score!)
          .sort((a, b) => b - a)[0] ?? null;
      const needsReview = sessions.some((s) => s.scoring_reports?.some((r) => r.needs_review));
      return {
        id: p.id,
        full_name: p.full_name,
        phone: p.phone,
        date_of_birth: p.date_of_birth,
        created_at: p.created_at,
        tests: sessions.length,
        completed,
        lastActive: latestSession ?? p.created_at,
        latestScore,
        needsReview,
        status: deriveStatus(sessions),
      };
    });

    setRows(mapped);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadPatients();
  }, [loadPatients]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (r) => r.full_name.toLowerCase().includes(q) || r.phone.includes(q) || r.id.toLowerCase().includes(q),
    );
  }, [rows, search]);

  const parentRef = useRef<HTMLDivElement>(null);
  const rowVirtualizer = useVirtualizer({
    count: Math.max(filtered.length, 1),
    getScrollElement: () => parentRef.current,
    estimateSize: () => 88,
    overscan: 5,
  });

  const handleCsvExport = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      alert("יש להתחבר כקלינאי כדי לייצא CSV.");
      return;
    }

    try {
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/export-csv`, {
        method: "POST",
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (!res.ok) throw new Error("Export failed");

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "moca_export.csv";
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      a.remove();
    } catch (e) {
      console.error(e);
      alert("ייצוא CSV נכשל.");
    }
  };

  const totalPatients = rows.length;
  const reviewCount = rows.filter((r) => r.status === "review").length;
  const completedCount = rows.filter((r) => r.status === "completed").length;
  const avgScore = (() => {
    const scores = rows.map((r) => r.latestScore).filter((v): v is number => v != null);
    if (scores.length === 0) return "—";
    return (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1);
  })();

  return (
    <div className="max-w-6xl mx-auto h-[calc(100vh-56px)] flex flex-col">
      <div className="flex items-center justify-between mb-8 shrink-0">
        <div>
          <h1 className="text-4xl font-extrabold text-black mb-2">מטופלים</h1>
          <div className="text-gray-500 font-medium text-lg">
            {loading
              ? "טוען..."
              : `${totalPatients} מטופלים · ${reviewCount} דורשים סקירה`}
          </div>
        </div>
        <div className="flex items-center gap-4">
          <button
            onClick={handleCsvExport}
            className="flex items-center gap-2 bg-white text-black border border-gray-200 px-6 py-3 rounded-xl font-bold hover:bg-gray-50 transition-colors shadow-sm text-lg"
          >
            <span>ייצוא CSV</span>
          </button>

          <div className="relative">
            <Search className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="חיפוש לפי שם או טלפון…"
              className="pl-4 pr-12 py-3 bg-white border border-gray-200 rounded-xl w-80 text-lg shadow-sm focus:outline-none focus:ring-4 focus:ring-blue-600 focus:border-blue-600 transition-all"
            />
          </div>

          <button
            onClick={() => setFormOpen(true)}
            className="flex items-center gap-2 bg-black text-white px-6 py-3 rounded-xl font-bold hover:bg-gray-800 transition-colors shadow-md text-lg"
          >
            <Plus className="w-5 h-5" />
            <span>מטופל חדש</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-6 mb-8 shrink-0">
        {[
          { label: "סה״כ מטופלים", value: String(totalPatients), delta: "רשומים" },
          { label: "ציון MoCA ממוצע", value: avgScore, delta: "מבחנים עם ציון" },
          { label: "בדיקות הושלמו", value: String(completedCount), delta: "מטופלים שסיימו" },
          { label: "ממתינים לבדיקה", value: String(reviewCount), delta: "דורשים סקירה", warn: true },
        ].map((stat, i) => (
          <div key={i} className="bg-white border border-gray-200 p-6 rounded-2xl shadow-sm">
            <div className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-2">{stat.label}</div>
            <div className="flex items-end justify-between">
              <div className="text-4xl font-extrabold text-black tabular-nums">{stat.value}</div>
              <div
                className={`text-sm font-bold ${
                  stat.warn ? "text-red-600" : "text-green-600"
                } bg-gray-50 px-2 py-1 rounded-md`}
              >
                {stat.delta}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm flex-1 flex flex-col min-h-0">
        <div className="bg-gray-50 border-b border-gray-200 text-gray-500 text-sm uppercase tracking-wider font-bold shrink-0">
          <div className="flex text-right px-6 py-4">
            <div className="w-1/3 font-bold">שם</div>
            <div className="w-1/12 font-bold">גיל</div>
            <div className="w-1/12 font-bold">מבחנים</div>
            <div className="w-2/12 font-bold">פעילות אחרונה</div>
            <div className="w-2/12 font-bold">סטטוס</div>
            <div className="w-1/12 font-bold">ציון</div>
            <div className="w-1/12"></div>
          </div>
        </div>

        <div ref={parentRef} className="overflow-auto flex-1 relative">
          <div
            style={{
              height: `${rowVirtualizer.getTotalSize()}px`,
              width: "100%",
              position: "relative",
            }}
          >
            {filtered.length === 0 && !loading && (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-500 font-bold text-lg gap-2">
                <span>
                  {rows.length === 0
                    ? "עדיין לא נוספו מטופלים. התחילו על ידי לחיצה על \"מטופל חדש\"."
                    : "לא נמצאו מטופלים מתאימים לחיפוש."}
                </span>
              </div>
            )}

            {rowVirtualizer.getVirtualItems().map((virtualRow) => {
              const p = filtered[virtualRow.index];
              if (!p) return null;
              const age = ageFromDob(p.date_of_birth);
              return (
                <div
                  key={virtualRow.index}
                  onClick={() => navigate(`/dashboard/patient/${p.id}`)}
                  className="absolute top-0 left-0 w-full hover:bg-gray-50 transition-colors cursor-pointer group border-b border-gray-100 flex items-center text-right px-6"
                  style={{
                    height: `${virtualRow.size}px`,
                    transform: `translateY(${virtualRow.start}px)`,
                  }}
                >
                  <div className="w-1/3 flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-lg shrink-0">
                      {(p.full_name.trim()[0] || "מ").toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <div className="font-bold text-lg text-black truncate">{p.full_name}</div>
                      <div className="text-sm text-gray-500 font-mono flex items-center gap-1.5">
                        <Phone className="w-3 h-3" />
                        {p.phone}
                      </div>
                    </div>
                  </div>
                  <div className="w-1/12 text-gray-600 text-lg tabular-nums">{age ?? "-"}</div>
                  <div className="w-1/12 text-gray-600 text-lg tabular-nums">{p.tests}</div>
                  <div className="w-2/12 text-gray-600 text-lg tabular-nums">
                    {p.lastActive ? new Date(p.lastActive).toLocaleDateString("he-IL") : "—"}
                  </div>
                  <div className="w-2/12">
                    <span
                      className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-bold ${
                        p.status === "review"
                          ? "bg-amber-100 text-amber-800"
                          : p.status === "completed"
                          ? "bg-green-100 text-green-800"
                          : p.status === "in_progress"
                          ? "bg-blue-100 text-blue-800"
                          : "bg-gray-100 text-gray-700"
                      }`}
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-current" />
                      {p.status === "review"
                        ? "בבדיקה"
                        : p.status === "completed"
                        ? "הושלם"
                        : p.status === "in_progress"
                        ? "בתהליך"
                        : "חדש"}
                    </span>
                  </div>
                  <div className="w-1/12 font-extrabold text-xl text-black tabular-nums">
                    {p.latestScore != null ? `${p.latestScore}/30` : "—"}
                  </div>
                  <div className="w-1/12 text-left flex justify-end">
                    <div className="w-10 h-10 rounded-full flex items-center justify-center bg-transparent group-hover:bg-white border border-transparent group-hover:border-gray-200 group-hover:shadow-sm transition-all text-gray-400">
                      <ChevronLeft className="w-5 h-5" />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <PatientForm
        open={formOpen}
        onClose={() => setFormOpen(false)}
        onCreated={(patientId) => {
          setFormOpen(false);
          navigate(`/dashboard/patient/${patientId}`);
        }}
      />
    </div>
  );
}
