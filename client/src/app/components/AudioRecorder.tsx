import { useCallback, useState, useRef, useEffect } from "react";
import { Mic, Square, Play, Pause, RotateCcw, AlertTriangle } from "lucide-react";
import { clsx } from "clsx";
import { AudioStore } from "../store/audioStore";
import { useAssessmentStore } from "../store/AssessmentContext";
import { edgeFn, edgeHeaders } from "../../lib/supabase";

const TASK_ID_TO_SCORING_ID: Record<string, string> = {
  digitSpan: "moca-digit-span",
  language: "moca-language",
  serial7: "moca-serial-7s",
  orientation: "moca-orientation-task",
  delayedRecall: "moca-delayed-recall",
  memory: "moca-memory-learning",
  abstraction: "moca-abstraction",
};

interface AudioRecorderProps {
  taskId: string;
  initialAudioId?: string;
  maxDurationSeconds?: number;
  onRecordingComplete: (audio: {
    audioId: string;
    audioStoragePath?: string;
    audioContentType?: string;
  }) => void;
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Failed to read audio recording"));
    reader.onloadend = () => {
      if (typeof reader.result === "string") resolve(reader.result);
      else reject(new Error("Failed to encode audio recording"));
    };
    reader.readAsDataURL(blob);
  });
}

function formatDuration(seconds: number) {
  const safeSeconds = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(safeSeconds / 60).toString().padStart(2, "0");
  const remainder = (safeSeconds % 60).toString().padStart(2, "0");
  return `${minutes}:${remainder}`;
}

