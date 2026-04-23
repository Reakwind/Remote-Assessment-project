import { useState, useRef, useEffect } from "react";
import { Mic, Square, Play, Pause, RotateCcw, AlertTriangle } from "lucide-react";
import { clsx } from "clsx";
import { AudioStore } from "../store/audioStore";
import { useAssessmentStore } from "../store/AssessmentContext";
import { edgeFn } from "../../lib/supabase";

interface AudioRecorderProps {
  taskId: string;
  initialAudioId?: string;
  onRecordingComplete: (audioId: string) => void;
}

export function AudioRecorder({
  taskId,
  initialAudioId,
  onRecordingComplete,
}: AudioRecorderProps) {
  const { state } = useAssessmentStore();
  const [isRecording, setIsRecording] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [audioId, setAudioId] = useState<string | null>(initialAudioId || null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioElementRef = useRef<HTMLAudioElement | null>(null);
  const displayAudioUrl = audioId?.startsWith("http") ? audioId : audioUrl;
  
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
      if (currentUrl) {
        URL.revokeObjectURL(currentUrl);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [audioId]);
  
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
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];
      
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };
      
      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: mediaRecorder.mimeType || 'audio/webm' });
        
        let finalIdOrUrl = `audio_${taskId}_${Date.now()}`;
        try {
          if (state.id && state.linkToken) {
            const reader = new FileReader();
            reader.readAsDataURL(audioBlob);
            reader.onloadend = async () => {
              const base64 = reader.result as string;
              const res = await fetch(edgeFn('save-audio'), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ sessionId: state.id, linkToken: state.linkToken, taskId, audioBase64: base64 })
              });
              if (res.ok) {
                const data = await res.json();
                finalIdOrUrl = data.url;
              }
              finishStop(finalIdOrUrl, audioBlob);
            };
            return;
          }
        } catch (e) {
          console.error("Audio upload failed", e);
        }
        finishStop(finalIdOrUrl, audioBlob);
      };

      const finishStop = async (idOrUrl: string, blob: Blob) => {
        if (!idOrUrl.startsWith("http")) await AudioStore.saveAudio(idOrUrl, blob);
        const url = idOrUrl.startsWith("http") ? idOrUrl : URL.createObjectURL(blob);
        setAudioUrl(url);
        setAudioId(idOrUrl);
        onRecordingComplete(idOrUrl);
        stream.getTracks().forEach(track => track.stop());
      };
      
      mediaRecorder.start();
      setIsRecording(true);
    } catch (err) {
      console.error("Microphone access denied or failed:", err);
      setError("לא ניתן לגשת למיקרופון. אנא אשר גישה למיקרופון בהגדרות הדפדפן.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
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
    <div className="flex flex-col items-center gap-6 w-full max-w-lg mx-auto bg-white p-8 rounded-3xl border border-gray-200 shadow-sm">
      {/* Hidden Audio Element for Playback */}
      {displayAudioUrl && (
        <audio ref={audioElementRef} src={displayAudioUrl} className="hidden" />
      )}
      
      {/* Visual State & Controls */}
      {!audioId ? (
        <div className="flex flex-col items-center gap-4 w-full">
          <div className={clsx(
            "w-32 h-32 rounded-full flex items-center justify-center transition-all duration-300",
            isRecording ? "bg-red-50 scale-110" : "bg-gray-50"
          )}>
            <div className={clsx(
              "w-24 h-24 rounded-full flex items-center justify-center transition-all duration-300",
              isRecording ? "bg-red-100 animate-pulse" : "bg-gray-100"
            )}>
              <Mic className={clsx(
                "w-12 h-12 transition-colors",
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
          </div>
          
          {error && (
            <div className="w-full bg-red-50 text-red-700 p-4 rounded-xl flex items-center gap-3 mb-2">
              <AlertTriangle className="w-6 h-6 shrink-0" />
              <p className="text-sm font-bold">{error}</p>
            </div>
          )}

          {!isRecording ? (
            <button
              onClick={startRecording}
              className="w-full h-16 bg-black text-white text-xl font-bold rounded-xl hover:bg-gray-800 transition-colors focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-600 flex items-center justify-center gap-3"
            >
              <Mic className="w-6 h-6" />
              התחל הקלטה
            </button>
          ) : (
            <button
              onClick={stopRecording}
              className="w-full h-16 bg-red-600 text-white text-xl font-bold rounded-xl hover:bg-red-700 transition-colors focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-red-600/50 flex items-center justify-center gap-3 shadow-[0_0_20px_rgba(220,38,38,0.4)]"
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
          
          <div className="flex gap-4 w-full mt-4">
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