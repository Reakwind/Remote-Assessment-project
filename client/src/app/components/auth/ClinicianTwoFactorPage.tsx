/* eslint-disable react-hooks/set-state-in-effect */
import { useCallback, useEffect, useMemo, useState } from "react";
import { Navigate, useLocation, useNavigate } from "react-router";
import { KeyRound, Loader2, ShieldCheck, ArrowLeft } from "lucide-react";
import { useClinicianAuth } from "./useClinicianAuth";

interface EnrollmentState {
  factorId: string;
  qrCode: string;
  secret: string;
  uri: string;
}

export function ClinicianTwoFactorPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { signedIn, loading, aal, mfaEnrolled, enrollTotp, verifyTotp, verifyExistingTotp, signOut } =
    useClinicianAuth();

  const [enrollment, setEnrollment] = useState<EnrollmentState | null>(null);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [enrolling, setEnrolling] = useState(false);
  const [enrollmentAttempt, setEnrollmentAttempt] = useState(0);

  const mode: "verify" | "enroll" | "unknown" = useMemo(() => {
    if (loading) return "unknown";
    if (mfaEnrolled) return "verify";
    return "enroll";
  }, [loading, mfaEnrolled]);

  const redirectIfReady = useCallback(() => {
    if (!loading && signedIn && aal === "aal2") {
      const from = (location.state as { from?: string } | null)?.from ?? "/dashboard";
      navigate(from, { replace: true });
    }
  }, [aal, loading, location.state, navigate, signedIn]);

  useEffect(() => {
    redirectIfReady();
  }, [redirectIfReady]);

  useEffect(() => {
    if (mode !== "enroll" || enrollment || enrolling) return;
    let cancelled = false;
    setEnrolling(true);
    setError(null);
    (async () => {
      const res = await enrollTotp();
      if (cancelled) return;
      if (!res.ok || !res.factorId || !res.qrCode || !res.secret || !res.uri) {
        setError(res.error ?? "רישום 2FA נכשל.");
      } else {
        setEnrollment({
          factorId: res.factorId,
          qrCode: res.qrCode,
          secret: res.secret,
          uri: res.uri,
        });
      }
      setEnrolling(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [mode, enrollment, enrolling, enrollmentAttempt, enrollTotp]);

  if (loading || mode === "unknown") {
    return (
      <div dir="rtl" className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="w-10 h-10 text-blue-600 animate-spin" />
      </div>
    );
  }

  if (!signedIn) {
    return <Navigate to="/clinician/auth" replace />;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const trimmed = code.trim();
    if (!/^\d{6}$/.test(trimmed)) {
      setError("יש להזין קוד בן 6 ספרות.");
      return;
    }

    setSubmitting(true);
    try {
      const res =
        mode === "enroll" && enrollment
          ? await verifyTotp(enrollment.factorId, trimmed)
          : await verifyExistingTotp(trimmed);
      if (!res.ok) {
        setError(res.error ?? "אימות הקוד נכשל. נסו שוב.");
        setCode("");
        return;
      }
      const from = (location.state as { from?: string } | null)?.from ?? "/dashboard";
      navigate(from, { replace: true });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      dir="rtl"
      className="min-h-screen bg-gray-50 flex items-center justify-center p-6 font-['Heebo',sans-serif]"
    >
      <div className="max-w-xl w-full bg-white p-10 rounded-3xl border border-gray-200 shadow-lg">
        <div className="text-center mb-8">
          <div className="w-16 h-16 mx-auto mb-5 rounded-2xl bg-black text-white flex items-center justify-center">
            {mode === "enroll" ? <ShieldCheck className="w-8 h-8" /> : <KeyRound className="w-8 h-8" />}
          </div>
          <h1 className="text-3xl font-extrabold text-black mb-2">
            {mode === "enroll" ? "הגדרת אימות דו-שלבי" : "אימות דו-שלבי"}
          </h1>
          <p className="text-gray-600 text-lg">
            {mode === "enroll"
              ? "סרקו את הקוד ב-Google Authenticator (או אפליקציית TOTP אחרת), ולאחר מכן הזינו את הקוד בן 6 הספרות שהאפליקציה מציגה."
              : "הזינו את הקוד בן 6 הספרות המופיע באפליקציית האימות שלכם."}
          </p>
        </div>

        {mode === "enroll" && (
          <div className="mb-8">
            {enrolling && !enrollment && (
              <div className="flex flex-col items-center py-12 text-gray-500 gap-3">
                <Loader2 className="w-8 h-8 animate-spin" />
                <span>מייצר קוד QR...</span>
              </div>
            )}
            {!enrolling && !enrollment && error && (
              <button
                type="button"
                onClick={() => {
                  setError(null);
                  setEnrollmentAttempt((attempt) => attempt + 1);
                }}
                className="w-full h-12 rounded-xl border-2 border-gray-300 font-bold text-gray-800 hover:border-black hover:bg-gray-50 transition-all"
              >
                נסו לייצר קוד QR חדש
              </button>
            )}
            {enrollment && (
              <div className="flex flex-col items-center">
                <div className="bg-white p-4 rounded-2xl border border-gray-200">
                  <img
                    src={enrollment.qrCode}
                    alt="TOTP enrollment QR code"
                    className="w-52 h-52"
                  />
                </div>
                <div className="mt-4 text-sm text-gray-500 text-center">
                  לא ניתן לסרוק? הזינו את המפתח ידנית:
                </div>
                <div className="mt-2 font-mono text-base tracking-wider bg-gray-100 rounded-lg px-3 py-2 text-black select-all break-all">
                  {enrollment.secret}
                </div>
              </div>
            )}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <input
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
            placeholder="123456"
            className="w-full h-16 px-4 text-3xl tracking-[0.4em] text-center border-2 border-gray-300 rounded-xl focus:border-black focus:ring-4 focus:ring-black/10 outline-none transition-all"
          />

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-4 font-bold text-center">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={submitting || (mode === "enroll" && !enrollment)}
            className="w-full h-16 bg-black text-white text-xl font-bold rounded-xl hover:bg-gray-800 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
          >
            {submitting
              ? "בודק..."
              : mode === "enroll"
              ? "אמת והמשך לדשבורד"
              : "המשך לדשבורד"}
          </button>
        </form>

        <button
          type="button"
          onClick={async () => {
            await signOut();
            navigate("/clinician/auth", { replace: true });
          }}
          className="mt-6 w-full h-12 border-2 border-gray-300 text-gray-700 font-bold rounded-xl hover:bg-gray-50 hover:border-black transition-all inline-flex items-center justify-center gap-2"
        >
          <ArrowLeft className="w-5 h-5" />
          התנתקות
        </button>
      </div>
    </div>
  );
}
