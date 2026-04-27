import { useNavigate } from "react-router";
import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, ArrowLeft, CheckCircle2, Mic, PenTool, Volume2 } from "lucide-react";
import { clsx } from "clsx";
import { markPatientOnboardingComplete, useAssessmentStore } from "../store/AssessmentContext";

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
  const { state } = useAssessmentStore();
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
      <div className="flex items-center justify-between border-b border-gray-200 bg-white px-4 py-3 sm:p-6">
        <h1 className="flex items-center gap-3 text-xl font-bold text-black sm:text-2xl">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-black text-sm text-white">
            RC
          </div>
          הערכה קוגניטיבית
        </h1>
      </div>

      <div className="flex flex-1 flex-col items-stretch justify-start overflow-y-auto px-4 py-5 sm:items-center sm:justify-center sm:p-6">
        <div className="w-full max-w-3xl overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-lg sm:rounded-3xl">
          <div className="border-b border-gray-100 p-5 sm:p-10">
            <h2 className="mb-4 text-2xl font-extrabold leading-tight text-black sm:mb-6 sm:text-4xl">
              ברוך הבא להערכה קוגניטיבית
            </h2>
            <div className="space-y-2 text-lg text-gray-700 sm:space-y-4 sm:text-2xl">
              <p>המבדק כולל 12 משימות קצרות.</p>
              <p>זמן משוער: 25-30 דקות.</p>
            </div>
            
            <div className="mt-5 rounded-2xl border border-blue-100 bg-blue-50 p-4 sm:mt-8 sm:p-6">
              <h3 className="mb-3 flex items-center gap-2 text-lg font-bold text-blue-900 sm:mb-4 sm:text-xl">
                לפני שמתחילים:
              </h3>
              <ul className="space-y-2 text-base leading-relaxed text-blue-800 sm:space-y-3 sm:text-lg">
                <li>• מצא מקום שקט ללא הסחות דעת</li>
                <li>• ניתן להשתמש באצבע או בעט מגע כדי לצייר</li>
                <li>• הקשב להוראות בקפידה בכל משימה</li>
                <li>• אפשר לקבל עזרה בתפעול המכשיר בלבד, לא בתשובות</li>
              </ul>
            </div>
          </div>

          <div className="bg-gray-50 p-5 sm:p-10">
            <h3 className="mb-4 text-lg font-bold text-gray-900 sm:mb-6 sm:text-xl">
              בדיקת מערכת:
            </h3>
            
            <div className="space-y-3 sm:space-y-4">
              <div className="flex min-h-16 items-center gap-3 rounded-xl border border-gray-200 bg-white p-4 sm:gap-4">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-green-100 text-green-600 sm:h-12 sm:w-12">
                  <CheckCircle2 className="h-6 w-6" />
                </div>
                <div className="text-base font-medium text-black sm:text-lg">חיבור לאינטרנט</div>
              </div>

              <button
                onClick={handleAudioTest}
                disabled={!canRunAudioTest || audioCheck === "checking"}
                className={clsx(
                  "flex min-h-20 w-full items-center gap-3 rounded-xl border bg-white p-4 text-right transition-all sm:gap-4",
                  canRunAudioTest ? "border-gray-200 hover:border-blue-400 hover:shadow-md" : "border-amber-200 bg-amber-50 cursor-not-allowed",
                )}
              >
                <div className={clsx(
                  "flex h-11 w-11 shrink-0 items-center justify-center rounded-full sm:h-12 sm:w-12",
                  audioCheck === "success" ? "bg-green-100 text-green-600" : "bg-blue-100 text-blue-600",
                )}>
                  {audioCheck === "success" ? <CheckCircle2 className="h-6 w-6" /> : <Volume2 className="h-6 w-6" />}
                </div>
                <div className="flex-1">
                  <div className="text-base font-medium text-black sm:text-lg">
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
                className="flex min-h-20 w-full items-center gap-3 rounded-xl border border-gray-200 bg-white p-4 text-right transition-all hover:border-blue-400 hover:shadow-md sm:gap-4"
              >
                <div className={clsx(
                  "flex h-11 w-11 shrink-0 items-center justify-center rounded-full sm:h-12 sm:w-12",
                  micCheck === "success" ? "bg-green-100 text-green-600" : "bg-purple-100 text-purple-600",
                )}>
                  {micCheck === "success" ? <CheckCircle2 className="h-6 w-6" /> : <Mic className="h-6 w-6" />}
                </div>
                <div className="flex-1 text-base font-medium text-black sm:text-lg">
                  <div>{micCheck === "checking" ? "בודק מיקרופון..." : "בדיקת מיקרופון"}</div>
                  <div className="text-sm font-medium leading-relaxed text-gray-600">
                    {micMessage ?? "לחץ כדי לאשר שהמיקרופון זמין להקלטת תשובות."}
                  </div>
                </div>
              </button>

              <div className="flex min-h-16 items-center gap-3 rounded-xl border border-gray-200 bg-white p-4 sm:gap-4">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gray-100 text-gray-700 sm:h-12 sm:w-12">
                  <PenTool className="h-6 w-6" />
                </div>
                <div className="flex-1 text-base font-medium leading-relaxed text-black sm:text-lg">
                  המשימה הראשונה היא משימת ציור. בטלפון מומלץ לסובב לרוחב לפני הציור.
                </div>
              </div>
            </div>

            {checksComplete && (
              <label className="mt-6 flex cursor-pointer items-start gap-4 rounded-xl border border-gray-200 bg-white p-4 text-right">
                <input
                  type="checkbox"
                  checked={readinessAccepted}
                  onChange={(event) => setReadinessAccepted(event.target.checked)}
                  className="mt-1 h-6 w-6 shrink-0 accent-black"
                />
                <span className="text-base sm:text-lg font-bold leading-relaxed text-gray-900">
                  אני במקום שקט, מוכן להתחיל את המבדק, וקיבלתי הנחיה מהקלינאי או מאיש התמיכה. עזרה מותרת רק בתפעול המכשיר, לא בתשובות.
                </span>
              </label>
            )}

            <div className="mt-10">
              {!canStart && (
                <div className="mb-4 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-right text-sm font-bold text-amber-900">
                  <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
                  <span>{startHelp}</span>
                </div>
              )}
              <button
                onClick={() => {
                  if (!canStart) return;
                  markPatientOnboardingComplete(state.id);
                  navigate("/patient/trail-making");
                }}
                disabled={!canStart}
                className={clsx(
                  "flex min-h-16 w-full items-center justify-center gap-3 rounded-2xl text-xl font-bold text-white transition-all focus:ring-4 focus:ring-black/20 sm:h-20 sm:gap-4 sm:text-2xl",
                  canStart ? "bg-black hover:bg-gray-800" : "bg-gray-300 cursor-not-allowed",
                )}
              >
                התחלת המבדק
                <ArrowLeft className="h-7 w-7 sm:h-8 sm:w-8" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
