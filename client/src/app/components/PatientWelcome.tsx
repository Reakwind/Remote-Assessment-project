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
      className="min-h-screen bg-gray-50 flex flex-col font-['Heebo',sans-serif]"
    >
      <div className="bg-white border-b border-gray-200 p-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-black flex items-center gap-3">
          <div className="w-10 h-10 bg-black text-white rounded-lg flex items-center justify-center text-sm">
            RC
          </div>
          הערכה קוגניטיבית
        </h1>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center p-6">
        <div className="max-w-2xl w-full bg-white rounded-3xl border border-gray-200 shadow-lg overflow-hidden">
          <div className="p-10 border-b border-gray-100">
            <h2 className="text-4xl font-extrabold text-black mb-6">
              ברוך הבא להערכה קוגניטיבית
            </h2>
            <div className="space-y-4 text-2xl text-gray-700">
              <p>המבדק כולל 12 משימות קצרות.</p>
              <p>זמן משוער: 25-30 דקות.</p>
            </div>
            
            <div className="mt-8 bg-blue-50 border border-blue-100 rounded-2xl p-6">
              <h3 className="text-xl font-bold text-blue-900 mb-4 flex items-center gap-2">
                לפני שמתחילים:
              </h3>
              <ul className="space-y-3 text-lg text-blue-800">
                <li>• מצא מקום שקט ללא הסחות דעת</li>
                <li>• ניתן להשתמש באצבע או בעט מגע כדי לצייר</li>
                <li>• הקשב להוראות בקפידה בכל משימה</li>
                <li>• אפשר לקבל עזרה בתפעול המכשיר בלבד, לא בתשובות</li>
              </ul>
            </div>
          </div>

          <div className="p-10 bg-gray-50">
            <h3 className="text-xl font-bold text-gray-900 mb-6">
              בדיקת מערכת:
            </h3>
            
            <div className="space-y-4">
              <div className="flex items-center gap-4 bg-white p-4 rounded-xl border border-gray-200">
                <div className="w-12 h-12 bg-green-100 text-green-600 rounded-full flex items-center justify-center shrink-0">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <div className="text-lg font-medium text-black">חיבור לאינטרנט</div>
              </div>

              <button
                onClick={handleAudioTest}
                disabled={!canRunAudioTest || audioCheck === "checking"}
                className={clsx(
                  "w-full flex items-center gap-4 bg-white p-4 rounded-xl border text-right transition-all",
                  canRunAudioTest ? "border-gray-200 hover:border-blue-400 hover:shadow-md" : "border-amber-200 bg-amber-50 cursor-not-allowed",
                )}
              >
                <div className={clsx(
                  "w-12 h-12 rounded-full flex items-center justify-center shrink-0",
                  audioCheck === "success" ? "bg-green-100 text-green-600" : "bg-blue-100 text-blue-600",
                )}>
                  {audioCheck === "success" ? <CheckCircle2 className="w-6 h-6" /> : <Volume2 className="w-6 h-6" />}
                </div>
                <div className="flex-1">
                  <div className="text-lg font-medium text-black">
                    {audioCheck === "checking" ? "משמיע בדיקת שמע..." : "בדיקת שמע בעברית"}
                  </div>
                  <div className="text-sm font-medium text-gray-600">
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
                className="w-full flex items-center gap-4 bg-white p-4 rounded-xl border border-gray-200 hover:border-blue-400 hover:shadow-md transition-all text-right"
              >
                <div className={clsx(
                  "w-12 h-12 rounded-full flex items-center justify-center shrink-0",
                  micCheck === "success" ? "bg-green-100 text-green-600" : "bg-purple-100 text-purple-600",
                )}>
                  {micCheck === "success" ? <CheckCircle2 className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
                </div>
                <div className="text-lg font-medium text-black flex-1">
                  <div>{micCheck === "checking" ? "בודק מיקרופון..." : "בדיקת מיקרופון"}</div>
                  <div className="text-sm font-medium text-gray-600">
                    {micMessage ?? "לחץ כדי לאשר שהמיקרופון זמין להקלטת תשובות."}
                  </div>
                </div>
              </button>

              <div className="flex items-center gap-4 bg-white p-4 rounded-xl border border-gray-200">
                <div className="w-12 h-12 bg-gray-100 text-gray-700 rounded-full flex items-center justify-center shrink-0">
                  <PenTool className="w-6 h-6" />
                </div>
                <div className="text-lg font-medium text-black flex-1">
                  המשימה הראשונה תהיה משימת ציור לבדיקת העכבר/מגע
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
                  "w-full h-20 text-white text-2xl font-bold rounded-2xl focus:ring-4 focus:ring-black/20 transition-all flex items-center justify-center gap-4",
                  canStart ? "bg-black hover:bg-gray-800" : "bg-gray-300 cursor-not-allowed",
                )}
              >
                התחלת המבדק
                <ArrowLeft className="w-8 h-8" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
