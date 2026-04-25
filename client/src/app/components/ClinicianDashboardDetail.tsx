import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, ChevronRight, FileDown, Save } from "lucide-react";
import { Link, useParams } from "react-router";
import { callClinicianFunction } from "../../lib/api";
import type { DBScoringReport, DrawingReview, ScoringItemReview, Session, TaskResult } from "../../types/database";
import { PlaybackCanvas } from "./PlaybackCanvas";

type SessionDetail = Session & {
  task_results: TaskResult[];
  scoring_report: DBScoringReport | null;
  drawings: DrawingReview[];
  scoring_reviews: ScoringItemReview[];
};

const DRAWING_LABELS: Record<string, string> = {
  "moca-visuospatial": "חיבור נקודות",
  "moca-cube": "קובייה",
  "moca-clock": "שעון",
};

const DRAWING_MAX: Record<string, number> = {
  "moca-visuospatial": 1,
  "moca-cube": 1,
  "moca-clock": 3,
};

export function ClinicianDashboardDetail() {
  const { patientId } = useParams();
  const [session, setSession] = useState<SessionDetail | null>(null);
  const [activeReviewId, setActiveReviewId] = useState<string | null>(null);
  const [scores, setScores] = useState<Record<string, number>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [itemScores, setItemScores] = useState<Record<string, number>>({});
  const [itemNotes, setItemNotes] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadSession = useCallback(async () => {
    if (!patientId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await callClinicianFunction<{ session: SessionDetail }>(`get-session?sessionId=${encodeURIComponent(patientId)}`, {
        method: "GET",
        headers: {},
      });
      setSession(res.session);
      const initialScores = Object.fromEntries((res.session.drawings ?? []).map(review => [review.id, review.clinician_score ?? 0]));
      const initialNotes = Object.fromEntries((res.session.drawings ?? []).map(review => [review.id, review.clinician_notes ?? ""]));
      const initialItemScores = Object.fromEntries((res.session.scoring_reviews ?? []).map(review => [review.id, review.clinician_score ?? 0]));
      const initialItemNotes = Object.fromEntries((res.session.scoring_reviews ?? []).map(review => [review.id, review.clinician_notes ?? ""]));
      setScores(initialScores);
      setNotes(initialNotes);
      setItemScores(initialItemScores);
      setItemNotes(initialItemNotes);
      setActiveReviewId(res.session.drawings?.[0]?.id ?? null);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load session");
    } finally {
      setLoading(false);
    }
  }, [patientId]);

  useEffect(() => {
    loadSession();
  }, [loadSession]);

  const activeReview = useMemo(
    () => session?.drawings.find(review => review.id === activeReviewId) ?? session?.drawings[0] ?? null,
    [session, activeReviewId]
  );

  const report = session?.scoring_report ?? null;
  const taskCount = session?.task_results?.length ?? 0;
  const scoringReviewCount = session?.scoring_reviews?.length ?? 0;

  const handleSaveReview = async (review: DrawingReview) => {
    setSaving(review.id);
    setError(null);
    try {
      const res = await callClinicianFunction<{ scoringReport: any }>("update-drawing-review", {
        method: "POST",
        body: JSON.stringify({
          reviewId: review.id,
          clinicianScore: Number(scores[review.id] ?? 0),
          clinicianNotes: notes[review.id] ?? "",
        }),
      });

      setSession(prev => prev ? {
        ...prev,
        scoring_report: res.scoringReport ? {
          ...toDbScoringReport(res.scoringReport, prev),
        } : prev.scoring_report,
        status: res.scoringReport?.totalProvisional === false ? "completed" : "awaiting_review",
        drawings: prev.drawings.map(item =>
          item.id === review.id
            ? { ...item, clinician_score: Number(scores[review.id] ?? 0), clinician_notes: notes[review.id] ?? "", reviewed_at: new Date().toISOString() }
            : item
        ),
      } : prev);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Failed to save review");
    } finally {
      setSaving(null);
    }
  };

  const handleSaveScoringReview = async (review: ScoringItemReview) => {
    setSaving(review.id);
    setError(null);
    try {
      const res = await callClinicianFunction<{ scoringReport: any }>("update-scoring-review", {
        method: "POST",
        body: JSON.stringify({
          reviewId: review.id,
          clinicianScore: Number(itemScores[review.id] ?? 0),
          clinicianNotes: itemNotes[review.id] ?? "",
        }),
      });

      setSession(prev => prev ? {
        ...prev,
        scoring_report: res.scoringReport ? toDbScoringReport(res.scoringReport, prev) : prev.scoring_report,
        status: res.scoringReport?.totalProvisional === false ? "completed" : "awaiting_review",
        scoring_reviews: prev.scoring_reviews.map(item =>
          item.id === review.id
            ? { ...item, clinician_score: Number(itemScores[review.id] ?? 0), clinician_notes: itemNotes[review.id] ?? "", reviewed_at: new Date().toISOString() }
            : item
        ),
      } : prev);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Failed to save scoring review");
    } finally {
      setSaving(null);
    }
  };

  const handlePdf = () => {
    window.print();
  };

  if (loading) {
    return <div className="p-10 text-center text-gray-500 font-bold">טוען תיק...</div>;
  }

  if (!session) {
    return (
      <div className="max-w-5xl mx-auto">
        <Link to="/dashboard" className="text-gray-500 font-bold hover:text-black flex items-center gap-2 w-fit">
          <ChevronRight className="w-5 h-5" />
          <span>חזרה לרשימה</span>
        </Link>
        <div className="mt-8 rounded-xl border border-red-200 bg-red-50 text-red-800 px-5 py-4 font-medium">
          {error === "Session not found" ? "התיק לא נמצא או שאינו משויך לחשבון הקלינאי המחובר." : error ?? "התיק לא נמצא"}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto pb-20">
      <div className="mb-6">
        <Link to="/dashboard" className="text-gray-500 font-bold hover:text-black flex items-center gap-2 transition-colors w-fit">
          <ChevronRight className="w-5 h-5" />
          <span>מטופלים / {session.case_id}</span>
        </Link>
      </div>

      {error && (
        <div className="mb-6 rounded-xl border border-red-200 bg-red-50 text-red-800 px-5 py-4 font-medium">
          {error}
        </div>
      )}

      <div className="flex items-start justify-between mb-8 bg-white p-8 rounded-2xl border border-gray-200 shadow-sm">
        <div>
          <h1 className="text-3xl font-extrabold text-black mb-3">{session.case_id}</h1>
          <div className="flex flex-wrap gap-4 text-gray-500 font-medium text-lg items-center">
            <span>גיל {session.age_band}</span>
            <span>MoCA {session.moca_version}</span>
            <span>{session.education_years} שנות לימוד</span>
            <span>{session.location_place}, {session.location_city}</span>
            <span className="font-mono bg-gray-100 px-2 py-0.5 rounded-md">{session.id}</span>
          </div>
        </div>
        <button
          onClick={handlePdf}
          className="flex items-center gap-2 px-6 py-3 rounded-xl font-bold bg-white border-2 border-gray-200 hover:border-black transition-colors text-black focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-600"
        >
          <FileDown className="w-5 h-5" />
          <span>PDF</span>
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
        <SummaryCard testId="summary-total" label="סך הכל MoCA" value={report ? `${report.total_adjusted}/30` : "-"} warn={!!report?.total_provisional} />
        <SummaryCard testId="summary-status" label="סטטוס" value={statusLabel(session.status)} />
        <SummaryCard testId="summary-task-count" label="משימות שנשמרו" value={`${taskCount}/12`} />
        <SummaryCard testId="summary-pending-review" label="ממתינים לסקירה" value={String(report?.pending_review_count ?? session.drawings.length + scoringReviewCount)} warn={(report?.pending_review_count ?? 0) > 0} />
        <SummaryCard testId="summary-percentile" label="אחוזון" value={report?.norm_percentile == null ? "-" : String(report.norm_percentile)} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-6">
        <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm h-fit">
          <h2 className="text-xl font-extrabold text-black mb-4">ציורים לסקירה</h2>
          <div className="space-y-2">
            {session.drawings.length === 0 ? (
              <div className="text-gray-500 font-medium">לא נשמרו ציורים</div>
            ) : session.drawings.map(review => (
              <button
                data-testid="drawing-review-tab"
                key={review.id}
                onClick={() => setActiveReviewId(review.id)}
                className={`w-full text-right rounded-xl px-4 py-3 border font-bold transition-colors ${
                  activeReview?.id === review.id ? "border-black bg-gray-50" : "border-gray-200 bg-white hover:border-black"
                }`}
              >
                <div>{DRAWING_LABELS[review.task_id] ?? review.task_id}</div>
                <div className="text-sm text-gray-500 mt-1">
                  {review.clinician_score == null ? "טרם נסקר" : `${review.clinician_score}/${DRAWING_MAX[review.task_id]}`}
                </div>
              </button>
            ))}
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm min-h-[620px]">
          {activeReview ? (
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
              <div>
                <h2 className="text-2xl font-extrabold text-black mb-4">{DRAWING_LABELS[activeReview.task_id]}</h2>
                {activeReview.signedUrl ? (
                  <img
                    src={activeReview.signedUrl}
                    alt={DRAWING_LABELS[activeReview.task_id]}
                    className="w-full max-h-[420px] object-contain rounded-xl border border-gray-200 bg-white"
                  />
                ) : (
                  <PlaybackCanvas strokes={activeReview.strokes_data ?? []} width={460} height={360} />
                )}
              </div>

              <div className="bg-gray-50 border border-gray-100 rounded-2xl p-6">
                <h3 className="text-xl font-extrabold text-black mb-4">ניקוד קליני</h3>
                <label className="flex flex-col gap-2 mb-5">
                  <span className="text-sm font-bold text-gray-500">ציון מתוך {DRAWING_MAX[activeReview.task_id]}</span>
                  <input
                    data-testid="drawing-review-score"
                    type="number"
                    min={0}
                    max={DRAWING_MAX[activeReview.task_id]}
                    value={scores[activeReview.id] ?? 0}
                    onChange={event => setScores(prev => ({ ...prev, [activeReview.id]: Number(event.target.value) }))}
                    className="h-14 rounded-xl border border-gray-200 bg-white px-4 text-xl font-bold focus:outline-none focus:ring-4 focus:ring-blue-600"
                  />
                </label>
                <label className="flex flex-col gap-2 mb-5">
                  <span className="text-sm font-bold text-gray-500">הערות</span>
                  <textarea
                    value={notes[activeReview.id] ?? ""}
                    onChange={event => setNotes(prev => ({ ...prev, [activeReview.id]: event.target.value }))}
                    className="min-h-36 rounded-xl border border-gray-200 bg-white p-4 focus:outline-none focus:ring-4 focus:ring-blue-600"
                  />
                </label>
                <button
                  data-testid="drawing-review-save"
                  onClick={() => handleSaveReview(activeReview)}
                  disabled={saving === activeReview.id}
                  className="h-14 px-6 rounded-xl bg-black text-white font-bold flex items-center gap-2 disabled:bg-gray-300 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-600"
                >
                  <Save className="w-5 h-5" />
                  שמור ניקוד
                </button>
              </div>
            </div>
          ) : (
            <div className="h-full flex items-center justify-center text-gray-500 font-bold">
              אין פריטי ציור לסקירה
            </div>
          )}
        </div>
      </div>

      <div className="mt-8 bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
        <div className="flex items-center justify-between gap-4 mb-5">
          <div>
            <h2 className="text-2xl font-extrabold text-black">פריטי ניקוד נוספים</h2>
            <p className="text-sm font-bold text-gray-500 mt-1">פריטים שהניקוד האוטומטי לא הצליח לחשב וממתינים להחלטת קלינאי</p>
          </div>
          <div className="text-sm font-bold text-gray-500">{scoringReviewCount} פריטים</div>
        </div>

        {scoringReviewCount === 0 ? (
          <div className="rounded-xl bg-gray-50 border border-gray-100 p-5 font-medium text-gray-500">אין פריטי ניקוד נוספים לסקירה.</div>
        ) : (
          <div className="divide-y divide-gray-100">
            {session.scoring_reviews.map(review => (
              <div key={review.id} data-testid="scoring-review" className="py-5 grid grid-cols-1 lg:grid-cols-[1fr_220px] gap-5">
                <div>
                  <div className="flex flex-wrap items-center gap-3 mb-3">
                    <h3 className="text-lg font-extrabold text-black">{scoringItemLabel(review.item_id)}</h3>
                    <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-bold text-gray-600">{scoringItemDomain(review.task_type)}</span>
                    <span className={review.clinician_score == null ? "rounded-full bg-amber-50 px-3 py-1 text-xs font-bold text-amber-700" : "rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700"}>
                      {review.clinician_score == null ? "טרם נסקר" : `${review.clinician_score}/${review.max_score}`}
                    </span>
                  </div>

                  <EvidencePanel review={review} />
                </div>

                <div className="bg-gray-50 border border-gray-100 rounded-2xl p-4">
                  <label className="flex flex-col gap-2 mb-4">
                    <span className="text-sm font-bold text-gray-500">ציון מתוך {review.max_score}</span>
                    <input
                      data-testid="scoring-review-score"
                      type="number"
                      min={0}
                      max={review.max_score}
                      value={itemScores[review.id] ?? 0}
                      onChange={event => setItemScores(prev => ({ ...prev, [review.id]: Number(event.target.value) }))}
                      className="h-12 rounded-xl border border-gray-200 bg-white px-4 text-lg font-bold focus:outline-none focus:ring-4 focus:ring-blue-600"
                    />
                  </label>
                  <label className="flex flex-col gap-2 mb-4">
                    <span className="text-sm font-bold text-gray-500">הערות</span>
                    <textarea
                      value={itemNotes[review.id] ?? ""}
                      onChange={event => setItemNotes(prev => ({ ...prev, [review.id]: event.target.value }))}
                      className="min-h-24 rounded-xl border border-gray-200 bg-white p-3 focus:outline-none focus:ring-4 focus:ring-blue-600"
                    />
                  </label>
                  <button
                    data-testid="scoring-review-save"
                    onClick={() => handleSaveScoringReview(review)}
                    disabled={saving === review.id}
                    className="h-12 w-full px-4 rounded-xl bg-black text-white font-bold flex items-center justify-center gap-2 disabled:bg-gray-300 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-600"
                  >
                    <Save className="w-5 h-5" />
                    שמור
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function SummaryCard({ label, value, warn = false, testId }: { label: string; value: string; warn?: boolean; testId?: string }) {
  return (
    <div data-testid={testId} className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm text-center">
      <div className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-2">{label}</div>
      <div className={warn ? "text-3xl font-extrabold tabular-nums text-red-600" : "text-3xl font-extrabold tabular-nums text-black"}>
        {value}
      </div>
    </div>
  );
}

function statusLabel(status: Session["status"]): string {
  return {
    pending: "ממתין",
    in_progress: "בתהליך",
    awaiting_review: "בסקירה",
    completed: "הושלם",
  }[status];
}

function toDbScoringReport(scoringReport: any, session: SessionDetail): DBScoringReport {
  return {
    ...(session.scoring_report ?? {}),
    id: session.scoring_report?.id ?? "",
    session_id: session.id,
    total_raw: scoringReport.totalRaw,
    total_adjusted: scoringReport.totalAdjusted,
    total_provisional: scoringReport.totalProvisional,
    norm_percentile: scoringReport.normPercentile,
    norm_sd: scoringReport.normSd,
    pending_review_count: scoringReport.pendingReviewCount,
    domains: scoringReport.domains,
    completed_at: scoringReport.completedAt,
  } as DBScoringReport;
}

function scoringItemLabel(itemId: string): string {
  return {
    "moca-digit-span": "חזרה על מספרים",
    "moca-vigilance": "קשב",
    "moca-serial-7s": "סדרת 7",
    "moca-language": "שפה",
    "moca-abstraction": "הפשטה",
    "moca-delayed-recall": "זכירה מושהית",
    "moca-orientation-task": "התמצאות",
    "moca-naming": "שיום",
  }[itemId] ?? itemId;
}

function scoringItemDomain(taskType: string): string {
  return {
    "moca-digit-span": "קשב",
    "moca-vigilance": "קשב",
    "moca-serial-7s": "קשב",
    "moca-language": "שפה",
    "moca-abstraction": "הפשטה",
    "moca-delayed-recall": "זיכרון",
    "moca-orientation-task": "התמצאות",
    "moca-naming": "שיום",
  }[taskType] ?? taskType;
}

function EvidencePanel({ review }: { review: ScoringItemReview }) {
  const rawData = review.raw_data ?? {};
  const skipped = rawData?.skipped === true;

  if (skipped) {
    return (
      <div className="space-y-3">
        <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-amber-900">
          <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
          <div>
            <div className="font-extrabold">לא נקלטה עדות מהמטופל</div>
            <div className="text-sm font-medium mt-1">
              המטופל התקדם במשימה ללא ציור, הקלטה או תשובה מובנית. יש לקבוע ציון לפי שיקול קליני ולתעד הערה.
            </div>
          </div>
        </div>
        <EvidenceDetails rawData={rawData} />
      </div>
    );
  }

  if (rawData?.audioSignedUrl) {
    return (
      <div className="space-y-3">
        <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3">
          <div className="text-sm font-bold text-gray-500 mb-2">הקלטת מטופל</div>
          <audio controls src={rawData.audioSignedUrl} className="w-full max-w-xl" />
        </div>
        <EvidenceDetails rawData={rawData} />
      </div>
    );
  }

  if (rawData?.audioId) {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-bold text-amber-800">
          <AlertTriangle className="w-5 h-5 shrink-0" />
          <span>קיימת הפניה להקלטה מקומית שלא הועלתה לשרת. בדיקות חדשות יעלו אודיו לסקירה.</span>
        </div>
        <EvidenceDetails rawData={rawData} />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm font-bold text-gray-600">
        עדות מובנית זמינה לסקירת קלינאי.
      </div>
      <EvidenceDetails rawData={rawData} />
    </div>
  );
}

function EvidenceDetails({ rawData }: { rawData: unknown }) {
  return (
    <details className="rounded-xl border border-gray-100 bg-white">
      <summary className="cursor-pointer px-4 py-3 text-sm font-bold text-gray-500">נתוני עדות גולמיים</summary>
      <pre className="max-h-40 overflow-auto border-t border-gray-100 p-4 text-xs text-gray-600 text-left direction-ltr">
        {JSON.stringify(rawData ?? {}, null, 2)}
      </pre>
    </details>
  );
}
