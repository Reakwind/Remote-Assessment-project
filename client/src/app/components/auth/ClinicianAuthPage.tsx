import { useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router";
import { ArrowLeft, Lock, Stethoscope, UserPlus } from "lucide-react";
import { useClinicianAuth } from "./useClinicianAuth";

type Mode = "signin" | "signup";

export function ClinicianAuthPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { signIn, signUp, loading } = useClinicianAuth();
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [clinicName, setClinicName] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const submitLabel = useMemo(
    () => (mode === "signin" ? "כניסה לקלינאים" : "יצירת חשבון קלינאי"),
    [mode],
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!email.trim() || !password.trim()) {
      setError("יש למלא אימייל וסיסמה.");
      return;
    }

    if (mode === "signup" && (!fullName.trim() || !clinicName.trim() || !phoneNumber.trim())) {
      setError("בהרשמה יש למלא שם מלא, שם מרפאה ומספר טלפון.");
      return;
    }

    if (mode === "signin") {
      const res = await signIn(email.trim(), password);
      if (!res.ok) {
        setError(res.error ?? "הכניסה נכשלה.");
        return;
      }
      const from = (location.state as { from?: string } | null)?.from ?? "/dashboard";
      navigate(from, { replace: true });
      return;
    }

    const res = await signUp({
      email: email.trim(),
      password,
      fullName: fullName.trim(),
      clinicName: clinicName.trim(),
      phoneNumber: phoneNumber.trim(),
    });
    if (!res.ok) {
      setError(res.error ?? "הרשמה נכשלה.");
      return;
    }

    setSuccess("החשבון נוצר בהצלחה. אפשר להתחבר עכשיו.");
    setMode("signin");
  };

  return (
    <div
      dir="rtl"
      className="min-h-screen bg-gray-50 flex items-center justify-center p-4 font-['Heebo',sans-serif]"
    >
      <div className="w-full max-w-xl">
        <div className="text-center mb-5">
          <div className="w-16 h-16 bg-black text-white rounded-2xl flex items-center justify-center text-2xl font-bold mx-auto mb-4">
            RC
          </div>
          <h1 className="text-3xl font-extrabold text-black mb-2">פורטל קלינאים</h1>
          <p className="text-base text-gray-500 font-medium">ניהול מבדקים, סקירה וייצוא דוחות</p>
        </div>

        <div className="bg-white p-5 sm:p-6 rounded-2xl border border-gray-200 shadow-sm">
          <div className="grid grid-cols-2 gap-2 mb-5">
            <button
              type="button"
              onClick={() => setMode("signin")}
              className={`h-11 rounded-lg font-bold text-sm transition-colors ${
                mode === "signin"
                  ? "bg-black text-white"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              <span className="inline-flex items-center gap-1.5 sm:gap-2">
                <Lock className="w-4 h-4 sm:w-5 sm:h-5" />
                התחברות
              </span>
            </button>
            <button
              type="button"
              onClick={() => setMode("signup")}
              className={`h-11 rounded-lg font-bold text-sm transition-colors ${
                mode === "signup"
                  ? "bg-black text-white"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              <span className="inline-flex items-center gap-1.5 sm:gap-2">
                <UserPlus className="w-4 h-4 sm:w-5 sm:h-5" />
                הרשמה
              </span>
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-3">
            {mode === "signup" && (
              <>
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="שם מלא"
                  className="w-full h-11 px-3 text-base border border-gray-300 rounded-lg focus:border-black focus:ring-4 focus:ring-black/10 outline-none transition-all"
                />
                <input
                  type="text"
                  value={clinicName}
                  onChange={(e) => setClinicName(e.target.value)}
                  placeholder="שם מרפאה"
                  className="w-full h-11 px-3 text-base border border-gray-300 rounded-lg focus:border-black focus:ring-4 focus:ring-black/10 outline-none transition-all"
                />
                <input
                  type="tel"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  placeholder="טלפון קלינאי (למשל +972501234567)"
                  className="w-full h-11 px-3 text-base border border-gray-300 rounded-lg focus:border-black focus:ring-4 focus:ring-black/10 outline-none transition-all"
                />
              </>
            )}

            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="אימייל"
              className="w-full h-11 px-3 text-base border border-gray-300 rounded-lg focus:border-black focus:ring-4 focus:ring-black/10 outline-none transition-all"
            />
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="סיסמה"
              className="w-full h-11 px-3 text-base border border-gray-300 rounded-lg focus:border-black focus:ring-4 focus:ring-black/10 outline-none transition-all"
            />

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-3 text-sm font-bold">
                {error}
              </div>
            )}

            {success && (
              <div className="bg-green-50 border border-green-200 text-green-700 rounded-lg p-3 text-sm font-bold">
                {success}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full h-12 bg-black text-white text-base font-bold rounded-lg hover:bg-gray-800 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
            >
              <span className="inline-flex items-center gap-2">
                <Stethoscope className="w-5 h-5" />
                {loading ? "טוען..." : submitLabel}
              </span>
            </button>
          </form>
        </div>

        <div className="mt-5 text-center">
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-gray-500 hover:text-black text-sm font-bold transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            חזרה לדף כניסת מטופל
          </Link>
        </div>
      </div>
    </div>
  );
}
