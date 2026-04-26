/* eslint-disable @typescript-eslint/no-explicit-any */
import { AlertTriangle, CheckCircle2, ChevronRight, ClipboardCheck, Download, FileDown, Mic, Save } from "lucide-react";
import { Link, useParams } from "react-router";
import { supabase } from "../../lib/supabase";
import { clsx } from "clsx";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { DBScoringReport, Session as DBSession, TaskResult } from "../../types/database";

import { PlaybackCanvas } from "./PlaybackCanvas";
import { PlaybackAudio } from "./PlaybackAudio";
import {
  DRAWING_TAB_TO_TASK_ID,
  normalizeStrokes,
  SCORING_TAB_TO_TASK_ID,
  type ReviewTab,
} from "./clinicianReviewUtils";

interface PatientLite {
  id: string;
  case_id?: string | null;
  full_name: string;
}

interface DrawingReviewRow {
  id: string;
  task_id: string;
  task_name: string;
  signedUrl: string | null;
  strokes_data: any;
  rubric_items: any;
  clinician_score: number | null;
  clinician_notes: string | null;
}

interface ScoringReviewRow {
  id: string;
  item_id: string;
  task_type: string;
  max_score: number;
  raw_data: any;
  clinician_score: number | null;
  clinician_notes: string | null;
}

interface SessionWithPatient extends DBSession {
  patients?: PatientLite | PatientLite[] | null;
  task_results?: TaskResult[];
  drawings?: DrawingReviewRow[];
  scoring_reviews?: ScoringReviewRow[];
  audio_evidence_reviews?: ScoringReviewRow[];
  scoring_report?: DBScoringReport | null;
}

type RubricState = Record<ReviewTab, Record<string, boolean>>;

