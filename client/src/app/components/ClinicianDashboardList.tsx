/* eslint-disable react-hooks/incompatible-library */
import { Search, ChevronLeft, Plus, Hash } from "lucide-react";
import { useNavigate } from "react-router";
import { useVirtualizer } from "@tanstack/react-virtual";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { clsx } from "clsx";
import { supabase } from "../../lib/supabase";
import { PatientForm } from "./PatientForm";
import { CsvExportConfirmDialog } from "./CsvExportConfirmDialog";
import { StatusPill } from "./StatusPill";
import {
  deriveClinicianQueueSummary,
  deriveClinicianStatus,
  type ClinicianQueueStatus,
} from "./clinician/clinicianQueue";
import { ClinicianWorkQueue } from "./clinician/ClinicianWorkQueue";

interface PatientRow {
  id: string;
  case_id: string | null;
  created_at: string;
  tests: number;
  completed: number;
  lastActive: string | null;
  latestScore: number | null;
  latestScoreProvisional: boolean;
  needsReview: boolean;
  status: ClinicianQueueStatus;
}

interface ScoringSummary {
  total_score: number | null;
  total_adjusted: number | null;
  needs_review: boolean;
  total_provisional: boolean | null;
  pending_review_count: number | null;
}

interface PatientSessionSummary {
  id: string;
  status: "pending" | "in_progress" | "completed" | "awaiting_review";
  created_at: string;
  scoring_reports: ScoringSummary | ScoringSummary[] | null;
}

interface ScoreTrendPoint {
  date: string;
  score: number;
  caseLabel: string;
}

interface PatientWithSessions {
  id: string;
  case_id: string | null;
  created_at: string;
  sessions: PatientSessionSummary | PatientSessionSummary[] | null;
}

