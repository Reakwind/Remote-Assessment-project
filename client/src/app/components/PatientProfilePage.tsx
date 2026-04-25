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
} from "lucide-react";
import { clsx } from "clsx";
import { supabase } from "../../lib/supabase";
import { OrderAssessmentModal } from "./OrderAssessmentModal";

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
  scoring_reports: ScoringSummary[] | null;
}

const STATUS_LABELS: Record<PatientSession["status"], string> = {
  pending: "הוזמן",
  in_progress: "בתהליך",
  completed: "הושלם",
  awaiting_review: "בבדיקה",
};

const STATUS_COLORS: Record<PatientSession["status"], string> = {
  pending: "bg-blue-100 text-blue-800",
  in_progress: "bg-amber-100 text-amber-800",
  completed: "bg-green-100 text-green-800",
  awaiting_review: "bg-amber-100 text-amber-800",
};

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

function caseLabel(patient: PatientRecord): string {
  return patient.case_id || patient.full_name;
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

  const loadPatient = useCallback(async () => {
    if (!patientId) return;
    setLoading(true);

    const { data: patientData, error: patientError } = await supabase
      .from("patients")
      .select("id, case_id, full_name, phone, date_of_birth, gender, language, dominant_hand, education_years, created_at")
      .eq("id", patientId)
      .maybeSingle();

    if (patientError || !patientData) {
      setNotFound(true);
      setLoading(false);
      return;
    }

    setPatient(patientData as PatientRecord);

    const { data: sessionsData } = await supabase
      .from("sessions")
      .select(
        "id, case_id, status, assessment_type, created_at, completed_at, access_code, scoring_reports(total_adjusted, total_provisional, total_score, needs_review)",
      )
      .eq("patient_id", patientId)
      .order("created_at", { ascending: false });

    setSessions((sessionsData ?? []) as PatientSession[]);
    setLoading(false);
  }, [patientId]);

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
        <Link to="/dashboard" className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-black text-white font-bold">
          חזרה לרשימת התיקים
        </Link>
      </div>
    );
  }

  const completedCount = sessions.filter((s) => s.status === "completed").length;
  const latestScore = sessions
    .flatMap((s) => s.scoring_reports ?? [])
    .map(reportScore)
    .find((score) => score != null);

  return (
    <div className="max-w-6xl mx-auto pb-20">
      <div className="mb-6">
        <Link
          to="/dashboard"
          className="text-gray-500 font-bold hover:text-black flex items-center gap-2 transition-colors w-fit"
        >
          <ChevronRight className="w-5 h-5" />
          <span>תיקים / {caseLabel(patient)}</span>
        </Link>
      </div>

      <div className="bg-white p-8 rounded-2xl border border-gray-200 shadow-sm mb-8">
        <div className="flex items-start justify-between gap-6 flex-wrap">
          <div className="flex items-center gap-6 min-w-0">
            <div className="w-20 h-20 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-extrabold text-3xl shrink-0">
              {caseLabel(patient).trim()[0]?.toUpperCase() || "ת"}
            </div>
            <div className="min-w-0">
              <h1 className="text-3xl font-extrabold text-black mb-2 truncate">תיק {caseLabel(patient)}</h1>
              <div className="flex gap-5 text-gray-500 font-medium flex-wrap">
                <span className="inline-flex items-center gap-2">
                  <Hash className="w-4 h-4" />
                  <span className="font-mono">{patient.id.slice(0, 8)}</span>
                </span>
              </div>
            </div>
          </div>

          <button
            onClick={() => setOrderOpen(true)}
            className="inline-flex items-center gap-2 bg-black text-white px-6 py-3 rounded-xl font-bold hover:bg-gray-800 transition-colors shadow-md"
          >
            <Stethoscope className="w-5 h-5" />
            פתיחת מבחן
          </button>
      </div>

      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm">
          <div className="text-xs font-bold text-gray-500 uppercase mb-1">סה"כ מבחנים</div>
          <div className="text-3xl font-extrabold text-black tabular-nums">{sessions.length}</div>
        </div>
        <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm">
          <div className="text-xs font-bold text-gray-500 uppercase mb-1">הושלמו</div>
          <div className="text-3xl font-extrabold text-black tabular-nums">{completedCount}</div>
        </div>
        <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm">
          <div className="text-xs font-bold text-gray-500 uppercase mb-1">ציון MoCA אחרון</div>
          <div className="text-3xl font-extrabold text-black tabular-nums">
            {latestScore != null ? `${latestScore}/30` : "—"}
          </div>
        </div>
        <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm">
          <div className="text-xs font-bold text-gray-500 uppercase mb-1">שנות לימוד</div>
          <div className="text-3xl font-extrabold text-black tabular-nums">{patient.education_years ?? "—"}</div>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-2xl shadow-sm p-5 mb-8">
        <h2 className="text-lg font-extrabold text-black mb-4">פרטי רקע קליניים</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
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
            <div className="text-gray-900">{patient.language === "he" ? "עברית" : patient.language ?? "—"}</div>
          </div>
          <div>
            <div className="font-bold text-gray-500 mb-1">יד דומיננטית</div>
            <div className="text-gray-900">{formatDominantHand(patient.dominant_hand)}</div>
          </div>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-xl font-extrabold text-black">היסטוריית מבחנים</h2>
          <button
            onClick={() => setOrderOpen(true)}
            className="inline-flex items-center gap-1.5 text-sm font-bold text-blue-700 hover:text-blue-900"
          >
            <Plus className="w-4 h-4" />
            מבחן חדש
          </button>
        </div>

        {sessions.length === 0 ? (
          <div className="px-6 py-12 text-center text-gray-500">
            <Activity className="w-8 h-8 mx-auto mb-3 text-gray-300" />
	            עדיין לא נפתחו מבחנים לתיק זה.
          </div>
        ) : (
          <table className="w-full text-right">
            <thead className="bg-gray-50 text-xs uppercase tracking-wider text-gray-500 font-bold">
              <tr>
                <th className="px-6 py-3">מזהה</th>
                <th className="px-6 py-3">סוג</th>
                <th className="px-6 py-3">סטטוס</th>
                <th className="px-6 py-3">ציון</th>
                <th className="px-6 py-3">נפתח</th>
                <th className="px-6 py-3">הושלם</th>
                <th className="px-6 py-3">קוד</th>
              </tr>
            </thead>
            <tbody>
              {sessions.map((s) => {
                const score = reportScore(s.scoring_reports?.[0]);
                return (
                  <tr
                    key={s.id}
                    onClick={() => navigate(`/dashboard/session/${s.id}`)}
                    className="border-b border-gray-100 last:border-b-0 hover:bg-gray-50 cursor-pointer transition-colors"
                  >
                    <td className="px-6 py-4 font-mono text-sm text-gray-700">{s.case_id}</td>
                    <td className="px-6 py-4 font-bold text-black uppercase">{s.assessment_type ?? "moca"}</td>
                    <td className="px-6 py-4">
                      <span
                        className={clsx(
                          "inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-bold",
                          STATUS_COLORS[s.status],
                        )}
                      >
                        <span className="w-1.5 h-1.5 rounded-full bg-current" />
                        {STATUS_LABELS[s.status]}
                      </span>
                    </td>
                    <td className="px-6 py-4 font-extrabold tabular-nums text-black">
                      {score != null ? `${score}/30` : "—"}
                    </td>
                    <td className="px-6 py-4 text-gray-600 tabular-nums">{formatDate(s.created_at)}</td>
                    <td className="px-6 py-4 text-gray-600 tabular-nums">{formatDate(s.completed_at)}</td>
                    <td className="px-6 py-4 font-mono text-gray-600">{s.access_code ?? "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      <OrderAssessmentModal
        open={orderOpen}
        onClose={() => setOrderOpen(false)}
        patient={{
          id: patient.id,
          case_id: patient.case_id,
          full_name: patient.full_name,
          language: patient.language,
          education_years: patient.education_years,
          date_of_birth: patient.date_of_birth,
        }}
        onOrdered={loadPatient}
      />
    </div>
  );
}
