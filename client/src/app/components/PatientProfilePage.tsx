/* eslint-disable react-hooks/set-state-in-effect */
import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import {
  ChevronRight,
  Stethoscope,
  Hash,
  Plus,
  Loader2,
  Activity,
  Copy,
  FileText,
} from "lucide-react";
import { clsx } from "clsx";
import { supabase } from "../../lib/supabase";
import { OrderAssessmentModal } from "./OrderAssessmentModal";
import { StatusPill } from "./StatusPill";

interface PatientRecord {
  id: string;
  case_id: string | null;
  full_name: string;
  phone: string | null;
  date_of_birth: string | null;
  gender: "male" | "female" | null;
  language: string | null;
  dominant_hand: "right" | "left" | "ambidextrous" | null;
  education_years: number | null;
  created_at: string;
}

interface ScoringSummary {
  total_score: number | null;
  total_adjusted: number | null;
  needs_review: boolean;
  total_provisional: boolean | null;
}

interface PatientSession {
  id: string;
  case_id: string;
  status: "pending" | "in_progress" | "completed" | "awaiting_review";
  assessment_type: string | null;
  created_at: string;
  completed_at: string | null;
  access_code: string | null;
  scoring_reports: ScoringSummary | ScoringSummary[] | null;
}

function formatDate(iso: string | null): string {
  if (!iso) return "-";
  try {
    return new Date(iso).toLocaleDateString("he-IL");
  } catch {
    return "-";
  }
}

function reportScore(report: ScoringSummary | null | undefined): number | null {
  return report?.total_adjusted ?? report?.total_score ?? null;
}

function reportNeedsReview(report: ScoringSummary | null | undefined): boolean {
  if (!report) return false;
  return report.total_provisional ?? report.needs_review ?? false;
}

