import { useEffect, useMemo, useState } from "react";
import { Search, ChevronLeft, Plus, Download, RefreshCw, Copy, ExternalLink } from "lucide-react";
import { useNavigate } from "react-router";
import { supabase } from "../../lib/supabase";
import { callClinicianFunction } from "../../lib/api";
import type { DBScoringReport, MocaVersion, Session } from "../../types/database";

type SessionRow = Session & {
  scoring_reports?: DBScoringReport[] | DBScoringReport | null;
};

export function ClinicianDashboardList() {
  const navigate = useNavigate();
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [lastCreated, setLastCreated] = useState<{ sessionUrl: string; linkToken: string } | null>(null);
  const [form, setForm] = useState({
    caseId: "",
    mocaVersion: "8.3" as MocaVersion,
    ageBand: "70-79" as Session["age_band"],
    educationYears: 12,
    locationPlace: "בית",
    locationCity: "",
  });

  const fetchSessions = async () => {
    setLoading(true);
    setError(null);
    const { data, error: fetchError } = await supabase
      .from("sessions")
      .select("*, scoring_reports(*)")
      .order("created_at", { ascending: false });

    if (fetchError) {
      setError(fetchError.message);
      setSessions([]);
    } else {
      setSessions((data ?? []) as SessionRow[]);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchSessions();

    const channel = supabase
      .channel("clinician-dashboard")
      .on("postgres_changes", { event: "*", schema: "public", table: "sessions" }, fetchSessions)
      .on("postgres_changes", { event: "*", schema: "public", table: "scoring_reports" }, fetchSessions)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const filteredSessions = useMemo(() => {
    const term = search.trim();
    if (!term) return sessions;
    return sessions.filter(session =>
      session.case_id.includes(term) ||
      session.status.includes(term) ||
      session.age_band.includes(term)
    );
  }, [sessions, search]);

  const stats = useMemo(() => {
    const pending = sessions.filter(session => session.status === "awaiting_review").length;
    const completed = sessions.filter(session => session.status === "completed").length;
    const totalScores = sessions
      .map(session => getReport(session)?.total_adjusted)
      .filter((score): score is number => typeof score === "number");
    const average = totalScores.length
      ? (totalScores.reduce((sum, score) => sum + score, 0) / totalScores.length).toFixed(1)
      : "-";

    return { total: sessions.length, pending, completed, average };
  }, [sessions]);

  const handleCreateSession = async () => {
    setCreating(true);
    setError(null);
    try {
      const created = await callClinicianFunction<{ sessionUrl: string; linkToken: string }>("create-session", {
        method: "POST",
        body: JSON.stringify({
          caseId: form.caseId,
          mocaVersion: form.mocaVersion,
          ageBand: form.ageBand,
          educationYears: Number(form.educationYears),
          locationPlace: form.locationPlace,
          locationCity: form.locationCity,
        }),
      });
      setLastCreated({ sessionUrl: created.sessionUrl, linkToken: created.linkToken });
      setForm(prev => ({ ...prev, caseId: "" }));
      await fetchSessions();
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : "Failed to create session");
    } finally {
      setCreating(false);
    }
  };

  const handleCsvExport = () => {
    const header = ["case_id", "age_band", "status", "created_at", "total_adjusted", "total_provisional"].join(",");
    const rows = sessions.map(session => {
      const report = getReport(session);
      return [
        session.case_id,
        session.age_band,
        session.status,
        session.created_at,
        report?.total_adjusted ?? "",
        report?.total_provisional ?? "",
      ].join(",");
    });
    const blob = new Blob([[header, ...rows].join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "remote-check-sessions.csv";
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="max-w-6xl mx-auto min-h-[calc(100vh-56px)]">
      <div className="flex items-start justify-between gap-6 mb-8">
        <div>
          <h1 className="text-4xl font-extrabold text-black mb-2">מטופלים</h1>
          <div className="text-gray-500 font-medium text-lg">
            {stats.total} תיקים · {stats.pending} ממתינים לסקירה
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={fetchSessions}
            className="h-12 w-12 rounded-xl border border-gray-200 bg-white flex items-center justify-center hover:border-black focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-600"
            aria-label="רענן"
          >
            <RefreshCw className="w-5 h-5" />
          </button>
          <button
            onClick={handleCsvExport}
            className="h-12 px-5 rounded-xl border border-gray-200 bg-white flex items-center gap-2 font-bold hover:border-black focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-600"
          >
            <Download className="w-5 h-5" />
            CSV
          </button>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-2xl p-5 mb-8 shadow-sm">
        <div className="grid grid-cols-1 lg:grid-cols-7 gap-3 items-end">
          <label className="flex flex-col gap-2 lg:col-span-2">
            <span className="text-sm font-bold text-gray-500">מזהה תיק</span>
            <input
              data-testid="create-session-case-id"
              value={form.caseId}
              onChange={event => setForm(prev => ({ ...prev, caseId: event.target.value }))}
              className="h-12 rounded-xl border border-gray-200 px-4 focus:outline-none focus:ring-4 focus:ring-blue-600"
              placeholder="RC-2026-001"
            />
          </label>
          <label className="flex flex-col gap-2">
            <span className="text-sm font-bold text-gray-500">גרסת MoCA</span>
            <select
              data-testid="create-session-moca-version"
              value={form.mocaVersion}
              onChange={event => setForm(prev => ({ ...prev, mocaVersion: event.target.value as MocaVersion }))}
              className="h-12 rounded-xl border border-gray-200 px-4 bg-white focus:outline-none focus:ring-4 focus:ring-blue-600"
            >
              <option value="8.3">8.3</option>
              <option value="8.2">8.2</option>
              <option value="8.1">8.1</option>
            </select>
          </label>
          <label className="flex flex-col gap-2">
            <span className="text-sm font-bold text-gray-500">גיל</span>
            <select
              data-testid="create-session-age-band"
              value={form.ageBand}
              onChange={event => setForm(prev => ({ ...prev, ageBand: event.target.value as Session["age_band"] }))}
              className="h-12 rounded-xl border border-gray-200 px-4 bg-white focus:outline-none focus:ring-4 focus:ring-blue-600"
            >
              <option value="60-69">60-69</option>
              <option value="70-79">70-79</option>
              <option value="80+">80+</option>
            </select>
          </label>
          <label className="flex flex-col gap-2">
            <span className="text-sm font-bold text-gray-500">שנות לימוד</span>
            <input
              data-testid="create-session-education-years"
              type="number"
              min={0}
              max={40}
              value={form.educationYears}
              onChange={event => setForm(prev => ({ ...prev, educationYears: Number(event.target.value) }))}
              className="h-12 rounded-xl border border-gray-200 px-4 focus:outline-none focus:ring-4 focus:ring-blue-600"
            />
          </label>
          <label className="flex flex-col gap-2">
            <span className="text-sm font-bold text-gray-500">מקום</span>
            <input
              data-testid="create-session-location-place"
              value={form.locationPlace}
              onChange={event => setForm(prev => ({ ...prev, locationPlace: event.target.value }))}
              className="h-12 rounded-xl border border-gray-200 px-4 focus:outline-none focus:ring-4 focus:ring-blue-600"
            />
          </label>
          <label className="flex flex-col gap-2">
            <span className="text-sm font-bold text-gray-500">עיר</span>
            <input
              data-testid="create-session-location-city"
              value={form.locationCity}
              onChange={event => setForm(prev => ({ ...prev, locationCity: event.target.value }))}
              className="h-12 rounded-xl border border-gray-200 px-4 focus:outline-none focus:ring-4 focus:ring-blue-600"
            />
          </label>
        </div>
        <button
          data-testid="create-session-submit"
          onClick={handleCreateSession}
          disabled={creating || !form.caseId || !form.locationCity}
          className="mt-4 h-12 px-6 rounded-xl bg-black text-white font-bold flex items-center gap-2 disabled:bg-gray-300 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-600"
        >
          <Plus className="w-5 h-5" />
          צור קישור מבחן
        </button>

        {lastCreated && (
          <div className="mt-5 rounded-2xl border-2 border-blue-300 bg-blue-50 p-5 shadow-sm">
            <div className="text-sm font-extrabold text-blue-900 mb-3">קוד התחלת מבחן למטופל</div>
            <div className="rounded-xl bg-white border-2 border-blue-500 px-5 py-4 mb-4">
              <div className="text-xs font-bold text-gray-500 mb-2">יש למסור למטופל את הקוד הזה</div>
              <div dir="ltr" className="text-left text-2xl md:text-3xl font-mono font-black text-black break-all select-all">
                <span data-testid="created-link-token">
                {lastCreated.linkToken}
                </span>
              </div>
            </div>
            <div className="flex flex-col md:flex-row gap-3 md:items-center">
              <button
                onClick={() => navigator.clipboard.writeText(lastCreated.linkToken)}
                className="h-11 px-4 rounded-lg bg-white border border-blue-200 text-blue-900 font-bold flex items-center justify-center gap-2 hover:border-blue-700"
              >
                <Copy className="w-4 h-4" />
                העתק קוד
              </button>
              <button
                onClick={() => navigator.clipboard.writeText(lastCreated.sessionUrl)}
                className="h-11 px-4 rounded-lg bg-white border border-blue-200 text-blue-900 font-bold flex items-center justify-center gap-2 hover:border-blue-700"
              >
                <Copy className="w-4 h-4" />
                העתק קישור מלא
              </button>
              <a
                href={lastCreated.sessionUrl}
                target="_blank"
                rel="noreferrer"
                className="h-11 px-4 rounded-lg bg-black text-white font-bold flex items-center justify-center gap-2 hover:bg-gray-800"
              >
                <ExternalLink className="w-4 h-4" />
                פתח כמטופל
              </a>
            </div>
            <p className="mt-3 text-sm font-medium text-blue-900">
              במסך הבית של המטופל אפשר להזין את הקוד בלבד, או להדביק את הקישור המלא.
            </p>
          </div>
        )}
      </div>

      {error && (
        <div className="mb-6 rounded-xl border border-red-200 bg-red-50 text-red-800 px-5 py-4 font-medium">
          {error}
        </div>
      )}

      <div className="grid grid-cols-4 gap-6 mb-8">
        <StatCard label="סך תיקים" value={String(stats.total)} />
        <StatCard label="הושלמו" value={String(stats.completed)} />
        <StatCard label="ממתינים לסקירה" value={String(stats.pending)} warn />
        <StatCard label="ציון ממוצע" value={String(stats.average)} />
      </div>

      <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
        <div className="p-5 border-b border-gray-200 flex justify-between items-center gap-4">
          <div className="relative w-96 max-w-full">
            <Search className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              value={search}
              onChange={event => setSearch(event.target.value)}
              placeholder="חיפוש לפי מזהה תיק או סטטוס"
              className="w-full h-12 pr-12 pl-4 rounded-xl border border-gray-200 focus:outline-none focus:ring-4 focus:ring-blue-600"
            />
          </div>
        </div>

        {loading ? (
          <div className="p-10 text-center text-gray-500 font-bold">טוען נתונים...</div>
        ) : filteredSessions.length === 0 ? (
          <div className="p-10 text-center text-gray-500 font-bold">אין תיקים להצגה</div>
        ) : (
          <div className="divide-y divide-gray-100">
            {filteredSessions.map(session => {
              const report = getReport(session);
              return (
                <div
                  data-testid="session-row"
                  key={session.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => navigate(`/dashboard/${session.id}`)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") navigate(`/dashboard/${session.id}`);
                  }}
                  className="w-full min-h-[112px] px-6 py-4 text-right hover:bg-gray-50 transition-colors grid grid-cols-[2fr_1.2fr_0.8fr_1fr_1fr_auto] gap-4 items-center focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-600 cursor-pointer"
                >
                  <div>
                    <div className="font-extrabold text-lg text-black">{session.case_id}</div>
                    <div className="text-sm text-gray-500">מזהה תיק בלבד - ללא פרטים אישיים</div>
                  </div>
                  <div>
                    {session.status === "pending" ? (
                      <div className="rounded-xl border-2 border-blue-300 bg-blue-50 p-3">
                        <div className="text-xs font-extrabold text-blue-900 mb-1">קוד מטופל להתחלת מבחן</div>
                        <div dir="ltr" className="text-left text-sm font-mono font-black text-black break-all select-all">
                          {session.link_token}
                        </div>
                        <div className="mt-2 flex gap-2">
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              navigator.clipboard.writeText(session.link_token);
                            }}
                            className="h-8 px-2 rounded-lg bg-white border border-blue-200 text-blue-900 font-bold flex items-center gap-1 hover:border-blue-700"
                          >
                            <Copy className="w-3.5 h-3.5" />
                            העתק
                          </button>
                          <a
                            href={`/#/session/${session.link_token}`}
                            target="_blank"
                            rel="noreferrer"
                            onClick={(event) => event.stopPropagation()}
                            className="h-8 px-2 rounded-lg bg-black text-white font-bold flex items-center gap-1 hover:bg-gray-800"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                            פתח
                          </a>
                        </div>
                      </div>
                    ) : (
                      <div className="text-sm text-gray-500 font-bold">הקוד כבר הופעל</div>
                    )}
                  </div>
                  <div className="text-gray-700 tabular-nums font-bold">MoCA {session.moca_version}</div>
                  <div className="text-gray-700 tabular-nums">{session.age_band}</div>
                  <StatusPill status={session.status} />
                  <div className="font-extrabold text-xl text-black tabular-nums">
                    {report ? `${report.total_adjusted}/30` : "-"}
                  </div>
                  <ChevronLeft className="w-5 h-5 text-gray-400" />
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function getReport(session: SessionRow): DBScoringReport | null {
  if (!session.scoring_reports) return null;
  return Array.isArray(session.scoring_reports) ? session.scoring_reports[0] ?? null : session.scoring_reports;
}

function StatCard({ label, value, warn = false }: { label: string; value: string; warn?: boolean }) {
  return (
    <div className="bg-white border border-gray-200 p-6 rounded-2xl shadow-sm">
      <div className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-2">{label}</div>
      <div className={warn ? "text-4xl font-extrabold text-red-600 tabular-nums" : "text-4xl font-extrabold text-black tabular-nums"}>
        {value}
      </div>
    </div>
  );
}

function StatusPill({ status }: { status: Session["status"] }) {
  const label = {
    pending: "ממתין",
    in_progress: "בתהליך",
    awaiting_review: "בסקירה",
    completed: "הושלם",
  }[status];

  const className = {
    pending: "bg-blue-100 text-blue-800",
    in_progress: "bg-amber-100 text-amber-800",
    awaiting_review: "bg-red-100 text-red-800",
    completed: "bg-green-100 text-green-800",
  }[status];

  return (
    <span className={`inline-flex w-fit items-center gap-1.5 px-3 py-1 rounded-full text-sm font-bold ${className}`}>
      <span className="w-1.5 h-1.5 rounded-full bg-current" />
      {label}
    </span>
  );
}
