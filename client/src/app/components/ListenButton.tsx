import { useState, useRef, useEffect } from "react";
import { AlertCircle, Volume2 } from "lucide-react";
import { clsx } from "clsx";

interface ListenButtonProps {
  text?: string;
  pacedItems?: string[];
  size?: "md" | "lg";
  className?: string;
}

const PACED_ITEM_INTERVAL_MS = 1000;

function hasSpeechSupport() {
  return typeof window !== "undefined" && "speechSynthesis" in window && "SpeechSynthesisUtterance" in window;
}

function preferredHebrewVoice() {
  if (!hasSpeechSupport()) return null;
  return window.speechSynthesis.getVoices().find((voice) => voice.lang.toLowerCase().startsWith("he")) ?? null;
}

export function ListenButton({ text, pacedItems, size = "md", className }: ListenButtonProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isSupported, setIsSupported] = useState(() => hasSpeechSupport());
  const [hasPlaybackError, setHasPlaybackError] = useState(false);
  const isCancelledRef = useRef(false);
  const timeoutRef = useRef<number | null>(null);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      isCancelledRef.current = true;
      if (timeoutRef.current !== null) window.clearTimeout(timeoutRef.current);
      if (hasSpeechSupport()) window.speechSynthesis.cancel();
    };
  }, []);

  const handlePlay = async () => {
    if (!hasSpeechSupport()) {
      setIsSupported(false);
      setHasPlaybackError(true);
      return;
    }

    if (isPlaying) {
      isCancelledRef.current = true;
      window.speechSynthesis.cancel();
      setIsPlaying(false);
      return;
    }

    isCancelledRef.current = false;
    setHasPlaybackError(false);
    setIsPlaying(true);
    const voice = preferredHebrewVoice();

    if (text) {
      // Speak introductory text first
      await new Promise<void>((resolve) => {
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = "he-IL";
        utterance.voice = voice;
        utterance.rate = 0.9;
        utterance.onend = () => {
          if (isCancelledRef.current) return resolve();
          if (pacedItems && pacedItems.length > 0) {
            timeoutRef.current = window.setTimeout(resolve, 1000); // 1 second pause before paced items
          } else {
            resolve();
          }
        };
        utterance.onerror = () => {
          setHasPlaybackError(true);
          resolve();
        };
        window.speechSynthesis.speak(utterance);
      });
    }

    if (isCancelledRef.current) {
      setIsPlaying(false);
      return;
    }

    if (pacedItems && pacedItems.length > 0) {
      // Paced delivery (e.g. 1 word per second)
      for (let i = 0; i < pacedItems.length; i++) {
        if (isCancelledRef.current) break;

        await new Promise<void>((resolve) => {
          const utterance = new SpeechSynthesisUtterance(pacedItems[i]);
          utterance.lang = "he-IL";
          utterance.voice = voice;
          utterance.rate = 0.9;
          let startedAt = performance.now();

          utterance.onstart = () => {
            startedAt = performance.now();
          };
          
          utterance.onend = () => {
            if (isCancelledRef.current) return resolve();
            const elapsed = performance.now() - startedAt;
            timeoutRef.current = window.setTimeout(resolve, Math.max(0, PACED_ITEM_INTERVAL_MS - elapsed));
          };
          
          utterance.onerror = () => {
            setHasPlaybackError(true);
            resolve();
          };
          
          window.speechSynthesis.speak(utterance);
        });
      }
    }
    
    if (!isCancelledRef.current) setIsPlaying(false);
  };

  const isLg = size === "lg";
  const isDisabled = !isSupported;

  return (
    <div className={clsx("flex w-full flex-col items-stretch gap-2 sm:w-fit", className)}>
      <button
        onClick={handlePlay}
        disabled={isDisabled}
        aria-label={isPlaying ? "משמיע…" : "השמע הוראות"}
        className={clsx(
          "flex w-full items-center justify-center gap-2 rounded-full font-bold whitespace-nowrap outline-none transition-all focus-visible:ring-4 focus-visible:ring-blue-600 focus-visible:ring-opacity-50 sm:w-fit sm:gap-3",
          isLg ? "h-12 px-4 text-base sm:h-16 sm:px-6 sm:text-xl" : "h-[52px] px-5 text-lg",
          isDisabled
            ? "cursor-not-allowed bg-amber-50 text-amber-900 ring-1 ring-amber-200"
            : isPlaying
              ? "bg-black text-white"
              : "bg-gray-100 text-gray-900 hover:bg-gray-200",
        )}
      >
        <span>{isDisabled ? "אין תמיכת שמע" : isPlaying ? "משמיע…" : "השמע הוראות"}</span>
        {isPlaying ? (
          <div className="flex h-5 w-5 items-end gap-[2px]">
            <div className="w-[3px] rounded-full bg-white animate-[pulse_1s_ease-in-out_infinite_alternate]" style={{ height: "40%" }} />
            <div className="w-[3px] rounded-full bg-white animate-[pulse_0.8s_ease-in-out_infinite_alternate-reverse]" style={{ height: "80%" }} />
            <div className="w-[3px] rounded-full bg-white animate-[pulse_1.2s_ease-in-out_infinite_alternate]" style={{ height: "100%" }} />
            <div className="w-[3px] rounded-full bg-white animate-[pulse_0.9s_ease-in-out_infinite_alternate-reverse]" style={{ height: "60%" }} />
          </div>
        ) : isDisabled ? (
          <AlertCircle className={clsx(isLg ? "h-6 w-6" : "h-5 w-5")} />
        ) : (
          <Volume2 className={clsx(isLg ? "h-6 w-6" : "h-5 w-5")} />
        )}
      </button>
      {hasPlaybackError && (
        <p className="max-w-xs text-right text-xs font-bold leading-relaxed text-amber-900">
          לא ניתן להשמיע הוראות במכשיר זה. ודא שהשמע פעיל או פנה לקלינאי.
        </p>
      )}
    </div>
  );
}
