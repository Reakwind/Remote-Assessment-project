import { useState, useRef, useEffect } from "react";
import { Volume2 } from "lucide-react";
import { clsx } from "clsx";

interface ListenButtonProps {
  text?: string;
  pacedItems?: string[];
  size?: "md" | "lg";
  className?: string;
}

const PACED_ITEM_INTERVAL_MS = 1000;

export function ListenButton({ text, pacedItems, size = "md", className }: ListenButtonProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const isCancelledRef = useRef(false);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      isCancelledRef.current = true;
      window.speechSynthesis.cancel();
    };
  }, []);

  const handlePlay = async () => {
    if (isPlaying) {
      isCancelledRef.current = true;
      window.speechSynthesis.cancel();
      setIsPlaying(false);
      return;
    }

    isCancelledRef.current = false;
    setIsPlaying(true);

    if (text) {
      // Speak introductory text first
      await new Promise<void>((resolve) => {
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = "he-IL";
        utterance.rate = 0.9;
        utterance.onend = () => {
          if (isCancelledRef.current) return resolve();
          if (pacedItems && pacedItems.length > 0) {
            setTimeout(resolve, 1000); // 1 second pause before paced items
          } else {
            resolve();
          }
        };
        utterance.onerror = () => resolve();
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
          utterance.rate = 0.9;
          let startedAt = performance.now();

          utterance.onstart = () => {
            startedAt = performance.now();
          };
          
          utterance.onend = () => {
            if (isCancelledRef.current) return resolve();
            const elapsed = performance.now() - startedAt;
            window.setTimeout(resolve, Math.max(0, PACED_ITEM_INTERVAL_MS - elapsed));
          };
          
          utterance.onerror = () => {
            resolve();
          };
          
          window.speechSynthesis.speak(utterance);
        });
      }
    }
    
    if (!isCancelledRef.current) setIsPlaying(false);
  };

  const isLg = size === "lg";

  return (
    <button
      onClick={handlePlay}
      aria-label={isPlaying ? "משמיע…" : "השמע הוראות"}
      className={clsx(
        "flex w-fit items-center gap-2 sm:gap-3 rounded-full font-bold transition-all whitespace-nowrap outline-none focus-visible:ring-4 focus-visible:ring-blue-600 focus-visible:ring-opacity-50",
        isLg ? "h-12 sm:h-16 px-4 sm:px-6 text-base sm:text-xl" : "h-[52px] px-5 text-lg",
        isPlaying ? "bg-black text-white" : "bg-gray-100 text-gray-900 hover:bg-gray-200",
        className
      )}
    >
      <span>{isPlaying ? "משמיע…" : "השמע הוראות"}</span>
      {isPlaying ? (
        <div className="flex gap-[2px] items-end h-5 w-5">
          <div className="w-[3px] bg-white rounded-full animate-[pulse_1s_ease-in-out_infinite_alternate]" style={{ height: "40%" }} />
          <div className="w-[3px] bg-white rounded-full animate-[pulse_0.8s_ease-in-out_infinite_alternate-reverse]" style={{ height: "80%" }} />
          <div className="w-[3px] bg-white rounded-full animate-[pulse_1.2s_ease-in-out_infinite_alternate]" style={{ height: "100%" }} />
          <div className="w-[3px] bg-white rounded-full animate-[pulse_0.9s_ease-in-out_infinite_alternate-reverse]" style={{ height: "60%" }} />
        </div>
      ) : (
        <Volume2 className={clsx(isLg ? "w-6 h-6" : "w-5 h-5")} />
      )}
    </button>
  );
}
