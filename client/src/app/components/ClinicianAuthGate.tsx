import { useEffect, useState } from "react";
import { Lock, LogOut } from "lucide-react";
import { supabase } from "../../lib/supabase";
import type { Session } from "@supabase/supabase-js";

export function ClinicianAuthGate({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setLoading(false);
    });

    return () => {
      listener.subscription.unsubscribe();
    };
  }, []);

  if (loading) {
    return (
      <div dir="rtl" className="min-h-screen bg-gray-50 flex items-center justify-center font-['Heebo',sans-serif]">
        <div className="font-bold text-gray-500">בודק הרשאות...</div>
      </div>
    );
  }

  if (!session) {
    return <ClinicianLogin />;
  }

  return (
    <>
      <button
        onClick={() => supabase.auth.signOut()}
        className="fixed top-4 left-4 z-50 h-11 px-4 rounded-xl bg-white border border-gray-200 shadow-sm flex items-center gap-2 font-bold hover:border-black focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-600"
      >
        <LogOut className="w-4 h-4" />
        יציאה
      </button>
      {children}
    </>
  );
}

function ClinicianLogin() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);

    const result = mode === "signin"
      ? await supabase.auth.signInWithPassword({ email, password })
      : await supabase.auth.signUp({ email, password });

    if (result.error) setError(result.error.message);
    setBusy(false);
  };

  return (
    <div dir="rtl" className="min-h-screen bg-gray-50 flex items-center justify-center p-6 font-['Heebo',sans-serif]">
      <form onSubmit={handleSubmit} className="w-full max-w-md bg-white border border-gray-200 rounded-2xl shadow-lg p-8">
        <div className="w-16 h-16 rounded-2xl bg-black text-white flex items-center justify-center mb-6">
          <Lock className="w-8 h-8" />
        </div>
        <h1 className="text-3xl font-extrabold text-black mb-2">כניסת קלינאים</h1>
        <p className="text-gray-500 font-medium mb-8">התחבר כדי ליצור קישורי מבחן ולסקור תוצאות.</p>

        {error && (
          <div className="mb-5 rounded-xl border border-red-200 bg-red-50 text-red-800 p-3 font-medium">
            {error}
          </div>
        )}

        <label className="flex flex-col gap-2 mb-4">
          <span className="text-sm font-bold text-gray-500">אימייל</span>
          <input
            data-testid="clinician-email"
            type="email"
            value={email}
            onChange={event => setEmail(event.target.value)}
            dir="ltr"
            className="h-14 rounded-xl border border-gray-200 px-4 text-left focus:outline-none focus:ring-4 focus:ring-blue-600"
            required
          />
        </label>

        <label className="flex flex-col gap-2 mb-6">
          <span className="text-sm font-bold text-gray-500">סיסמה</span>
          <input
            data-testid="clinician-password"
            type="password"
            value={password}
            onChange={event => setPassword(event.target.value)}
            dir="ltr"
            className="h-14 rounded-xl border border-gray-200 px-4 text-left focus:outline-none focus:ring-4 focus:ring-blue-600"
            minLength={6}
            required
          />
        </label>

        <button
          data-testid="clinician-auth-submit"
          type="submit"
          disabled={busy}
          className="w-full h-14 rounded-xl bg-black text-white text-lg font-bold disabled:bg-gray-300 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-600"
        >
          {busy ? "שולח..." : mode === "signin" ? "התחבר" : "צור חשבון"}
        </button>

        <button
          data-testid="clinician-auth-mode-toggle"
          type="button"
          onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
          className="w-full mt-4 h-12 rounded-xl text-gray-600 font-bold hover:bg-gray-50"
        >
          {mode === "signin" ? "אין חשבון? צור חשבון בדיקה" : "יש חשבון? התחבר"}
        </button>
      </form>
    </div>
  );
}