function relationArray<T>(value: T | T[] | null | undefined): T[] {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

function reportScore(report: ScoringSummary | null | undefined): number | null {
  return report?.total_adjusted ?? report?.total_score ?? null;
}

function reportNeedsReview(report: ScoringSummary | null | undefined): boolean {
  if (!report) return false;
  return report.total_provisional ?? report.needs_review ?? false;
}

function scoreLabel(score: number | null, provisional: boolean): string {
  if (score == null) return "—";
  return provisional ? `${score}/30 (זמני)` : `${score}/30`;
}

function caseDisplay(row: Pick<PatientRow, "case_id" | "id">): string {
  return row.case_id?.trim() || row.id.slice(0, 8);
}

function latestOf<T>(arr: T[] | null | undefined, key: (v: T) => string | null): string | null {
  if (!arr || arr.length === 0) return null;
  const times = arr.map(key).filter((v): v is string => Boolean(v));
  if (times.length === 0) return null;
  return times.sort().slice(-1)[0];
}

function ScoreTrendChart({ points }: { points: ScoreTrendPoint[] }) {
  if (points.length === 0) {
    return (
      <div className="flex h-full min-h-28 flex-col">
        <div className="mb-2">
          <div className="text-sm font-bold text-gray-600">שינוי בציון MoCA לאורך זמן</div>
          <div className="text-xs font-bold text-gray-500">0 מבדקים סופיים</div>
        </div>
        <div className="flex flex-1 items-center justify-center rounded-lg border border-dashed border-gray-200 bg-gray-50 px-4 text-center text-sm font-bold text-gray-500">
          אין עדיין מבדקים סופיים להצגת שינוי בציון.
        </div>
      </div>
    );
  }

  const width = 560;
  const height = 130;
  const padding = { top: 16, right: 36, bottom: 34, left: 28 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;
  const xFor = (index: number) =>
    padding.left +
    (points.length === 1 ? chartWidth / 2 : (index / (points.length - 1)) * chartWidth);
  const yFor = (score: number) => padding.top + ((30 - score) / 30) * chartHeight;
  const path = points
    .map(
      (point, index) =>
        `${index === 0 ? "M" : "L"} ${xFor(index).toFixed(1)} ${yFor(point.score).toFixed(1)}`,
    )
    .join(" ");
  const first = points[0];
  const last = points[points.length - 1];

  return (
    <div className="flex h-full min-h-32 flex-col">
      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <div className="text-sm font-bold text-gray-600">שינוי בציון MoCA לאורך זמן</div>
          <div className="text-xs font-bold text-gray-500">{points.length} מבדקים סופיים</div>
        </div>
        <div className="text-xl font-extrabold text-black tabular-nums">{last.score}/30</div>
      </div>

      <svg
        role="img"
        aria-label={`שינוי ציון MoCA מ-${first.score} ל-${last.score}`}
        viewBox={`0 0 ${width} ${height}`}
        className="h-28 w-full overflow-visible"
        preserveAspectRatio="none"
      >
        {[0, 15, 30].map((tick) => {
          const y = yFor(tick);
          return (
            <g key={tick}>
              <line
                x1={padding.left}
                x2={width - padding.right}
                y1={y}
                y2={y}
                stroke="#e5e7eb"
                strokeWidth="1"
              />
              <text
                x={width - padding.right + 8}
                y={y + 4}
                className="fill-gray-500 text-[11px] font-bold"
              >
                {tick}
              </text>
            </g>
          );
        })}
        <path
          d={path}
          fill="none"
          stroke="#111827"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="4"
        />
        {points.map((point, index) => (
          <g key={`${point.date}-${point.caseLabel}-${index}`}>
            <circle
              cx={xFor(index)}
              cy={yFor(point.score)}
              r="6"
              fill="#16a34a"
              stroke="white"
              strokeWidth="3"
            />
            <title>{`${point.caseLabel}: ${point.score}/30`}</title>
          </g>
        ))}
        <text
          x={xFor(0)}
          y={height - 8}
          textAnchor="middle"
          className="fill-gray-500 text-[11px] font-bold"
        >
          {new Date(first.date).toLocaleDateString("he-IL")}
        </text>
        <text
          x={xFor(points.length - 1)}
          y={height - 8}
          textAnchor="middle"
          className="fill-gray-500 text-[11px] font-bold"
        >
          {new Date(last.date).toLocaleDateString("he-IL")}
        </text>
      </svg>
    </div>
  );
}

export function ClinicianDashboardList() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | PatientRow["status"]>("all");
  const [rows, setRows] = useState<PatientRow[]>([]);
  const [scoreTrend, setScoreTrend] = useState<ScoreTrendPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [exportingCsv, setExportingCsv] = useState(false);
  const [csvConfirmOpen, setCsvConfirmOpen] = useState(false);
  const [csvExportMessage, setCsvExportMessage] = useState<{
    kind: "success" | "error";
    text: string;
  } | null>(null);

  const loadPatients = useCallback(async () => {
    setLoading(true);
    try {
      const { data: authData } = await supabase.auth.getSession();
      const session = authData.session;
      if (!session) {
        setRows([]);
        setScoreTrend([]);
        return;
      }

      const { data, error } = await supabase
        .from("patients")
        .select(
          "id, case_id, created_at, sessions(id, status, created_at, scoring_reports(total_adjusted, total_provisional, pending_review_count, total_score, needs_review))",
        )
        .eq("clinician_id", session.user.id)
        .order("created_at", { ascending: false });

      if (error || !data) {
        console.error("Failed to fetch patients", error);
        setRows([]);
        return;
      }

      const mapped: PatientRow[] = (data as PatientWithSessions[]).map((p) => {
        const sessions = relationArray(p.sessions);
        const completed = sessions.filter((s) => s.status === "completed").length;
        const latestSession = latestOf(sessions, (s) => s.created_at);
        const reports = sessions.flatMap((s) => relationArray(s.scoring_reports));
        const finalScore =
          reports
            .filter((report) => !reportNeedsReview(report))
            .map(reportScore)
            .find((score): score is number => score != null) ?? null;
        const provisionalScore =
          reports
            .filter(reportNeedsReview)
            .map(reportScore)
            .find((score): score is number => score != null) ?? null;
        const latestScore = finalScore ?? provisionalScore;
        const needsReview = sessions.some(
          (s) =>
            s.status === "awaiting_review" ||
            relationArray(s.scoring_reports).some(reportNeedsReview),
        );
        return {
          id: p.id,
          case_id: p.case_id,
          created_at: p.created_at,
          tests: sessions.length,
          completed,
          lastActive: latestSession ?? p.created_at,
          latestScore,
          latestScoreProvisional: finalScore == null && provisionalScore != null,
          needsReview,
          status: deriveClinicianStatus(sessions),
        };
      });
      const trendPoints = (data as PatientWithSessions[])
        .flatMap((p) =>
          relationArray(p.sessions).flatMap((s) => {
            const finalScore = relationArray(s.scoring_reports)
              .filter((report) => !reportNeedsReview(report))
              .map(reportScore)
              .find((score): score is number => score != null);
            if (s.status !== "completed" || finalScore == null) return [];
            return [{ date: s.created_at, score: finalScore, caseLabel: caseDisplay(p) }];
          }),
        )
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

      setRows(mapped);
      setScoreTrend(trendPoints);
    } catch (error) {
      console.error("Failed to load patients", error);
      setRows([]);
      setScoreTrend([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPatients();
  }, [loadPatients]);

  const filtered = useMemo(() => {
    const statusPriority: Record<PatientRow["status"], number> = {
      review: 0,
      in_progress: 1,
      new: 2,
      completed: 3,
    };
    const scopedRows =
      statusFilter === "all" ? rows : rows.filter((r) => r.status === statusFilter);
    const q = search.trim().toLowerCase();
    const matchingRows = q
      ? scopedRows.filter(
          (r) => caseDisplay(r).toLowerCase().includes(q) || r.id.toLowerCase().includes(q),
        )
      : scopedRows;
    return [...matchingRows].sort((a, b) => {
      const priorityDelta = statusPriority[a.status] - statusPriority[b.status];
      if (priorityDelta !== 0) return priorityDelta;
      return (
        new Date(b.lastActive ?? b.created_at).getTime() -
        new Date(a.lastActive ?? a.created_at).getTime()
      );
    });
  }, [rows, search, statusFilter]);

  const parentRef = useRef<HTMLDivElement>(null);
  const rowVirtualizer = useVirtualizer({
    count: Math.max(filtered.length, 1),
    getScrollElement: () => parentRef.current,
    estimateSize: () => 64,
    overscan: 5,
  });

  const handleCsvExport = async () => {
    if (exportingCsv) return;
    setExportingCsv(true);
    setCsvExportMessage(null);

    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) {
      setCsvExportMessage({ kind: "error", text: "יש להתחבר כקלינאי כדי לייצא CSV." });
      setExportingCsv(false);
      return;
    }

    try {
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/export-csv`, {
        method: "POST",
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (!res.ok) {
        let message = "ייצוא CSV נכשל.";
        try {
          const payload = await res.json();
          if (payload?.error) message = payload.error;
        } catch {
          // Keep the localized fallback for non-JSON errors.
        }
        throw new Error(message);
      }

      const blob = await res.blob();
      if (blob.size === 0) throw new Error("קובץ ה-CSV שהתקבל ריק.");
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "moca_export.csv";
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      a.remove();
      setCsvExportMessage({
        kind: "success",
        text: "CSV ירד בהצלחה. הקובץ יכול לכלול נתונים זמניים.",
      });
    } catch (e) {
      console.error(e);
      setCsvExportMessage({
        kind: "error",
        text: e instanceof Error ? e.message : "ייצוא CSV נכשל.",
      });
    } finally {
      setExportingCsv(false);
    }
  };

  const queueSummary = deriveClinicianQueueSummary(rows);
  const totalCases = queueSummary.all;
  const reviewCount = queueSummary.review;
  const completedCount = queueSummary.completed;
  const emptyMessage =
    rows.length === 0
      ? 'עדיין לא נוספו תיקים. התחילו על ידי לחיצה על "תיק חדש".'
      : statusFilter !== "all" && filtered.length === 0
        ? "אין תיקים בסטטוס הנבחר."
        : "לא נמצאו תיקים מתאימים לחיפוש.";

  return (
    <div className="max-w-[1240px] mx-auto min-h-[calc(100vh-112px)] lg:h-[calc(100vh-48px)] flex flex-col gap-3">
      <div className="flex shrink-0 flex-col gap-3">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <h1 className="text-2xl font-extrabold text-black mb-1">תיקים</h1>
            <div className="text-gray-500 font-bold text-sm">
              {loading ? "טוען..." : `${totalCases} תיקים · ${reviewCount} דורשים סקירה`}
            </div>
          </div>
          <div className="grid w-full min-w-0 grid-cols-1 gap-2 sm:grid-cols-[auto_minmax(0,1fr)_auto] xl:w-auto xl:grid-cols-[auto_minmax(18rem,20rem)_auto]">
            <button
              onClick={() => setCsvConfirmOpen(true)}
              disabled={exportingCsv}
              className="flex h-10 items-center justify-center gap-2 bg-white text-black border border-gray-200 px-3 rounded-lg font-bold hover:bg-gray-50 disabled:cursor-wait disabled:opacity-60 transition-colors shadow-sm text-sm"
            >
              <span>{exportingCsv ? "מייצא CSV..." : "ייצוא CSV"}</span>
            </button>

            <div className="relative min-w-0">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="חיפוש לפי מזהה תיק…"
                className="h-10 w-full xl:w-80 pl-3 pr-10 bg-white border border-gray-200 rounded-lg text-sm shadow-sm focus:outline-none focus:ring-4 focus:ring-blue-600 focus:border-blue-600 transition-all"
              />
            </div>

            <button
              onClick={() => setFormOpen(true)}
              className="flex h-10 items-center justify-center gap-2 bg-black text-white px-3 rounded-lg font-bold hover:bg-gray-800 transition-colors shadow-sm text-sm"
            >
              <Plus className="w-4 h-4" />
              <span>תיק חדש</span>
            </button>
          </div>
        </div>
        {csvExportMessage && (
          <p
            role={csvExportMessage.kind === "error" ? "alert" : "status"}
            className={`text-sm font-bold ${csvExportMessage.kind === "error" ? "text-red-700" : "text-green-700"}`}
          >
            {csvExportMessage.text}
          </p>
        )}
        <ClinicianWorkQueue
          value={statusFilter}
          summary={queueSummary}
          onChange={setStatusFilter}
        />
        <div className="grid grid-cols-3 gap-2 text-sm sm:max-w-md">
          {[
            { label: "תיקים", value: totalCases },
            { label: "הושלמו", value: completedCount },
            { label: "לסקירה", value: reviewCount, warn: true },
          ].map((stat) => (
            <div
              key={stat.label}
              className="rounded-lg border border-gray-200 bg-white px-3 py-2 shadow-sm"
            >
              <div className="text-xs font-bold text-gray-500">{stat.label}</div>
              <div
                className={clsx(
                  "text-lg font-extrabold tabular-nums",
                  stat.warn ? "text-red-600" : "text-black",
                )}
              >
                {stat.value}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm flex-1 flex flex-col min-h-[260px]">
        <div className="bg-gray-50 border-b border-gray-200 text-gray-600 text-sm font-bold shrink-0">
          <div className="hidden md:flex text-right px-4 py-2.5">
            <div className="w-5/12 font-bold">מזהה תיק</div>
            <div className="w-1/12 font-bold">מבדקים</div>
            <div className="w-2/12 font-bold">פעילות אחרונה</div>
            <div className="w-2/12 font-bold">סטטוס</div>
            <div className="w-1/12 font-bold">ציון</div>
            <div className="w-1/12"></div>
          </div>
          <div className="md:hidden px-4 py-3 font-bold">רשימת תיקים</div>
        </div>

        <div className="md:hidden overflow-auto flex-1 p-3 space-y-3">
          {filtered.length === 0 && !loading && (
            <div className="flex min-h-52 flex-col items-center justify-center text-center text-gray-500 font-bold text-base gap-2 px-4">
              <span>{emptyMessage}</span>
            </div>
          )}

          {filtered.map((p) => (
            <button
              key={p.id}
              onClick={() => navigate(`/dashboard/patient/${p.id}`)}
              className="w-full rounded-xl border border-gray-200 bg-white p-4 text-right shadow-sm transition-colors hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-600"
            >
              <div className="flex items-start gap-3">
                <div className="w-11 h-11 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-lg shrink-0">
                  {(caseDisplay(p).trim()[0] || "ת").toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="font-bold text-lg text-black truncate">תיק {caseDisplay(p)}</div>
                  <div className="mt-1 text-xs text-gray-500 font-mono flex items-center gap-1.5">
                    <Hash className="w-3 h-3" />
                    {p.id.slice(0, 8)}
                  </div>
                </div>
                <ChevronLeft className="mt-2 w-5 h-5 text-gray-400 shrink-0" />
              </div>

              <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                <div>
                  <div className="font-bold text-gray-500">מבדקים</div>
                  <div className="text-gray-900 tabular-nums">{p.tests}</div>
                </div>
                <div>
                  <div className="font-bold text-gray-500">ציון</div>
                  <div className="font-extrabold text-black tabular-nums">
                    {scoreLabel(p.latestScore, p.latestScoreProvisional)}
                  </div>
                </div>
                <div>
                  <div className="font-bold text-gray-500">פעילות אחרונה</div>
                  <div className="text-gray-900 tabular-nums">
                    {p.lastActive ? new Date(p.lastActive).toLocaleDateString("he-IL") : "—"}
                  </div>
                </div>
                <div>
                  <div className="font-bold text-gray-500">סטטוס</div>
                  <StatusPill status={p.status} className="mt-1 text-xs" />
                </div>
              </div>
            </button>
          ))}
        </div>

        <div ref={parentRef} className="hidden md:block overflow-auto flex-1 relative">
          <div
            style={{
              height: `${rowVirtualizer.getTotalSize()}px`,
              width: "100%",
              position: "relative",
            }}
          >
            {filtered.length === 0 && !loading && (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-500 font-bold text-lg gap-2">
                <span>{emptyMessage}</span>
              </div>
            )}

            {rowVirtualizer.getVirtualItems().map((virtualRow) => {
              const p = filtered[virtualRow.index];
              if (!p) return null;
              return (
                <button
                  type="button"
                  key={virtualRow.index}
                  onClick={() => navigate(`/dashboard/patient/${p.id}`)}
                  className="absolute left-0 top-0 flex w-full cursor-pointer appearance-none items-center border-0 border-b border-gray-100 bg-white px-4 py-0 text-right text-inherit transition-colors hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-600 group"
                  style={{
                    height: `${virtualRow.size}px`,
                    transform: `translateY(${virtualRow.start}px)`,
                  }}
                >
                  <div className="w-5/12 flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-sm shrink-0">
                      {(caseDisplay(p).trim()[0] || "ת").toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <div className="font-bold text-sm text-black truncate">
                        תיק {caseDisplay(p)}
                      </div>
                      <div className="text-xs text-gray-500 font-mono flex items-center gap-1.5">
                        <Hash className="w-3 h-3" />
                        {p.id.slice(0, 8)}
                      </div>
                    </div>
                  </div>
                  <div className="w-1/12 text-gray-600 text-sm tabular-nums">{p.tests}</div>
                  <div className="w-2/12 text-gray-600 text-sm tabular-nums">
                    {p.lastActive ? new Date(p.lastActive).toLocaleDateString("he-IL") : "—"}
                  </div>
                  <div className="w-2/12">
                    <StatusPill status={p.status} />
                  </div>
                  <div className="w-1/12 font-extrabold text-base text-black tabular-nums">
                    {scoreLabel(p.latestScore, p.latestScoreProvisional)}
                  </div>
                  <div className="w-1/12 text-left flex justify-end">
                    <div className="w-8 h-8 rounded-full flex items-center justify-center bg-transparent group-hover:bg-white border border-transparent group-hover:border-gray-200 group-hover:shadow-sm transition-all text-gray-400">
                      <ChevronLeft className="w-5 h-5" />
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="shrink-0 rounded-xl border border-gray-200 bg-white p-3 shadow-sm">
        <ScoreTrendChart points={scoreTrend} />
      </div>

      <PatientForm
        open={formOpen}
        onClose={() => setFormOpen(false)}
        onCreated={(patientId) => {
          setFormOpen(false);
          navigate(`/dashboard/patient/${patientId}`);
        }}
      />
      <CsvExportConfirmDialog
        open={csvConfirmOpen}
        exporting={exportingCsv}
        scopeLabel="כל התיקים"
        onCancel={() => setCsvConfirmOpen(false)}
        onConfirm={() => {
          setCsvConfirmOpen(false);
          void handleCsvExport();
        }}
      />
    </div>
  );
}
