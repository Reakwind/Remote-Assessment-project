/* eslint-disable react-hooks/incompatible-library */
import { Search, ChevronLeft, Plus, Copy, CheckCircle2 } from "lucide-react";
import { useNavigate } from "react-router";
import { useVirtualizer } from "@tanstack/react-virtual";
import { useRef, useMemo, useState, useEffect } from "react";
import { supabase } from "../../lib/supabase";

interface DashboardRow {
  id: string;
  caseId: string;
  patientPhone: string | null;
  ageBand: "60-64" | "65-69" | "70-74" | "75-79" | "80+" | null;
  tests: number;
  lastActive: string;
  status: "review" | "new" | "completed";
  score: string;
  token: string;
}

interface SessionWithScores {
  id: string;
  case_id: string;
  patient_phone: string | null;
  age_band: "60-64" | "65-69" | "70-74" | "75-79" | "80+" | null;
  status: "pending" | "in_progress" | "completed" | "awaiting_review";
  created_at: string;
  link_token: string;
  scoring_reports: { total_score: number | null; needs_review: boolean }[] | null;
}

export function ClinicianDashboardList() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [rows, setRows] = useState<DashboardRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [copyState, setCopyState] = useState<string | null>(null);
  const [sessionCreated, setSessionCreated] = useState<{
    caseId: string;
    sessionUrl: string;
    smsSent: boolean;
    smsError: string | null;
  } | null>(null);
  const [newCaseId, setNewCaseId] = useState("");
  const [newAgeBand, setNewAgeBand] = useState("70-74");
  const [newEducationYears, setNewEducationYears] = useState("12");
  const [newPatientPhone, setNewPatientPhone] = useState("");
  const [createError, setCreateError] = useState<string | null>(null);

  const loadSessions = async () => {
    setLoading(true);
    const { data: authData } = await supabase.auth.getSession();
    const session = authData.session;
    if (!session) {
      setRows([]);
      setLoading(false);
      return;
    }

    const { data, error } = await supabase
      .from("sessions")
      .select("id, case_id, patient_phone, age_band, status, created_at, link_token, scoring_reports(total_score, needs_review)")
      .eq("clinician_id", session.user.id)
      .order("created_at", { ascending: false });

    if (error || !data) {
      console.error("Failed to fetch sessions", error);
      setRows([]);
      setLoading(false);
      return;
    }

    const mapped: DashboardRow[] = (data as SessionWithScores[]).map((s) => {
      const score = Array.isArray(s.scoring_reports) && s.scoring_reports[0]?.total_score != null
        ? `${s.scoring_reports[0].total_score}/30`
        : "-";
      const needsReview = Array.isArray(s.scoring_reports) && s.scoring_reports[0]?.needs_review;
      return {
        id: s.id,
        caseId: s.case_id,
        patientPhone: s.patient_phone ?? null,
        ageBand: s.age_band,
        tests: 1,
        lastActive: new Date(s.created_at).toLocaleDateString("he-IL"),
        status: needsReview ? "review" : s.status === "completed" ? "completed" : "new",
        score,
        token: s.link_token,
      };
    });

    setRows(mapped);
    setLoading(false);
  };

  useEffect(() => {
    loadSessions();
  }, []);
  
  const filteredPatients = useMemo(() => {
    return rows.filter((p) =>
      p.caseId.toLowerCase().includes(search.toLowerCase()) ||
      (p.patientPhone || "").includes(search),
    );
  }, [rows, search]);

  
  const handleCsvExport = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { alert("Not logged in"); return; }
    
    try {
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/export-csv`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${session.access_token}` }
      });
      
      if (!res.ok) throw new Error("Export failed");
      
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `moca_export.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (e) {
      console.error(e);
      alert("Failed to export CSV");
    }
  };

  const handleCreateSession = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError(null);
    setSessionCreated(null);

    if (!newCaseId.trim() || !newPatientPhone.trim()) {
      setCreateError("יש למלא מזהה מטופל ומספר טלפון.");
      return;
    }

    const educationYears = Number(newEducationYears);
    if (!Number.isFinite(educationYears) || educationYears < 0 || educationYears > 40) {
      setCreateError("שנות לימוד חייבות להיות בין 0 ל-40.");
      return;
    }

    const { data: authData } = await supabase.auth.getSession();
    const session = authData.session;
    if (!session) {
      setCreateError("נדרש להתחבר מחדש כקלינאי.");
      return;
    }

    setCreating(true);
    try {
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-session`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          caseId: newCaseId.trim(),
          ageBand: newAgeBand,
          educationYears,
          patientPhone: newPatientPhone.trim(),
        }),
      });

      const payload = await res.json();
      if (!res.ok) {
        throw new Error(payload?.error || "יצירת סשן נכשלה.");
      }

      setSessionCreated({
        caseId: newCaseId.trim(),
        sessionUrl: payload.sessionUrl,
        smsSent: Boolean(payload.smsSent),
        smsError: payload.smsError ?? null,
      });
      setNewCaseId("");
      setNewPatientPhone("");
      await loadSessions();
    } catch (error) {
      setCreateError(error instanceof Error ? error.message : "יצירת סשן נכשלה.");
    } finally {
      setCreating(false);
    }
  };

  const copyLink = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      setCopyState("הקישור הועתק");
      setTimeout(() => setCopyState(null), 2000);
    } catch {
      setCopyState("העתקה נכשלה");
      setTimeout(() => setCopyState(null), 2000);
    }
  };

  const parentRef = useRef<HTMLDivElement>(null);

  const rowVirtualizer = useVirtualizer({
    count: Math.max(filteredPatients.length, 1),
    getScrollElement: () => parentRef.current,
    estimateSize: () => 88, // estimated row height
    overscan: 5,
  });

  return (
    <div className="max-w-6xl mx-auto h-[calc(100vh-56px)] flex flex-col">
      <div className="flex items-center justify-between mb-8 shrink-0">
        <div>
          <h1 className="text-4xl font-extrabold text-black mb-2">מטופלים</h1>
          <div className="text-gray-500 font-medium text-lg">
            {loading ? "טוען..." : `${rows.length} פעילים · ${rows.filter((p) => p.status === "review").length} דורשים סקירה`}
          </div>
        </div>
        <div className="flex items-center gap-4">

          <button onClick={handleCsvExport} className="flex items-center gap-2 bg-white text-black border border-gray-200 px-6 py-3 rounded-xl font-bold hover:bg-gray-50 transition-colors shadow-sm text-lg">
            <span>ייצוא CSV</span>
          </button>

          <div className="relative">
            <Search className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input 
              type="text" 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="חיפוש לפי שם או מזהה…" 
              className="pl-4 pr-12 py-3 bg-white border border-gray-200 rounded-xl w-80 text-lg shadow-sm focus:outline-none focus:ring-4 focus:ring-blue-600 focus:border-blue-600 transition-all"
            />
          </div>
          <button
            onClick={() => setCreateOpen((v) => !v)}
            className="flex items-center gap-2 bg-black text-white px-6 py-3 rounded-xl font-bold hover:bg-gray-800 transition-colors shadow-md text-lg"
          >
            <Plus className="w-5 h-5" />
            <span>מטופל חדש</span>
          </button>
        </div>
      </div>

      {createOpen && (
        <div className="bg-white border border-gray-200 rounded-2xl shadow-sm p-6 mb-6">
          <h2 className="text-2xl font-extrabold text-black mb-4">פתיחת מבחן חדש ושליחת SMS</h2>
          <form onSubmit={handleCreateSession} className="grid grid-cols-12 gap-4">
            <input
              value={newCaseId}
              onChange={(e) => setNewCaseId(e.target.value)}
              placeholder="מזהה מטופל (Case ID)"
              className="col-span-3 h-12 px-4 border border-gray-300 rounded-xl focus:outline-none focus:ring-4 focus:ring-blue-600"
            />
            <input
              value={newPatientPhone}
              onChange={(e) => setNewPatientPhone(e.target.value)}
              placeholder="טלפון מטופל (+972...)"
              className="col-span-3 h-12 px-4 border border-gray-300 rounded-xl focus:outline-none focus:ring-4 focus:ring-blue-600"
            />
            <select
              value={newAgeBand}
              onChange={(e) => setNewAgeBand(e.target.value)}
              className="col-span-2 h-12 px-4 border border-gray-300 rounded-xl focus:outline-none focus:ring-4 focus:ring-blue-600 bg-white"
            >
              <option value="60-64">60-64</option>
              <option value="65-69">65-69</option>
              <option value="70-74">70-74</option>
              <option value="75-79">75-79</option>
              <option value="80+">80+</option>
            </select>
            <input
              value={newEducationYears}
              onChange={(e) => setNewEducationYears(e.target.value)}
              placeholder="שנות לימוד"
              className="col-span-2 h-12 px-4 border border-gray-300 rounded-xl focus:outline-none focus:ring-4 focus:ring-blue-600"
            />
            <button
              disabled={creating}
              className="col-span-2 h-12 rounded-xl bg-black text-white font-bold hover:bg-gray-800 disabled:opacity-60"
            >
              {creating ? "שולח..." : "צור ושלח"}
            </button>
          </form>

          {createError && (
            <div className="mt-4 bg-red-50 border border-red-200 text-red-700 rounded-xl p-3 font-bold">
              {createError}
            </div>
          )}

          {sessionCreated && (
            <div className="mt-4 bg-green-50 border border-green-200 text-green-700 rounded-xl p-4">
              <div className="font-extrabold mb-2">מבחן נוצר עבור {sessionCreated.caseId}</div>
              <div className="flex flex-wrap items-center gap-3 text-sm">
                <span className="font-bold">{sessionCreated.smsSent ? "SMS נשלח בהצלחה" : "SMS נכשל"}</span>
                {sessionCreated.smsError && <span className="text-red-700">{sessionCreated.smsError}</span>}
                <button
                  type="button"
                  onClick={() => copyLink(sessionCreated.sessionUrl)}
                  className="inline-flex items-center gap-2 px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-black font-bold"
                >
                  <Copy className="w-4 h-4" />
                  העתק קישור ידני
                </button>
                {copyState && (
                  <span className="inline-flex items-center gap-1 text-green-700 font-bold">
                    <CheckCircle2 className="w-4 h-4" />
                    {copyState}
                  </span>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-4 gap-6 mb-8 shrink-0">
          {[
          { label: "מבחנים השבוע", value: String(rows.length), delta: `${rows.filter((r) => r.status === "new").length} חדשים` },
          {
            label: "ציון MoCA ממוצע",
            value:
              rows.filter((r) => r.score !== "-").length > 0
                ? (
                    rows
                      .filter((r) => r.score !== "-")
                      .reduce((sum, r) => sum + Number(r.score.split("/")[0]), 0) /
                    rows.filter((r) => r.score !== "-").length
                  ).toFixed(1)
                : "—",
            delta: "מחושב מנתוני אמת",
          },
          { label: "בדיקות הושלמו", value: String(rows.filter((r) => r.status === "completed").length), delta: "כולל עם ציון" },
          { label: "ממתינים לבדיקה", value: String(rows.filter((r) => r.status === "review").length), delta: "דורשים סקירה", warn: true },
        ].map((stat, i) => (
          <div key={i} className="bg-white border border-gray-200 p-6 rounded-2xl shadow-sm">
            <div className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-2">{stat.label}</div>
            <div className="flex items-end justify-between">
              <div className="text-4xl font-extrabold text-black tabular-nums">{stat.value}</div>
              <div className={`text-sm font-bold ${stat.warn ? "text-red-600" : "text-green-600"} bg-gray-50 px-2 py-1 rounded-md`}>
                {stat.delta}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm flex-1 flex flex-col min-h-0">
        <div className="bg-gray-50 border-b border-gray-200 text-gray-500 text-sm uppercase tracking-wider font-bold shrink-0">
          <div className="flex text-right px-6 py-4">
            <div className="w-1/4 font-bold">שם</div>
            <div className="w-1/12 font-bold">גיל</div>
            <div className="w-1/12 font-bold">מבחנים</div>
            <div className="w-2/12 font-bold">פעילות אחרונה</div>
            <div className="w-2/12 font-bold">סטטוס</div>
            <div className="w-2/12 font-bold">ציון MoCA</div>
            <div className="w-1/12"></div>
          </div>
        </div>

        <div 
          ref={parentRef} 
          className="overflow-auto flex-1 relative"
        >
          <div 
            style={{
              height: `${rowVirtualizer.getTotalSize()}px`,
              width: '100%',
              position: 'relative',
            }}
          >
            {filteredPatients.length === 0 && (
              <div className="absolute inset-0 flex items-center justify-center text-gray-500 font-bold text-lg">
                לא נמצאו מטופלים מתאימים לחיפוש.
              </div>
            )}
            {rowVirtualizer.getVirtualItems().map((virtualRow) => {
              const p = filteredPatients[virtualRow.index];
              if (!p) return null;
              return (
                <div
                  key={virtualRow.index}
                  onClick={() => navigate(`/dashboard/${p.id}`)}
                  className="absolute top-0 left-0 w-full hover:bg-gray-50 transition-colors cursor-pointer group border-b border-gray-100 flex items-center text-right px-6"
                  style={{
                    height: `${virtualRow.size}px`,
                    transform: `translateY(${virtualRow.start}px)`,
                  }}
                >
                  <div className="w-1/4 flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-lg shrink-0">
                      {(p.caseId.charAt(0) || "מ").toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <div className="font-bold text-lg text-black truncate">מקרה {p.caseId}</div>
                      <div className="text-sm text-gray-500 font-mono">{p.id}</div>
                    </div>
                  </div>
                  <div className="w-1/12 text-gray-600 text-lg tabular-nums">{p.ageBand || "-"}</div>
                  <div className="w-1/12 text-gray-600 text-lg tabular-nums">{p.tests}</div>
                  <div className="w-2/12 text-gray-600 text-lg tabular-nums">{p.lastActive}</div>
                  <div className="w-2/12">
                    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-bold ${
                      p.status === 'review' ? 'bg-amber-100 text-amber-800' :
                      p.status === 'completed' ? 'bg-green-100 text-green-800' :
                      'bg-blue-100 text-blue-800'
                    }`}>
                      <span className="w-1.5 h-1.5 rounded-full bg-current" />
                      {p.status === 'review' ? 'בבדיקה' :
                       p.status === 'completed' ? 'הושלם' : 'חדש'}
                    </span>
                  </div>
                  <div className="w-2/12 font-extrabold text-xl text-black tabular-nums">{p.score}</div>
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
    </div>
  );
}