function formatDuration(startIso: string | null | undefined, endIso: string | null | undefined): string {
  if (!startIso || !endIso) return "—";
  const start = new Date(startIso).getTime();
  const end = new Date(endIso).getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return "—";
  const totalSec = Math.round((end - start) / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

const SUBSCORE_CAPS: Record<string, number> = {
  visuospatial: 5,
  naming: 3,
  attention: 6,
  language: 3,
  abstraction: 2,
  delayedRecall: 5,
  orientation: 6,
};

const REVIEW_TABS: Array<{ id: ReviewTab; label: string; kind: "drawing" | "manual" }> = [
  { id: "clock", label: "שעון", kind: "drawing" },
  { id: "cube", label: "קוביה", kind: "drawing" },
  { id: "trail", label: "מסלול", kind: "drawing" },
  { id: "memory", label: "זיכרון", kind: "manual" },
  { id: "digitSpan", label: "קיבולת זיכרון", kind: "manual" },
  { id: "serial7", label: "סדרת 7", kind: "manual" },
  { id: "language", label: "שפה", kind: "manual" },
  { id: "abstraction", label: "הפשטה", kind: "manual" },
  { id: "delayedRecall", label: "שליפה", kind: "manual" },
  { id: "orientation", label: "התמצאות", kind: "manual" },
];

const DEFAULT_RUBRICS: RubricState = {
  clock: { contour: true, numbers: false, hands: false },
  cube: { shape: false, lines: false, parallel: false },
  trail: { correct: false, noLinesCrossed: false },
  memory: { recall1: false, recall2: false, recall3: false, recall4: false, recall5: false },
  digitSpan: { forward: false, backward: false },
  serial7: { first: false, second: false, third: false, fourth: false, fifth: false },
  language: { sentence1: false, sentence2: false, fluency: false },
  abstraction: { train: false, watch: false },
  delayedRecall: { word1: false, word2: false, word3: false, word4: false, word5: false },
  orientation: { day: false, month: false, year: false, dayOfWeek: false, place: false, city: false },
};

function getReportTotal(report: DBScoringReport | null): number | null {
  return report?.total_adjusted ?? report?.total_score ?? null;
}

function getReportNeedsReview(report: DBScoringReport | null): boolean {
  if (!report) return false;
  return report.total_provisional ?? report.needs_review ?? false;
}

function getPendingReviewCount(report: DBScoringReport | null): number {
  if (!report) return 0;
  return report.pending_review_count ?? (getReportNeedsReview(report) ? 1 : 0);
}

function mergeEvidence(...items: Array<any | null | undefined>): any | null {
  const objects = items.filter((item) => item && typeof item === "object" && !Array.isArray(item));
  if (objects.length === 0) return null;
  return Object.assign({}, ...objects);
}

function hydrateSavedRubrics(current: RubricState, drawings: DrawingReviewRow[]): RubricState {
  let next = current;
  for (const drawing of drawings) {
    const tab = REVIEW_TABS.find((item) => DRAWING_TAB_TO_TASK_ID[item.id] === drawing.task_id)?.id;
    if (!tab || !drawing.rubric_items || typeof drawing.rubric_items !== "object" || Array.isArray(drawing.rubric_items)) {
      continue;
    }
    if (next === current) next = { ...current };
    next[tab] = {
      ...next[tab],
      ...(drawing.rubric_items as Record<string, boolean>),
    };
  }
  return next;
}

export function ClinicianDashboardDetail() {
  const { sessionId } = useParams();
  const [sessionRecord, setSessionRecord] = useState<SessionWithPatient | null>(null);
  const [reportRecord, setReportRecord] = useState<DBScoringReport | null>(null);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [reviewNotesByTab, setReviewNotesByTab] = useState<Partial<Record<ReviewTab, string>>>({});
  const [savingReview, setSavingReview] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [showPendingOnly, setShowPendingOnly] = useState(false);
  const [activeTab, setActiveTab] = useState<ReviewTab>("clock");
  const [rubrics, setRubrics] = useState<RubricState>(DEFAULT_RUBRICS);
  const [exportingCsv, setExportingCsv] = useState(false);
  const [csvExportMessage, setCsvExportMessage] = useState<{ kind: "success" | "error"; text: string } | null>(null);

  const loadDashboardSession = useCallback(async () => {
    if (!sessionId) return;

    const { data: authData } = await supabase.auth.getSession();
    const authSession = authData.session;
    if (!authSession) return;

    const res = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/get-session?sessionId=${encodeURIComponent(sessionId)}`,
      {
        headers: { Authorization: `Bearer ${authSession.access_token}` },
      },
    );

    if (!res.ok) return;
    const payload = await res.json();
    const loadedSession = payload.session as SessionWithPatient;
    setSessionRecord(loadedSession);
    setReportRecord(loadedSession.scoring_report ?? null);
    setRubrics((prev) => hydrateSavedRubrics(prev, loadedSession.drawings ?? []));
  }, [sessionId]);

  useEffect(() => {
    if (!sessionId) return;

    let cancelled = false;

    (async () => {
      await loadDashboardSession();
      const { data: logs } = await supabase
        .from("session_events")
        .select("*")
        .eq("session_id", sessionId)
        .order("created_at", { ascending: false });

      if (!cancelled && logs) {
        setAuditLogs(logs);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [loadDashboardSession, sessionId]);

  const patient: PatientLite | null = useMemo(() => {
    const raw = sessionRecord?.patients;
    if (!raw) return null;
    return Array.isArray(raw) ? raw[0] ?? null : raw;
  }, [sessionRecord]);

  const audioEvidenceByTaskType = useMemo(() => {
    const explicitEvidence = sessionRecord?.audio_evidence_reviews ?? [];
    const legacyEvidence = (sessionRecord?.scoring_reviews ?? []).filter((row) => row.max_score === 0);
    const byTaskType = new Map<string, ScoringReviewRow>();
    for (const review of [...explicitEvidence, ...legacyEvidence]) {
      if (typeof review.raw_data?.audioSignedUrl === "string") byTaskType.set(review.task_type, review);
    }
    return byTaskType;
  }, [sessionRecord]);

  const reviewQueue = useMemo(() => {
    const scoringReviews = (sessionRecord?.scoring_reviews ?? []).filter((row) => row.max_score > 0);
    return REVIEW_TABS.map((tab) => {
      const tabDrawingTaskId = DRAWING_TAB_TO_TASK_ID[tab.id];
      const tabScoringTaskId = SCORING_TAB_TO_TASK_ID[tab.id];
      const scoringReview = tabScoringTaskId
        ? scoringReviews.find((row) => row.item_id === tabScoringTaskId || row.task_type === tabScoringTaskId)
        : undefined;
      const evidenceReview = tabScoringTaskId ? audioEvidenceByTaskType.get(tabScoringTaskId) : undefined;
      const review = tabDrawingTaskId
        ? sessionRecord?.drawings?.find((row) => row.task_id === tabDrawingTaskId)
        : scoringReview ?? evidenceReview;
      const maxScore = tabDrawingTaskId ? (tab.id === "clock" ? 3 : 1) : scoringReview?.max_score ?? evidenceReview?.max_score;
      return {
        ...tab,
        review,
        maxScore,
        isEvidenceOnly: !tabDrawingTaskId && !scoringReview && !!evidenceReview,
        isReviewed: scoringReview ? scoringReview.clinician_score != null : !!evidenceReview || review?.clinician_score != null,
      };
    }).filter((tab) => !!tab.review);
  }, [audioEvidenceByTaskType, sessionRecord]);

  const pendingQueue = useMemo(() => reviewQueue.filter((tab) => !tab.isReviewed), [reviewQueue]);
  const completedQueue = useMemo(() => reviewQueue.filter((tab) => tab.isReviewed), [reviewQueue]);
  const visibleReviewTabs = showPendingOnly && pendingQueue.length > 0 ? pendingQueue : reviewQueue;
  const activeReviewTab = reviewQueue.some((tab) => tab.id === activeTab)
    ? activeTab
    : (pendingQueue[0] ?? reviewQueue[0])?.id ?? activeTab;

  const drawingTaskId = DRAWING_TAB_TO_TASK_ID[activeReviewTab];
  const scoringTaskId = SCORING_TAB_TO_TASK_ID[activeReviewTab];
  const currentDrawing = drawingTaskId
    ? sessionRecord?.drawings?.find((review) => review.task_id === drawingTaskId)
    : null;
  const currentTaskResult = [...(sessionRecord?.task_results ?? [])]
    .reverse()
    .find((result: any) => result.task_type === (drawingTaskId ?? scoringTaskId));
  const currentScoringReview = scoringTaskId
    ? sessionRecord?.scoring_reviews?.find((review) => review.max_score > 0 && (review.item_id === scoringTaskId || review.task_type === scoringTaskId))
    : null;
  const currentAudioEvidenceReview = scoringTaskId ? audioEvidenceByTaskType.get(scoringTaskId) ?? null : null;
  const currentEvidence = mergeEvidence(currentTaskResult?.raw_data, currentScoringReview?.raw_data, currentAudioEvidenceReview?.raw_data);
  const currentStrokes = normalizeStrokes(currentDrawing?.strokes_data ?? currentTaskResult?.raw_data);
  const currentImageUrl = currentDrawing?.signedUrl ?? null;
  const currentAudioUrl = typeof currentEvidence?.audioSignedUrl === "string" ? currentEvidence.audioSignedUrl : null;
  const currentReview = currentDrawing ?? currentScoringReview ?? currentAudioEvidenceReview;
  const isCurrentEvidenceOnly = !currentDrawing && !currentScoringReview && !!currentAudioEvidenceReview;
  const reviewNotes = reviewNotesByTab[activeReviewTab] ?? currentReview?.clinician_notes ?? "";

  const getDrawingStats = (strokes: any[][]) => {
    const valid = (strokes || []).filter((s) => s && s.length > 0);
    if (valid.length === 0) return { count: 0, duration: "0s", usedPen: false };

    const firstPoint = valid[0][0];
    const lastStroke = valid[valid.length - 1];
    const lastPoint = lastStroke[lastStroke.length - 1];
    const durationMs = lastPoint.time - firstPoint.time;
    const duration = durationMs > 0 ? (durationMs / 1000).toFixed(1) + "s" : "0s";
    const usedPen = valid.some((s) => s.some((pt) => pt.pointerType === "pen"));

    return { count: valid.length, duration, usedPen };
  };

  const currentStats = getDrawingStats(currentStrokes);

  const toggleRubric = (key: string) => {
    setSaveMessage(null);
    setRubrics((prev) => ({
      ...prev,
      [activeReviewTab]: {
        ...prev[activeReviewTab],
        [key]: !prev[activeReviewTab][key],
      },
    }));
  };

  const getRubricData = () => {
    if (activeReviewTab === "clock") {
      return {
        max: 3,
        score:
          (rubrics.clock.contour ? 1 : 0) + (rubrics.clock.numbers ? 1 : 0) + (rubrics.clock.hands ? 1 : 0),
        items: [
          { id: "contour", label: "מתאר", desc: "המעגל סגור ופרופורציונלי" },
          { id: "numbers", label: "מספרים", desc: "כל המספרים נמצאים במיקום הנכון" },
          { id: "hands", label: "מחוגים", desc: "השעה 11:10 בדיוק" },
        ],
      };
    } else if (activeReviewTab === "cube") {
      return {
        max: 1,
        score: rubrics.cube.shape && rubrics.cube.lines && rubrics.cube.parallel ? 1 : 0,
        items: [
          { id: "shape", label: "תלת מימד", desc: "הצורה היא תלת מימדית" },
          { id: "lines", label: "כל הקווים מצוירים", desc: "כל הקווים הפנימיים קיימים" },
          { id: "parallel", label: "קווים מקבילים", desc: "הקווים מקבילים פחות או יותר" },
        ],
      };
    } else if (activeReviewTab === "trail") {
      return {
        max: 1,
        score: rubrics.trail.correct && rubrics.trail.noLinesCrossed ? 1 : 0,
        items: [
          { id: "correct", label: "סדר נכון", desc: "מתח קו מ-1 ל-א, ל-2 וכו' עד ה" },
          { id: "noLinesCrossed", label: "קווים לא נחתכים", desc: "המסלול לא חותך את עצמו" },
        ],
      };
    } else if (activeReviewTab === "memory") {
      return {
        max: 0,
        score: 0,
        items: [
          { id: "recall1", label: "פנים", desc: "הנבדק חזר על המילה" },
          { id: "recall2", label: "קטיפה", desc: "הנבדק חזר על המילה" },
          { id: "recall3", label: "כנסייה", desc: "הנבדק חזר על המילה" },
          { id: "recall4", label: "חרצית", desc: "הנבדק חזר על המילה" },
          { id: "recall5", label: "אדום", desc: "הנבדק חזר על המילה" },
        ],
      };
    } else if (activeReviewTab === "digitSpan") {
      return {
        max: 2,
        score: (rubrics.digitSpan.forward ? 1 : 0) + (rubrics.digitSpan.backward ? 1 : 0),
        items: [
          { id: "forward", label: "2-1-8-5-4 קדימה", desc: "חזר על הסדרה בסדר מדויק" },
          { id: "backward", label: "7-4-2 אחורה", desc: "חזר על הסדרה בסדר הפוך מדויק" },
        ],
      };
    } else if (activeReviewTab === "serial7") {
      return {
        max: 3,
        score: Object.values(rubrics.serial7).filter((v) => v).length,
        items: [
          { id: "first", label: "93", desc: "תשובה ראשונה נכונה" },
          { id: "second", label: "86", desc: "תשובה שנייה נכונה" },
          { id: "third", label: "79", desc: "תשובה שלישית נכונה" },
          { id: "fourth", label: "72", desc: "תשובה רביעית נכונה" },
          { id: "fifth", label: "65", desc: "תשובה חמישית נכונה" },
        ],
      };
    } else if (activeReviewTab === "language") {
      return {
        max: 3,
        score:
          (rubrics.language.sentence1 ? 1 : 0) + (rubrics.language.sentence2 ? 1 : 0) + (rubrics.language.fluency ? 1 : 0),
        items: [
          { id: "sentence1", label: "משפט 1", desc: "חזר על המשפט בדיוק רב" },
          { id: "sentence2", label: "משפט 2", desc: "חזר על המשפט בדיוק רב" },
          { id: "fluency", label: "שטף מילולי", desc: "מנה מעל 11 מילים" },
        ],
      };
    } else if (activeReviewTab === "abstraction") {
      return {
        max: 2,
        score: (rubrics.abstraction.train ? 1 : 0) + (rubrics.abstraction.watch ? 1 : 0),
        items: [
          { id: "train", label: "רכבת/אופניים", desc: "אמצעי תחבורה / כלי רכב" },
          { id: "watch", label: "שעון/סרגל", desc: "כלי מדידה" },
        ],
      };
    } else if (activeReviewTab === "delayedRecall") {
      return {
        max: 5,
        score: Object.values(rubrics.delayedRecall).filter((v) => v).length,
        items: [
          { id: "word1", label: "פנים", desc: "נזכר ספונטנית" },
          { id: "word2", label: "קטיפה", desc: "נזכר ספונטנית" },
          { id: "word3", label: "כנסייה", desc: "נזכר ספונטנית" },
          { id: "word4", label: "חרצית", desc: "נזכר ספונטנית" },
          { id: "word5", label: "אדום", desc: "נזכר ספונטנית" },
        ],
      };
    } else {
      return {
        max: 6,
        score: Object.values(rubrics.orientation).filter((v) => v).length,
        items: [
          { id: "day", label: "יום בחודש", desc: "תאריך מדויק" },
          { id: "month", label: "חודש", desc: "חודש מדויק" },
          { id: "year", label: "שנה", desc: "שנה מדויקה" },
          { id: "dayOfWeek", label: "יום בשבוע", desc: "היום המדויק" },
          { id: "place", label: "מקום/מוסד", desc: "שם המוסד/מקום" },
          { id: "city", label: "עיר", desc: "העיר הנכונה" },
        ],
      };
    }
  };

  const rubricData = getRubricData();

  const handleSaveReview = async () => {
    if (!currentReview) return;
    const nextPendingTab = pendingQueue.find((tab) => tab.id !== activeReviewTab)?.id ?? null;

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      alert("יש להתחבר כקלינאי כדי לשמור ניקוד.");
      return;
    }

    setSavingReview(true);
    setSaveMessage(null);

    const endpoint = currentDrawing ? "update-drawing-review" : "update-scoring-review";
    const body = currentDrawing
      ? {
          reviewId: currentDrawing.id,
          clinicianScore: rubricData.score,
          rubricItems: rubrics[activeReviewTab],
          clinicianNotes: reviewNotes,
        }
      : {
          reviewId: currentScoringReview?.id,
          clinicianScore: Math.min(rubricData.score, currentScoringReview?.max_score ?? rubricData.max),
          clinicianNotes: reviewNotes,
        };

    const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/${endpoint}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify(body),
    });

    setSavingReview(false);

    if (!res.ok) {
      let message = "שמירת הניקוד נכשלה.";
      try {
        const payload = await res.json();
        if (payload?.error) message = payload.error;
      } catch {
        // Keep localized fallback for non-JSON errors.
      }
      setSaveMessage(message);
      return;
    }

    setSaveMessage("הניקוד נשמר.");
    await loadDashboardSession();
    if (nextPendingTab) setActiveTab(nextPendingTab);
  };

  const summary = useMemo(() => {
    const subscores: Record<string, number | null> = (reportRecord?.subscores ?? {}) as Record<
      string,
      number | null
    >;

    const pill = (raw: number | null, cap: number): { value: string; color: "warn" | "pass" | "neutral" } => {
      if (raw == null) return { value: "—", color: "neutral" };
      const pct = raw / cap;
      return {
        value: `${raw}/${cap}`,
        color: pct >= 0.8 ? "pass" : pct >= 0.5 ? "neutral" : "warn",
      };
    };

    const total = getReportTotal(reportRecord);
    const totalPill = pill(total, 30);

    return [
      { label: "סך הכל MoCA", ...totalPill },
      { label: "מרחבי-חזותי", ...pill(subscores.visuospatial ?? null, SUBSCORE_CAPS.visuospatial) },
      { label: "שיום", ...pill(subscores.naming ?? null, SUBSCORE_CAPS.naming) },
      { label: "זכירה מושהית", ...pill(subscores.delayedRecall ?? null, SUBSCORE_CAPS.delayedRecall) },
      { label: "קשב", ...pill(subscores.attention ?? null, SUBSCORE_CAPS.attention) },
      {
        label: "משך זמן",
        value: formatDuration(sessionRecord?.started_at ?? null, sessionRecord?.completed_at ?? null),
        color: "neutral" as const,
      },
    ];
  }, [reportRecord, sessionRecord]);

  const renderTaskContent = () => {
    if (!currentReview) {
      return (
        <div className="flex min-h-[360px] w-full flex-col items-center justify-center rounded-xl border border-dashed border-gray-200 bg-gray-50 p-8 text-center">
          <ClipboardCheck className="mb-4 h-10 w-10 text-gray-400" />
          <h3 className="text-xl font-extrabold text-black">אין פריט סקירה למשימה הזו</h3>
          <p className="mt-2 max-w-md text-sm font-bold text-gray-500">
            פריטי סקירה ועדויות קוליות נוצרים אחרי שהמטופל מסיים את המבחן.
          </p>
        </div>
      );
    }

    if (["clock", "cube", "trail"].includes(activeReviewTab)) {
      return (
        <div className="flex flex-col items-center">
          <PlaybackCanvas strokes={currentStrokes} width={450} height={400} backgroundImageUrl={currentImageUrl ?? undefined} />

          <div className="mt-8 w-full border-t border-gray-100 pt-6">
            <h4 className="font-bold text-gray-500 text-sm mb-3">סטטיסטיקת ציור</h4>
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-gray-50 p-4 rounded-xl text-center">
                <div className="text-xs font-bold text-gray-500 mb-1">מספר משיכות</div>
                <div className="text-2xl font-extrabold tabular-nums text-black">{currentStats.count}</div>
              </div>
              <div className="bg-gray-50 p-4 rounded-xl text-center">
                <div className="text-xs font-bold text-gray-500 mb-1">משך זמן ברוטו</div>
                <div className="text-2xl font-extrabold tabular-nums text-black">{currentStats.duration}</div>
              </div>
              <div className="bg-gray-50 p-4 rounded-xl text-center">
                <div className="text-xs font-bold text-gray-500 mb-1">מגע לעומת עט</div>
                <div className="text-2xl font-extrabold tabular-nums text-blue-600">
                  {currentStats.usedPen ? "עט חכם" : "אצבע/עכבר"}
                </div>
              </div>
            </div>
          </div>
        </div>
      );
    } else {
      return (
        <div className="flex flex-col items-center w-full min-h-[400px] justify-center">
          <div className="w-20 h-20 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mb-8 shadow-sm">
            <Mic className="w-10 h-10" />
          </div>
          <h3 className="text-2xl font-extrabold text-black mb-10">האזן להקלטת המטופל</h3>

          <PlaybackAudio audioId={currentAudioUrl} />
          {currentEvidence && (
            <pre dir="ltr" className="mt-6 w-full max-h-56 overflow-auto rounded-xl border border-gray-200 bg-gray-50 p-4 text-left text-xs text-gray-700">
              {JSON.stringify(currentEvidence, null, 2)}
            </pre>
          )}
        </div>
      );
    }
  };

  const handlePdfExport = async () => {
    if (!sessionId) return;
    if (sessionRecord?.status !== "completed" || getReportNeedsReview(reportRecord) || getPendingReviewCount(reportRecord) > 0) {
      alert("ניתן לייצא PDF לאחר השלמת הסקירה הקלינית.");
      return;
    }

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      alert("יש להתחבר כקלינאי כדי לייצא דוח.");
      return;
    }

    const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/export-pdf`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ sessionId }),
    });

    if (!res.ok) {
      let message = "ייצוא PDF נכשל.";
      try {
        const payload = await res.json();
        if (payload?.error) message = payload.error;
      } catch {
        // Keep the localized fallback for non-JSON errors.
      }
      alert(message);
      return;
    }

    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `report_${sessionRecord?.case_id || sessionId}.pdf`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(url);
  };

  const handleCsvExport = async () => {
    if (exportingCsv) return;
    setExportingCsv(true);
    setCsvExportMessage(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error("יש להתחבר כקלינאי כדי לייצא CSV.");
      }

      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/export-csv`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
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
      if (blob.size === 0) {
        throw new Error("קובץ ה-CSV שהתקבל ריק.");
      }

      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "moca_export.csv";
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      setCsvExportMessage({ kind: "success", text: "CSV ירד בהצלחה." });
    } catch (error) {
      console.error(error);
      const message = error instanceof Error ? error.message : "ייצוא CSV נכשל.";
      setCsvExportMessage({ kind: "error", text: message });
    } finally {
      setExportingCsv(false);
    }
  };

  const breadcrumbTo = patient ? `/dashboard/patient/${patient.id}` : "/dashboard";
  const patientCaseLabel = patient?.case_id ?? patient?.full_name;
  const breadcrumbLabel = patientCaseLabel ? `תיקים / ${patientCaseLabel} / מבחן` : "תיקים / מבחן";
  const reportNeedsReview = getReportNeedsReview(reportRecord);
  const canExportPdf =
    sessionRecord?.status === "completed" && !reportNeedsReview && getPendingReviewCount(reportRecord) === 0;
  const reportPendingReviewCount = getPendingReviewCount(reportRecord);
  const pendingReviewCount = pendingQueue.length || reportPendingReviewCount;
  const reviewTabsForDisplay = visibleReviewTabs.length > 0
    ? visibleReviewTabs
    : REVIEW_TABS.map((tab) => ({ ...tab, review: null, maxScore: undefined, isEvidenceOnly: false, isReviewed: false }));
  const exportBlockReason = canExportPdf
    ? "הדוח מוכן לייצוא"
    : pendingReviewCount > 0
    ? `נותרו ${pendingReviewCount} מסכי סקירה`
    : "ניתן לייצא לאחר השלמת הסקירה";

  return (
    <div className="max-w-6xl mx-auto pb-20">
      <div className="mb-6">
        <Link
          to={breadcrumbTo}
          className="text-gray-500 font-bold hover:text-black flex items-center gap-2 transition-colors w-fit"
        >
          <ChevronRight className="w-5 h-5" />
          <span>{breadcrumbLabel}</span>
        </Link>
      </div>

      <div className="mb-8 flex flex-col gap-6 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm sm:p-8 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex min-w-0 gap-4 sm:gap-6 items-center">
          <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-blue-100 text-2xl font-extrabold text-blue-700 sm:h-20 sm:w-20 sm:text-3xl">
            {(patientCaseLabel?.trim()[0] ?? sessionRecord?.case_id?.trim()[0] ?? "ת").toUpperCase()}
          </div>
          <div className="min-w-0">
            <h1 className="mb-2 truncate text-2xl font-extrabold text-black sm:text-3xl">
              {patientCaseLabel ? `תיק ${patientCaseLabel}` : sessionRecord?.case_id ? `תיק ${sessionRecord.case_id}` : "תיק"}
            </h1>
            <div className="flex flex-wrap items-center gap-3 text-base font-medium text-gray-500 sm:gap-4 sm:text-lg">
              {sessionRecord?.case_id && (
                <span className="font-mono bg-gray-100 px-2 py-0.5 rounded-md">{sessionRecord.case_id}</span>
              )}
              <span>
                {sessionRecord?.age_band ? `קבוצת גיל ${sessionRecord.age_band}` : "קבוצת גיל לא זמינה"}
              </span>
              <span>
                {sessionRecord?.created_at
                  ? `נוצר בתאריך ${new Date(sessionRecord.created_at).toLocaleDateString("he-IL")}`
                  : "תאריך לא זמין"}
              </span>
              <span
                className={clsx(
                  "inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-bold",
                  reportNeedsReview
                    ? "bg-amber-100 text-amber-800"
                    : sessionRecord?.status === "completed"
                    ? "bg-green-100 text-green-800"
                    : "bg-blue-100 text-blue-800",
                )}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-current" />
                {reportNeedsReview
                  ? "בבדיקה"
                  : sessionRecord?.status === "completed"
                  ? "הושלם"
                  : sessionRecord?.status === "in_progress"
                  ? "בתהליך"
                  : "הוזמן"}
              </span>
            </div>
          </div>
        </div>

        <div className="flex flex-col items-stretch gap-2 sm:items-end">
          <div className="flex flex-wrap gap-3 sm:gap-4">
            <button
              onClick={handlePdfExport}
              disabled={!canExportPdf}
              className={clsx(
                "flex items-center gap-2 px-6 py-3 rounded-xl font-bold bg-white border-2 border-gray-200 transition-colors text-black",
                canExportPdf ? "hover:border-black" : "opacity-50 cursor-not-allowed",
              )}
            >
              <FileDown className="w-5 h-5" />
              <span>PDF</span>
            </button>
            <button
              onClick={handleCsvExport}
              disabled={exportingCsv}
              className={clsx(
                "flex items-center gap-2 px-6 py-3 rounded-xl font-bold bg-white border-2 border-gray-200 transition-colors text-black",
                exportingCsv ? "cursor-wait opacity-60" : "hover:border-black",
              )}
            >
              <Download className="w-5 h-5" />
              <span>{exportingCsv ? "מייצא..." : "CSV"}</span>
            </button>
          </div>
          {csvExportMessage && (
            <p
              role={csvExportMessage.kind === "error" ? "alert" : "status"}
              className={clsx(
                "max-w-xs text-right text-sm font-bold",
                csvExportMessage.kind === "error" ? "text-red-700" : "text-green-700",
              )}
            >
              {csvExportMessage.text}
            </p>
          )}
        </div>
      </div>

      <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-6">
        {summary.map((item, i) => (
          <div
            key={i}
            className="flex flex-col items-center justify-center rounded-2xl border border-gray-200 bg-white p-5 text-center shadow-sm sm:p-6"
          >
            <div className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-2">{item.label}</div>
            <div
              className={clsx(
                "text-3xl font-extrabold tabular-nums",
                item.color === "warn" ? "text-red-600" : item.color === "pass" ? "text-green-600" : "text-black",
              )}
            >
              {item.value}
            </div>
          </div>
        ))}
      </div>

      <div className="mb-6 mt-12 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-900 text-white">
              <ClipboardCheck className="h-6 w-6" />
            </div>
            <div>
              <h2 className="text-xl font-extrabold text-black">סקירה קלינית</h2>
              <p className="text-sm font-bold text-gray-500">
                {reviewQueue.length > 0
                  ? `${pendingQueue.length} ממתינים · ${completedQueue.length} נשמרו · ${reviewQueue.length} מסכי סקירה`
                  : "אין פריטי סקירה מוכנים להצגה"}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <span
              className={clsx(
                "inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-extrabold",
                canExportPdf ? "bg-green-50 text-green-800" : "bg-amber-50 text-amber-800",
              )}
            >
              {canExportPdf ? <CheckCircle2 className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
              {exportBlockReason}
            </span>
            <button
              type="button"
              onClick={() => setShowPendingOnly((value) => !value)}
              disabled={pendingQueue.length === 0}
              className={clsx(
                "rounded-xl border px-4 py-2 text-sm font-extrabold transition-colors",
                showPendingOnly
                  ? "border-black bg-black text-white"
                  : "border-gray-200 bg-white text-gray-700 hover:border-gray-400",
                pendingQueue.length === 0 && "cursor-not-allowed opacity-50",
              )}
            >
              {showPendingOnly ? "הצג הכל" : "הצג ממתינים"}
            </button>
          </div>
        </div>

        <div className="mt-5 flex items-stretch gap-3 overflow-x-auto pb-1 scrollbar-hide">
          {reviewTabsForDisplay.map((tab) => {
            const isActive = activeReviewTab === tab.id;
            const score = tab.review?.clinician_score;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={clsx(
                  "min-w-[132px] rounded-xl border p-3 text-right transition-colors sm:min-w-[150px] sm:p-4",
                  isActive
                    ? "border-black bg-black text-white"
                    : tab.isReviewed
                    ? "border-green-200 bg-green-50 text-green-950 hover:border-green-300"
                    : tab.review
                    ? "border-amber-200 bg-amber-50 text-amber-950 hover:border-amber-300"
                    : "border-gray-200 bg-gray-50 text-gray-500 hover:border-gray-300",
                )}
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="text-base font-extrabold">{tab.label}</span>
                  {tab.isReviewed ? (
                    <CheckCircle2 className="h-5 w-5 flex-shrink-0" />
                  ) : tab.review ? (
                    <AlertTriangle className="h-5 w-5 flex-shrink-0" />
                  ) : null}
                </div>
                <div className={clsx("mt-2 text-xs font-bold", isActive ? "text-white/75" : "text-current/70")}>
                  {tab.isEvidenceOnly
                    ? "עדות קולית"
                    : tab.isReviewed
                    ? `נשמר ${score}/${tab.maxScore ?? "?"}`
                    : tab.review
                    ? "ממתין לניקוד"
                    : "אין פריט סקירה"}
                </div>
              </button>
            );
          })}
        </div>

      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 lg:gap-8">
        <div className="flex flex-col items-center justify-center rounded-2xl border border-gray-200 bg-white p-4 shadow-sm sm:p-8 lg:col-span-7">
          {renderTaskContent()}
        </div>

        <div className="flex flex-col rounded-2xl border border-gray-200 bg-gray-50 p-4 shadow-sm sm:p-8 lg:col-span-5">
          <div className="mb-8 flex items-center justify-between border-b border-gray-200 pb-4">
            <h3 className="text-2xl font-extrabold text-black">ניקוד</h3>
            <div className="text-3xl font-extrabold tabular-nums bg-white px-4 py-2 rounded-xl shadow-sm border border-gray-200">
              <span className="text-black">{rubricData.score}</span>
              <span className="text-gray-400">/{rubricData.max}</span>
            </div>
          </div>

          {currentDrawing?.clinician_score != null && (
            <div className="mb-4 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm font-bold text-green-800">
              ניקוד שמור: {currentDrawing.clinician_score}/{rubricData.max}
            </div>
          )}
          {!currentDrawing && currentScoringReview?.clinician_score != null && (
            <div className="mb-4 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm font-bold text-green-800">
              ניקוד שמור: {currentScoringReview.clinician_score}/{currentScoringReview.max_score}
            </div>
          )}

          <div className="space-y-3 mb-8 flex-1">
            {isCurrentEvidenceOnly ? (
              <div className="rounded-xl border border-blue-100 bg-blue-50 p-5 text-sm font-bold text-blue-950">
                עדות קולית בלבד למשימה זו. אין פריט ניקוד ידני לשמירה במסך זה.
              </div>
            ) : rubricData.items.map((crit) => {
              const isChecked = rubrics[activeReviewTab][crit.id];
              return (
                <div
                  key={crit.id}
                  onClick={() => toggleRubric(crit.id)}
                  className={clsx(
                    "flex gap-4 p-5 rounded-xl cursor-pointer transition-all border-2",
                    isChecked ? "bg-[#ecfdf5] border-green-200" : "bg-white border-transparent hover:border-gray-200",
                  )}
                >
                  <div
                    className={clsx(
                      "mt-1 w-6 h-6 rounded flex items-center justify-center flex-shrink-0 transition-colors",
                      isChecked ? "bg-green-600 text-white" : "bg-gray-200 text-transparent",
                    )}
                  >
                    <CheckCircle2 className="w-5 h-5" />
                  </div>
                  <div>
                    <div className={clsx("font-bold text-lg", isChecked ? "text-green-900" : "text-black")}>
                      {crit.label}
                    </div>
                    <div className={clsx("text-sm mt-1", isChecked ? "text-green-700" : "text-gray-500")}>
                      {crit.desc}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div>
            <label className="block text-sm font-bold text-gray-500 mb-2">הערות</label>
            <textarea
              value={reviewNotes}
              onChange={(event) => {
                setSaveMessage(null);
                setReviewNotesByTab((prev) => ({ ...prev, [activeReviewTab]: event.target.value }));
              }}
              placeholder="הוסף הערה קלינית…"
              className="w-full h-32 p-4 bg-white border border-gray-200 rounded-xl resize-none text-lg focus:outline-none focus:ring-4 focus:ring-blue-600 focus:border-blue-600 transition-all"
            />
            <div className="mt-4 flex items-center justify-between gap-3">
              <button
                onClick={handleSaveReview}
                disabled={savingReview || isCurrentEvidenceOnly || (!currentDrawing && !currentScoringReview)}
                className={clsx(
                  "inline-flex items-center gap-2 rounded-xl px-5 py-3 font-bold text-white transition-colors",
                  savingReview || isCurrentEvidenceOnly || (!currentDrawing && !currentScoringReview)
                    ? "bg-gray-300 cursor-not-allowed"
                    : "bg-black hover:bg-gray-800",
                )}
              >
                <Save className="h-5 w-5" />
                {savingReview ? "שומר..." : "שמור ניקוד"}
              </button>
              {saveMessage && <div className="text-sm font-bold text-gray-600">{saveMessage}</div>}
            </div>
          </div>
        </div>
      </div>

      <div className="mt-12 bg-white rounded-xl p-6 border border-gray-200">
        <h3 className="text-xl font-bold mb-4">יומן אירועים (Audit Log)</h3>
        <div className="text-sm font-mono text-gray-500 max-h-64 overflow-y-auto space-y-2">
          {auditLogs.length === 0 ? (
            <div className="text-gray-400">אין אירועים להצגה.</div>
          ) : (
            auditLogs.map((log: any) => (
              <div key={log.id} className="border-b pb-2 flex items-center justify-between">
                <div>
                  <span className="font-bold">{new Date(log.created_at).toLocaleString()}</span> -
                  <span className="text-blue-600 ml-2">{log.event_type}</span>
                </div>
                <div className="text-xs text-gray-400">{log.actor_id ? "מטפל" : "מטופל"}</div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