export function AudioRecorder({
  taskId,
  initialAudioId,
  maxDurationSeconds = 90,
  onRecordingComplete,
}: AudioRecorderProps) {
  const { state } = useAssessmentStore();
  const [isRecording, setIsRecording] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [audioId, setAudioId] = useState<string | null>(initialAudioId || null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioElementRef = useRef<HTMLAudioElement | null>(null);
  const timerRef = useRef<number | null>(null);
  const autoStopRef = useRef<number | null>(null);
  const displayAudioUrl = audioId?.startsWith("http") ? audioId : audioUrl;
  const isNearLimit = isRecording && elapsedSeconds >= Math.floor(maxDurationSeconds * 0.8);

  const clearRecordingTimers = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (autoStopRef.current !== null) {
      window.clearTimeout(autoStopRef.current);
      autoStopRef.current = null;
    }
  }, []);
  
  // Load existing locally-cached audio URL if we have an ID
  useEffect(() => {
    let currentUrl: string | null = null;
    if (audioId && !audioId.startsWith("http")) {
      AudioStore.getAudio(audioId)
        .then((blob) => {
          if (blob) {
            currentUrl = URL.createObjectURL(blob);
            setAudioUrl(currentUrl);
          }
        })
        .catch((err) => {
          console.error("Failed to load audio from DB:", err);
        });
    }
    
    return () => {
      clearRecordingTimers();
      if (currentUrl) {
        URL.revokeObjectURL(currentUrl);
      }
    };
  }, [audioId, clearRecordingTimers]);
  
  // Audio playback event listeners
  useEffect(() => {
    const audio = audioElementRef.current;
    if (audio) {
      const handleEnded = () => setIsPlaying(false);
      audio.addEventListener("ended", handleEnded);
      return () => audio.removeEventListener("ended", handleEnded);
    }
  }, [audioUrl]);

  const startRecording = async () => {
    try {
      setError(null);
      setNotice(null);
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      const finishStop = async (
        audio: { audioId: string; audioStoragePath?: string; audioContentType?: string },
        blob: Blob,
      ) => {
        clearRecordingTimers();
        const idOrUrl = audio.audioId;
        if (!idOrUrl.startsWith("http")) await AudioStore.saveAudio(idOrUrl, blob);
        const url = idOrUrl.startsWith("http") ? idOrUrl : URL.createObjectURL(blob);
        setAudioUrl(url);
        setAudioId(idOrUrl);
        onRecordingComplete(audio);
        stream.getTracks().forEach(track => track.stop());
      };

      const failStop = (message: string, cause?: unknown) => {
        if (cause) console.error("Audio upload failed", cause);
        clearRecordingTimers();
        setError(message);
        setIsRecording(false);
        stream.getTracks().forEach(track => track.stop());
      };
      
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };
      
      mediaRecorder.onstop = async () => {
        clearRecordingTimers();
        setIsRecording(false);
        const audioBlob = new Blob(audioChunksRef.current, { type: mediaRecorder.mimeType || 'audio/webm' });
        
        let finalAudio = {
          audioId: `audio_${taskId}_${Date.now()}`,
          audioStoragePath: undefined as string | undefined,
          audioContentType: undefined as string | undefined,
        };
        try {
          if (state.id && state.linkToken) {
            const base64 = await blobToDataUrl(audioBlob);
            const contentType = audioBlob.type || "audio/webm";
            const res = await fetch(edgeFn('save-audio'), {
              method: 'POST',
              headers: edgeHeaders(),
              body: JSON.stringify({
                sessionId: state.id,
                linkToken: state.linkToken,
                taskType: TASK_ID_TO_SCORING_ID[taskId] ?? taskId,
                audioBase64: base64,
                contentType,
              })
            });
            if (!res.ok) {
              let message = "שמירת ההקלטה נכשלה. בדוק חיבור ונסה להקליט שוב.";
              try {
                const payload = await res.json();
                if (payload?.error) message = payload.error;
              } catch {
                // Keep localized fallback for non-JSON errors.
              }
              failStop(message);
              return;
            }
            const data = await res.json();
            finalAudio = {
              audioId: data.url ?? data.storagePath ?? finalAudio.audioId,
              audioStoragePath: data.audioStoragePath ?? data.storagePath,
              audioContentType: data.audioContentType ?? data.contentType ?? contentType,
            };
            if (!finalAudio.audioStoragePath) {
              failStop("שמירת ההקלטה נכשלה. נסה להקליט שוב.");
              return;
            }
            await finishStop(finalAudio, audioBlob);
            return;
          }
        } catch (e) {
          failStop("שמירת ההקלטה נכשלה. בדוק חיבור ונסה להקליט שוב.", e);
          return;
        }
        finishStop(finalAudio, audioBlob);
      };
      
      mediaRecorder.start();
      setElapsedSeconds(0);
      setIsRecording(true);
      const startedAt = Date.now();
      timerRef.current = window.setInterval(() => {
        setElapsedSeconds(Math.floor((Date.now() - startedAt) / 1000));
      }, 250);
      autoStopRef.current = window.setTimeout(() => {
        setNotice("ההקלטה נעצרה אוטומטית לאחר הזמן המוקצב.");
        if ("state" in mediaRecorder && mediaRecorder.state === "inactive") return;
        mediaRecorder.stop();
      }, maxDurationSeconds * 1000);
    } catch (err) {
      console.error("Microphone access denied or failed:", err);
      setError("לא ניתן לגשת למיקרופון. אנא אשר גישה למיקרופון בהגדרות הדפדפן.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      clearRecordingTimers();
      setIsRecording(false);
    }
  };

  const togglePlayback = () => {
    const audio = audioElementRef.current;
    if (!audio) return;
    
    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
    } else {
      audio.play();
      setIsPlaying(true);
    }
  };

  const handleReRecord = async () => {
    if (audioId) {
      await AudioStore.deleteAudio(audioId);
    }
    setError(null);
    setNotice(null);
    setElapsedSeconds(0);
    setAudioId(null);
    if (audioUrl) {
      if (!audioUrl.startsWith("http")) {
        URL.revokeObjectURL(audioUrl);
      }
      setAudioUrl(null);
    }
    setIsPlaying(false);
  };

  return (
    <div className="flex flex-col items-center gap-5 sm:gap-6 w-full max-w-lg mx-auto bg-white p-5 sm:p-8 rounded-3xl border border-gray-200 shadow-sm">
      {/* Hidden Audio Element for Playback */}
      {displayAudioUrl && (
        <audio ref={audioElementRef} src={displayAudioUrl} className="hidden" />
      )}
      
      {/* Visual State & Controls */}
      {!audioId ? (
        <div className="flex flex-col items-center gap-4 w-full">
          <div className={clsx(
            "w-28 h-28 sm:w-32 sm:h-32 rounded-full flex items-center justify-center transition-all duration-300",
            isRecording ? "bg-red-50 scale-110" : "bg-gray-50"
          )}>
            <div className={clsx(
              "w-20 h-20 sm:w-24 sm:h-24 rounded-full flex items-center justify-center transition-all duration-300",
              isRecording ? "bg-red-100 animate-pulse" : "bg-gray-100"
            )}>
              <Mic className={clsx(
                "w-10 h-10 sm:w-12 sm:h-12 transition-colors",
                isRecording ? "text-red-600" : "text-gray-400"
              )} />
            </div>
          </div>
          
          <div className="text-center mb-2">
            <h3 className="text-xl font-bold text-black mb-1">
              {isRecording ? "מקליט כעת..." : "מוכן להקלטה"}
            </h3>
            <p className="text-gray-500 font-medium">
              {isRecording ? "לחץ על עצור כשסיימת לדבר" : "לחץ על כפתור ההקלטה והתחל לדבר"}
            </p>
            <p className={clsx(
              "mt-3 font-mono text-lg font-black tabular-nums",
              isNearLimit ? "text-amber-700" : "text-gray-900",
            )}>
              {formatDuration(elapsedSeconds)} / {formatDuration(maxDurationSeconds)}
            </p>
          </div>

          {isNearLimit && (
            <div className="w-full rounded-xl border border-amber-200 bg-amber-50 p-3 text-center text-sm font-bold text-amber-900">
              ההקלטה תיעצר אוטומטית בקרוב.
            </div>
          )}

          {notice && (
            <div className="w-full rounded-xl border border-blue-200 bg-blue-50 p-3 text-center text-sm font-bold text-blue-900">
              {notice}
            </div>
          )}
          
          {error && (
            <div className="w-full bg-red-50 text-red-700 p-4 rounded-xl flex items-center gap-3 mb-2">
              <AlertTriangle className="w-6 h-6 shrink-0" />
              <p className="text-sm font-bold">{error}</p>
            </div>
          )}

          {!isRecording ? (
            <button
              onClick={startRecording}
              className="w-full h-14 sm:h-16 bg-black text-white text-lg sm:text-xl font-bold rounded-xl hover:bg-gray-800 transition-colors focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-600 flex items-center justify-center gap-3"
            >
              <Mic className="w-6 h-6" />
              התחל הקלטה
            </button>
          ) : (
            <button
              onClick={stopRecording}
              className="w-full h-14 sm:h-16 bg-red-600 text-white text-lg sm:text-xl font-bold rounded-xl hover:bg-red-700 transition-colors focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-red-600/50 flex items-center justify-center gap-3 shadow-[0_0_20px_rgba(220,38,38,0.4)]"
            >
              <Square className="w-6 h-6 fill-current" />
              עצור הקלטה
            </button>
          )}
        </div>
      ) : (
        <div className="flex flex-col items-center gap-6 w-full">
          <div className="w-24 h-24 bg-green-50 text-green-600 rounded-full flex items-center justify-center mb-2">
            <Mic className="w-10 h-10" />
          </div>
          
          <div className="text-center">
            <h3 className="text-2xl font-bold text-black mb-2">ההקלטה נשמרה בהצלחה</h3>
            <p className="text-gray-500 font-medium">התשובה שלך הוקלטה ותועבר לקלינאי לבדיקה</p>
          </div>
          
          <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 w-full mt-4">
            <button
              onClick={togglePlayback}
              className="flex-1 h-14 bg-gray-100 text-black font-bold text-lg rounded-xl hover:bg-gray-200 transition-colors flex items-center justify-center gap-2 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-600"
            >
              {isPlaying ? (
                <>
                  <Pause className="w-5 h-5 fill-current" />
                  השהה
                </>
              ) : (
                <>
                  <Play className="w-5 h-5 fill-current" />
                  האזן
                </>
              )}
            </button>
            <button
              onClick={handleReRecord}
              className="flex-1 h-14 bg-white border-2 border-gray-200 text-gray-700 font-bold text-lg rounded-xl hover:border-gray-300 hover:bg-gray-50 transition-colors flex items-center justify-center gap-2 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-600"
            >
              <RotateCcw className="w-5 h-5" />
              הקלט מחדש
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
