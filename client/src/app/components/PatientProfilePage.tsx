/* eslint-disable react-hooks/set-state-in-effect */
import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import {
  ChevronRight,
  Stethoscope,
  Calendar,
  Hash,
  Phone,
  StickyNote,
  Plus,
  Loader2,
  Activity,
} from "lucide-react";
import { clsx } from "clsx";
import { supabase } from "../../lib/supabase";
import { OrderAssessmentModal } from "./OrderAssessmentModal";

interface PatientRecord {
  id: string;
  full_name: string;
  phone: string;
  date_of_birth: string | null;
  id_number: string | null;
  notes: string | null;
  created_at: string;
}

interface PatientSession {
  id: string;
  case_id: string;
  status: "pending" | "in_progress" | "completed" | "awaiting_review";
  assessment_type: string | null;
  created_at: string;
  completed_at: string | null;
  access_code: string | null;
  scoring_reports: { total_score: number | null; needs_review: boolean }[] | null;
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
      .select("id, full_name, phone, date_of_birth, id_number, notes, created_at")
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
        "id, case_id, status, assessment_type, created_at, completed_at, access_code, scoring_reports(total_score, needs_review)",
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
        <h1 className="text-3xl font-extrabold text-black mb-3">המטופל לא נמצא</h1>
        <p className="text-gray-500 mb-6">ייתכן שהקישור שגוי או שאין לך גישה לרשומה.</p>
        <Link to="/dashboard" className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-black text-white font-bold">
          חזרה לרשימת המטופלים
        </Link>
      </div>
    );
  }

  const completedCount = sessions.filter((s) => s.status === "completed").length;
  const latestScore = sessions
    .flatMap((s) => s.scoring_reports ?? [])
    .find((r) => r?.total_score != null)?.total_score;

  return (
    <div className="max-w-6xl mx-auto pb-20">
      <div className="mb-6">
        <Link
          to="/dashboard"
          className="text-gray-500 font-bold hover:text-black flex items-center gap-2 transition-colors w-fit"
        >
          <ChevronRight className="w-5 h-5" />
          <span>מטופלים / {patient.full_name}</span>
        </Link>
      </div>

      <div className="bg-white p-8 rounded-2xl border border-gray-200 shadow-sm mb-8">
        <div className="flex items-start justify-between gap-6 flex-wrap">
          <div className="flex items-center gap-6 min-w-0">
            <div className="w-20 h-20 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-extrabold text-3xl shrink-0">
              {patient.full_name.trim()[0]?.toUpperCase() || "מ"}
            </div>
            <div className="min-w-0">
              <h1 className="text-3xl font-extrabold text-black mb-2 truncate">{patient.full_name}</h1>
              <div className="flex gap-5 text-gray-500 font-medium flex-wrap">
                <span className="inline-flex items-center gap-2">
                  <Phone className="w-4 h-4" />
                  <span className="font-mono">{patient.phone}</span>
                </span>
                {patient.date_of_birth && (
                  <span className="inline-flex items-center gap-2">
                    <Calendar className="w-4 h-4" />
                    {formatDate(patient.date_of_birth)}
                  </span>
                )}
                {patient.id_number && (
                  <span className="inline-flex items-center gap-2">
                    <Hash className="w-4 h-4" />
                    <span className="font-mono">{patient.id_number}</span>
                  </span>
                )}
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

        {patient.notes && (
          <div className="mt-6 bg-gray-50 border border-gray-200 rounded-xl p-4 text-gray-700 flex items-start gap-3">
            <StickyNote className="w-5 h-5 mt-0.5 text-gray-400 shrink-0" />
            <span className="whitespace-pre-wrap">{patient.notes}</span>
          </div>
        )}
      </div>

      <div className="grid grid-cols-3 gap-4 mb-8">
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
            עדיין לא נפתחו מבחנים למטופל זה.
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
                const score = s.scoring_reports?.[0]?.total_score;
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
          full_name: patient.full_name,
          phone: patient.phone,
          date_of_birth: patient.date_of_birth,
        }}
        onOrdered={loadPatient}
      />
    </div>
  );
}
