import { useNavigate } from "react-router";
import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, ArrowLeft, CheckCircle2, Mic, PenTool, Volume2 } from "lucide-react";
import { clsx } from "clsx";
import { markPatientOnboardingComplete } from "../store/AssessmentContext";

type CheckState = "idle" | "checking" | "success" | "error";
type VoiceState = "checking" | "ready" | "missing" | "unsupported";

function hasSpeechSupport() {
  return typeof window !== "undefined" && "speechSynthesis" in window && "SpeechSynthesisUtterance" in window;
}

function findHebrewVoice() {
  if (!hasSpeechSupport()) return null;
  return window.speechSynthesis.getVoices().find((voice) => voice.lang.toLowerCase().startsWith("he")) ?? null;
}

export function PatientWelcome() {
  const navigate = useNavigate();
  const [voiceState, setVoiceState] = useState<VoiceState>(() => hasSpeechSupport() ? "checking" : "unsupported");
  const [audioCheck, setAudioCheck] = useState<CheckState>("idle");
  const [micCheck, setMicCheck] = useState<CheckState>("idle");
  const [audioMessage, setAudioMessage] = useState<string | null>(null);
  const [micMessage, setMicMessage] = useState<string | null>(null);
  const [readinessAccepted, setReadinessAccepted] = useState(false);

  useEffect(() => {
    if (!hasSpeechSupport()) return;

    const refreshVoices = () => {
      const voices = window.speechSynthesis.getVoices();
      if (voices.length === 0) {
        setVoiceState("checking");
        return;
      }
      setVoiceState(findHebrewVoice() ? "ready" : "missing");
    };

    window.speechSynthesis.addEventListener?.("voiceschanged", refreshVoices);
    const initialCheckId = window.setTimeout(refreshVoices, 0);
    const timeoutId = window.setTimeout(() => {
      if (window.speechSynthesis.getVoices().length === 0) setVoiceState("missing");
    }, 1500);

    return () => {
      window.clearTimeout(initialCheckId);
      window.clearTimeout(timeoutId);
      window.speechSynthesis.removeEventListener?.("voiceschanged", refreshVoices);
    };
  }, []);

  const canRunAudioTest = voiceState === "ready";
  const checksComplete = audioCheck === "success" && micCheck === "success";
  const canStart = checksComplete && readinessAccepted;
  const startHelp = useMemo(() => {
    if (canStart) return "המערכת מוכנה להתחלת המבדק.";
    if (voiceState === "missing" || voiceState === "unsupported") return "לא ניתן להפעיל השמעת עברית במכשיר זה. פנה לקלינאי.";
    if (audioCheck !== "success") return "יש להשלים בדיקת שמע בעברית.";
    if (micCheck !== "success") return "יש להשלים בדיקת מיקרופון.";
    return "יש לאשר שהמקום שקט ושניתנו הנחיות התחלה.";
  }, [audioCheck, canStart, micCheck, voiceState]);

  const handleAudioTest = () => {
    if (!canRunAudioTest) {
      setAudioCheck("error");
      setAudioMessage("לא נמצא קול עברי בדפדפן. פנה לקלינאי כדי להחליף דפדפן או מכשיר.");
      return;
    }

    setAudioCheck("checking");
    setAudioMessage(null);
    const utterance = new SpeechSynthesisUtterance("בדיקת שמע בעברית. אם שמעת את המשפט, אפשר להמשיך.");
    utterance.lang = 'he-IL';
    utterance.rate = 0.9;
    const hebrewVoice = findHebrewVoice();
    if (hebrewVoice) {
      try {
        utterance.voice = hebrewVoice;
      } catch {
        // Browser tests can stub voices with plain objects; lang still requests Hebrew.
      }
    }

    const timeoutId = window.setTimeout(() => {
      setAudioCheck("error");
      setAudioMessage("לא התקבל אישור שהשמעת הטקסט הסתיימה. נסה שוב או פנה לקלינאי.");
      window.speechSynthesis.cancel();
    }, 8000);

    utterance.onend = () => {
      window.clearTimeout(timeoutId);
      setAudioCheck("success");
      setAudioMessage("השמעת ההוראות בעברית עובדת.");
    };
    utterance.onerror = () => {
      window.clearTimeout(timeoutId);
      setAudioCheck("error");
      setAudioMessage("השמעת הטקסט נכשלה. נסה שוב או פנה לקלינאי.");
    };

    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
  };

  const handleMicTest = async () => {
    setMicCheck("checking");
    setMicMessage(null);
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error("mediaDevices unavailable");
      }
      if (typeof MediaRecorder === "undefined") {
        throw new Error("MediaRecorder unavailable");
      }
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      try {
        await new Promise<void>((resolve, reject) => {
          const recorder = new MediaRecorder(stream);
          const timeoutId = window.setTimeout(() => {
            if (recorder.state !== "inactive") recorder.stop();
          }, 1000);
          recorder.onerror = () => {
            window.clearTimeout(timeoutId);
            reject(new Error("microphone recording failed"));
          };
          recorder.onstop = () => {
            window.clearTimeout(timeoutId);
            resolve();
          };
          recorder.start();
        });
      } finally {
        stream.getTracks().forEach((track) => track.stop());
      }
      setMicCheck("success");
      setMicMessage("המיקרופון זמין להקלטת תשובות.");
    } catch (error) {
      console.error("Microphone preflight failed:", error);
      setMicCheck("error");
      setMicMessage("לא ניתן לגשת למיקרופון או להקליט בדיקה קצרה. אשר הרשאת מיקרופון או פנה לקלינאי.");
    }
  };

  return (
    <div
      dir="rtl"
      className="flex min-h-[100dvh] flex-col bg-gray-50 font-['Heebo',sans-serif]"
    >
      <div className="flex items-center justify-between border-b border-gray-200 bg-white px-4 py-3 sm:px-6">
        <h1 className="flex items-center gap-3 text-lg font-bold text-black sm:text-xl">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-black text-xs text-white sm:h-10 sm:w-10 sm:text-sm">
            RC
          </div>
          הערכה קוגניטיבית
        </h1>
      </div>

      <div className="flex flex-1 flex-col items-stretch justify-start overflow-y-auto px-4 py-4 sm:items-center sm:p-6">
        <div className="w-full max-w-4xl overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
          <div className="border-b border-gray-100 p-4 sm:p-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <h2 className="text-2xl font-extrabold leading-tight text-black sm:text-3xl">
                  ברוך הבא להערכה קוגניטיבית
                </h2>
                <p className="mt-2 text-base font-medium leading-relaxed text-gray-600 sm:text-lg">
                  לפני תחילת המבדק נוודא שהשמע, המיקרופון וסביבת הציור מוכנים.
                </p>
              </div>
              <div className="grid grid-cols-2 gap-2 text-center sm:w-64">
                <div className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-2">
                  <div className="text-xl font-black text-gray-950">12</div>
                  <div className="text-xs font-bold text-gray-600">משימות קצרות</div>
                </div>
                <div className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-2">
                  <div className="text-xl font-black text-gray-950">25-30</div>
                  <div className="text-xs font-bold text-gray-600">דקות</div>
                </div>
              </div>
            </div>

            <div className="mt-4 rounded-xl border border-blue-100 bg-blue-50 p-3 sm:p-4">
              <h3 className="mb-3 text-base font-extrabold text-blue-950">לפני שמתחילים</h3>
              <ul className="grid gap-2 text-sm font-bold leading-relaxed text-blue-900 sm:grid-cols-2">
                <li>מקום שקט ללא הסחות דעת</li>
                <li>אצבע או עט מגע לציור</li>
                <li>הקשבה להוראות בכל משימה</li>
                <li>עזרה מותרת בתפעול בלבד</li>
              </ul>
            </div>
          </div>

          <div className="bg-gray-50 p-4 sm:p-6">
            <div className="mb-4 flex items-center justify-between gap-3">
              <h3 className="text-lg font-extrabold text-gray-900">
                בדיקת מערכת
              </h3>
              <span className="rounded-full bg-white px-3 py-1 text-xs font-extrabold text-gray-600 ring-1 ring-gray-200">
                חובה לפני התחלה
              </span>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <div className="flex min-h-16 items-center gap-3 rounded-xl border border-gray-200 bg-white p-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-green-100 text-green-600">
                  <CheckCircle2 className="h-6 w-6" />
                </div>
                <div className="text-base font-bold text-black">חיבור לאינטרנט</div>
              </div>

              <button
                onClick={handleAudioTest}
                disabled={!canRunAudioTest || audioCheck === "checking"}
                className={clsx(
                  "flex min-h-16 w-full items-center gap-3 rounded-xl border bg-white p-4 text-right transition-all",
                  canRunAudioTest ? "border-gray-200 hover:border-blue-400 hover:shadow-sm" : "border-amber-200 bg-amber-50 cursor-not-allowed",
                )}
              >
                <div className={clsx(
                  "flex h-10 w-10 shrink-0 items-center justify-center rounded-full",
                  audioCheck === "success" ? "bg-green-100 text-green-600" : "bg-blue-100 text-blue-600",
                )}>
                  {audioCheck === "success" ? <CheckCircle2 className="h-6 w-6" /> : <Volume2 className="h-6 w-6" />}
                </div>
                <div className="flex-1">
                  <div className="text-base font-bold text-black">
                    {audioCheck === "checking" ? "משמיע בדיקת שמע..." : "בדיקת שמע בעברית"}
                  </div>
                  <div className="text-sm font-medium leading-relaxed text-gray-600">
                    {voiceState === "checking" && "בודק זמינות קול עברי בדפדפן."}
                    {voiceState === "ready" && (audioMessage ?? "לחץ כדי לוודא שההוראות נשמעות בעברית.")}
                    {voiceState === "missing" && "לא נמצא קול עברי בדפדפן זה."}
                    {voiceState === "unsupported" && "הדפדפן לא תומך בהשמעת טקסט."}
                  </div>
                </div>
              </button>

              <button
                onClick={handleMicTest}
                disabled={micCheck === "checking"}
                className="flex min-h-16 w-full items-center gap-3 rounded-xl border border-gray-200 bg-white p-4 text-right transition-all hover:border-blue-400 hover:shadow-sm"
              >
                <div className={clsx(
                  "flex h-10 w-10 shrink-0 items-center justify-center rounded-full",
                  micCheck === "success" ? "bg-green-100 text-green-600" : "bg-purple-100 text-purple-600",
                )}>
                  {micCheck === "success" ? <CheckCircle2 className="h-6 w-6" /> : <Mic className="h-6 w-6" />}
                </div>
                <div className="flex-1 text-base font-bold text-black">
                  <div>{micCheck === "checking" ? "בודק מיקרופון..." : "בדיקת מיקרופון"}</div>
                  <div className="text-sm font-medium leading-relaxed text-gray-600">
                    {micMessage ?? "לחץ כדי לאשר שהמיקרופון זמין להקלטת תשובות."}
                  </div>
                </div>
              </button>

              <div className="flex min-h-16 items-center gap-3 rounded-xl border border-gray-200 bg-white p-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gray-100 text-gray-700">
                  <PenTool className="h-6 w-6" />
                </div>
                <div className="flex-1 text-base font-bold leading-relaxed text-black">
                  המשימה הראשונה היא משימת ציור. בטלפון מומלץ לסובב לרוחב לפני הציור.
                </div>
              </div>
            </div>

            {checksComplete && (
              <label htmlFor="readiness-accepted" className="mt-5 flex cursor-pointer items-start gap-3 rounded-xl border border-gray-200 bg-white p-4 text-right">
                <input
                  id="readiness-accepted"
                  type="checkbox"
                  checked={readinessAccepted}
                  onChange={(event) => setReadinessAccepted(event.target.checked)}
                  className="mt-1 h-6 w-6 shrink-0 accent-black"
                />
                <span className="text-sm font-extrabold leading-relaxed text-gray-900 sm:text-base">
                  אני במקום שקט, מוכן להתחיל את המבדק, וקיבלתי הנחיה מהקלינאי או מאיש התמיכה. עזרה מותרת רק בתפעול המכשיר, לא בתשובות.
                </span>
              </label>
            )}

            <div className="mt-6">
              {!canStart && (
                <div className="mb-3 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-right text-sm font-bold text-amber-900">
                  <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
                  <span>{startHelp}</span>
                </div>
              )}
              <button
                onClick={() => {
                  if (!canStart) return;
                  markPatientOnboardingComplete();
                  navigate("/patient/trail-making");
                }}
                disabled={!canStart}
                className={clsx(
                  "flex min-h-14 w-full items-center justify-center gap-3 rounded-xl text-lg font-bold text-white transition-all focus:ring-4 focus:ring-black/20 sm:min-h-16 sm:text-xl",
                  canStart ? "bg-black hover:bg-gray-800" : "bg-gray-300 cursor-not-allowed",
                )}
              >
                התחל מבדק
                <ArrowLeft className="h-7 w-7" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