function relationArray<T>(value: T | T[] | null | undefined): T[] {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

function caseLabel(patient: PatientRecord): string {
  return patient.case_id?.trim() || patient.id.slice(0, 8);
}

function assessmentLabel(value: string | null): string {
  if ((value ?? "moca").toLowerCase() === "moca") return "MoCA";
  return value ?? "—";
}

function reviewActionLabel(status: PatientSession["status"]): string {
  if (status === "awaiting_review") return "סקור";
  if (status === "completed") return "צפה";
  return "פתח";
}

function sessionNeedsReview(session: PatientSession): boolean {
  return (
    session.status === "awaiting_review" ||
    relationArray(session.scoring_reports).some(reportNeedsReview)
  );
}

function scoreLabel(report: ScoringSummary | null | undefined): string {
  const score = reportScore(report);
  if (score == null) return "—";
  return reportNeedsReview(report) ? `${score}/30 (זמני)` : `${score}/30`;
}

function formatGender(value: PatientRecord["gender"]): string {
  if (value === "male") return "זכר";
  if (value === "female") return "נקבה";
  return "-";
}

function formatDominantHand(value: PatientRecord["dominant_hand"]): string {
  if (value === "right") return "ימין";
  if (value === "left") return "שמאל";
  if (value === "ambidextrous") return "שתי הידיים";
  return "-";
}

export function PatientProfilePage() {
  const { patientId } = useParams();
  const navigate = useNavigate();
  const [patient, setPatient] = useState<PatientRecord | null>(null);
  const [sessions, setSessions] = useState<PatientSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [orderOpen, setOrderOpen] = useState(false);
  const [copiedAccessCode, setCopiedAccessCode] = useState<string | null>(null);

  const loadPatient = useCallback(
    async (options?: { background?: boolean }) => {
      if (!patientId) return;
      const background = Boolean(options?.background);
      if (!background) setLoading(true);

      try {
        const { data: patientData, error: patientError } = await supabase
          .from("patients")
          .select(
            "id, case_id, full_name, phone, date_of_birth, gender, language, dominant_hand, education_years, created_at",
          )
          .eq("id", patientId)
          .maybeSingle();

        if (patientError || !patientData) {
          setNotFound(true);
          return;
        }

        setPatient(patientData as PatientRecord);

        const { data: sessionsData, error: sessionsError } = await supabase
          .from("sessions")
          .select(
            "id, case_id, status, assessment_type, created_at, completed_at, access_code, scoring_reports(total_adjusted, total_provisional, total_score, needs_review)",
          )
          .eq("patient_id", patientId)
          .order("created_at", { ascending: false });

        if (sessionsError) {
          console.error("Failed to fetch patient sessions", sessionsError);
          setSessions([]);
          return;
        }

        setSessions((sessionsData ?? []) as PatientSession[]);
      } catch (error) {
        console.error("Failed to load patient profile", error);
        setNotFound(true);
      } finally {
        if (!background) setLoading(false);
      }
    },
    [patientId],
  );

  useEffect(() => {
    loadPatient();
  }, [loadPatient]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-56px)] text-gray-500">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  if (notFound || !patient) {
    return (
      <div className="max-w-3xl mx-auto text-center py-24">
        <h1 className="text-3xl font-extrabold text-black mb-3">התיק לא נמצא</h1>
        <p className="text-gray-500 mb-6">ייתכן שהקישור שגוי או שאין לך גישה לרשומה.</p>
        <Link
          to="/dashboard"
          className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-black text-white font-bold"
        >
          חזרה לרשימת התיקים
        </Link>
      </div>
    );
  }

  const completedCount = sessions.filter((s) => s.status === "completed").length;
  const latestFinalScore = sessions
    .flatMap((s) => relationArray(s.scoring_reports))
    .filter((report) => !reportNeedsReview(report))
    .map(reportScore)
    .find((score) => score != null);
  const nextReviewSession = sessions.find(sessionNeedsReview) ?? null;

  const handlePrimaryAction = () => {
    if (nextReviewSession) {
      navigate(`/dashboard/session/${nextReviewSession.id}`);
      return;
    }
    setOrderOpen(true);
  };

  const copyAccessCode = async (event: React.MouseEvent, code: string) => {
    event.stopPropagation();
    try {
      await navigator.clipboard.writeText(code);
      setCopiedAccessCode(code);
      setTimeout(() => setCopiedAccessCode(null), 2000);
    } catch {
      setCopiedAccessCode(null);
    }
  };

  return (
    <div className="max-w-[1240px] mx-auto pb-12">
      <div className="mb-3">
        <Link
          to="/dashboard"
          className="text-gray-500 font-bold hover:text-black flex items-center gap-2 transition-colors w-fit"
        >
          <ChevronRight className="w-5 h-5" />
          <span>תיקים / {caseLabel(patient)}</span>
        </Link>
      </div>

      <div className="bg-white p-4 sm:p-5 rounded-xl border border-gray-200 shadow-sm mb-4">
        <div className="flex items-start justify-between gap-5 flex-wrap">
          <div className="flex items-center gap-4 min-w-0">
            <div className="w-12 h-12 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-extrabold text-lg shrink-0">
              {caseLabel(patient).trim()[0]?.toUpperCase() || "ת"}
            </div>
            <div className="min-w-0">
              <h1 className="text-xl font-extrabold text-black mb-1 truncate">
                תיק {caseLabel(patient)}
              </h1>
              <div className="flex gap-4 text-gray-500 font-bold text-sm flex-wrap">
                <span className="inline-flex items-center gap-2">
                  <Hash className="w-4 h-4" />
                  <span className="font-mono">{patient.id.slice(0, 8)}</span>
                </span>
              </div>
            </div>
          </div>

          <div className="flex flex-col items-stretch gap-2 sm:items-end">
            <button
              type="button"
              onClick={handlePrimaryAction}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-black px-3 font-bold text-white shadow-sm transition-colors hover:bg-gray-800"
            >
              {nextReviewSession ? (
                <FileText className="h-4 w-4" />
              ) : (
                <Stethoscope className="h-4 w-4" />
              )}
              {nextReviewSession ? "סקור מבדק" : "פתח מבדק"}
            </button>
          </div>
        </div>
      </div>

      <div className="grid gap-4 2xl:grid-cols-[minmax(0,1fr)_300px]">
        <section className="min-w-0 space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="bg-white border border-gray-200 rounded-xl p-3 shadow-sm">
              <div className="text-xs font-bold text-gray-500 mb-1">סה״כ מבדקים</div>
              <div className="text-xl font-extrabold text-black tabular-nums">
                {sessions.length}
              </div>
            </div>
            <div className="bg-white border border-gray-200 rounded-xl p-3 shadow-sm">
              <div className="text-xs font-bold text-gray-500 mb-1">הושלמו</div>
              <div className="text-xl font-extrabold text-black tabular-nums">{completedCount}</div>
            </div>
            <div className="bg-white border border-gray-200 rounded-xl p-3 shadow-sm">
              <div className="text-xs font-bold text-gray-500 mb-1">ציון MoCA סופי אחרון</div>
              <div className="text-xl font-extrabold text-black tabular-nums">
                {latestFinalScore != null ? `${latestFinalScore}/30` : "—"}
              </div>
            </div>
            <div className="bg-white border border-gray-200 rounded-xl p-3 shadow-sm">
              <div className="text-xs font-bold text-gray-500 uppercase mb-1">שנות לימוד</div>
              <div className="text-xl font-extrabold text-black tabular-nums">
                {patient.education_years ?? "—"}
              </div>
            </div>
          </div>

          <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
            <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-gray-100">
              <h2 className="text-base font-extrabold text-black">היסטוריית מבדקים</h2>
              {nextReviewSession && (
                <button
                  type="button"
                  onClick={() => setOrderOpen(true)}
                  className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 text-sm font-bold text-gray-800 transition-colors hover:bg-gray-50"
                >
                  <Plus className="h-4 w-4" />
                  מבדק חדש
                </button>
              )}
            </div>

            {sessions.length === 0 ? (
              <div className="px-6 py-12 text-center text-gray-500">
                <Activity className="w-8 h-8 mx-auto mb-3 text-gray-300" />
                עדיין לא נפתחו מבדקים לתיק זה. לחץ "פתח מבדק" כדי להתחיל.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[860px] text-right">
                  <thead className="bg-gray-50 text-xs uppercase tracking-wider text-gray-500 font-bold">
                    <tr>
                      <th className="px-4 py-2.5">מזהה</th>
                      <th className="px-4 py-2.5">סוג</th>
                      <th className="px-4 py-2.5">סטטוס</th>
                      <th className="px-4 py-2.5">ציון</th>
                      <th className="px-4 py-2.5">נפתח</th>
                      <th className="px-4 py-2.5">הושלם</th>
                      <th className="px-4 py-2.5">מספר</th>
                      <th className="px-4 py-2.5">סקירה</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sessions.map((s) => (
                      <tr
                        key={s.id}
                        onClick={() => navigate(`/dashboard/session/${s.id}`)}
                        className="border-b border-gray-100 last:border-b-0 hover:bg-gray-50 cursor-pointer transition-colors"
                      >
                        <td className="px-4 py-3 font-mono text-sm text-gray-700">{s.case_id}</td>
                        <td className="px-4 py-3 font-bold text-black">
                          {assessmentLabel(s.assessment_type)}
                        </td>
                        <td className="px-4 py-3">
                          <StatusPill status={s.status} />
                        </td>
                        <td className="px-4 py-3 font-extrabold tabular-nums text-black">
                          {scoreLabel(relationArray(s.scoring_reports)[0])}
                        </td>
                        <td className="px-4 py-3 text-gray-600 tabular-nums">
                          {formatDate(s.created_at)}
                        </td>
                        <td className="px-4 py-3 text-gray-600 tabular-nums">
                          {formatDate(s.completed_at)}
                        </td>
                        <td className="px-4 py-3">
                          {s.access_code ? (
                            <div className="inline-flex items-center gap-2">
                              <span className="font-mono text-gray-700 tabular-nums">
                                {s.access_code}
                              </span>
                              <button
                                type="button"
                                onClick={(event) => copyAccessCode(event, s.access_code!)}
                                className="inline-flex items-center gap-1 rounded-lg bg-gray-100 px-2 py-1 text-xs font-extrabold text-gray-700 hover:bg-gray-200"
                                aria-label="העתק מספר מבדק"
                              >
                                <Copy className="w-3.5 h-3.5" />
                                {copiedAccessCode === s.access_code ? "הועתק" : "העתק"}
                              </button>
                            </div>
                          ) : (
                            <span className="text-gray-400">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <Link
                            to={`/dashboard/session/${s.id}`}
                            onClick={(event) => event.stopPropagation()}
                            className={clsx(
                              "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-extrabold transition-colors",
                              s.status === "awaiting_review"
                                ? "bg-black text-white hover:bg-gray-800"
                                : "bg-gray-100 text-gray-800 hover:bg-gray-200",
                            )}
                          >
                            <FileText className="h-4 w-4" />
                            {reviewActionLabel(s.status)}
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </section>

        <aside className="space-y-4">
          <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-4">
            <h2 className="text-base font-extrabold text-black mb-3">פרטי רקע קליניים</h2>
            <div className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2 lg:grid-cols-5 2xl:grid-cols-1">
              <div>
                <div className="font-bold text-gray-500 mb-1">טלפון</div>
                <div className="font-mono text-gray-900">{patient.phone ?? "—"}</div>
              </div>
              <div>
                <div className="font-bold text-gray-500 mb-1">תאריך לידה</div>
                <div className="text-gray-900">{formatDate(patient.date_of_birth)}</div>
              </div>
              <div>
                <div className="font-bold text-gray-500 mb-1">מין</div>
                <div className="text-gray-900">{formatGender(patient.gender)}</div>
              </div>
              <div>
                <div className="font-bold text-gray-500 mb-1">שפה</div>
                <div className="text-gray-900">
                  {patient.language === "he" ? "עברית" : (patient.language ?? "—")}
                </div>
              </div>
              <div>
                <div className="font-bold text-gray-500 mb-1">יד דומיננטית</div>
                <div className="text-gray-900">{formatDominantHand(patient.dominant_hand)}</div>
              </div>
            </div>
          </div>
        </aside>
      </div>

      {orderOpen && (
        <OrderAssessmentModal
          open={orderOpen}
          onClose={() => setOrderOpen(false)}
          patient={{
            id: patient.id,
            case_id: patient.case_id,
            full_name: patient.full_name,
            phone: patient.phone,
            language: patient.language,
            education_years: patient.education_years,
            date_of_birth: patient.date_of_birth,
            gender: patient.gender,
            dominant_hand: patient.dominant_hand,
          }}
          onOrdered={() => {
            void loadPatient({ background: true });
          }}
        />
      )}
    </div>
  );
}
