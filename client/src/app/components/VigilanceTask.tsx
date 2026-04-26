import { useState, useEffect } from "react";
import { useAssessmentStore } from "../store/AssessmentContext";
import { ListenButton } from "./ListenButton";

const TARGET_LETTER = "א";
const VIGILANCE_SEQUENCE = ["ו", "ב", "א", "ג", "מ", "נ", "א", "א", "י", "כ", "ל", "ב", "א", "ו", "א", "כ", "ד", "ה", "א", "א", "א", "י", "א", "מ", "ס", "ו", "א", "א", "ב"];
const TARGET_COUNT = VIGILANCE_SEQUENCE.filter((letter) => letter === TARGET_LETTER).length;

function scoreTapCount(tapped: number) {
  return tapped >= TARGET_COUNT - 1 && tapped <= TARGET_COUNT + 1 ? 1 : 0;
}

export function VigilanceTask() {
  const { state, updateTaskData } = useAssessmentStore();
  const savedData = state.tasks.vigilance || { tapped: 0 };
  const [tapped, setTapped] = useState(savedData.tapped);

  useEffect(() => {
    updateTaskData('vigilance', {
      tapped,
      targetLetter: TARGET_LETTER,
      targetCount: TARGET_COUNT,
      sequenceLength: VIGILANCE_SEQUENCE.length,
      score: scoreTapCount(tapped),
    });
  }, [tapped, updateTaskData]);

  return (
    <div className="flex flex-col h-full max-w-5xl mx-auto w-full min-w-0">
      <div className="flex flex-col gap-4 sm:flex-row sm:justify-between sm:items-start mb-6 sm:mb-10">
        <div className="min-w-0">
          <div className="text-gray-500 font-bold uppercase tracking-wider text-xs sm:text-sm mb-2 sm:mb-3">
            7. קשב (Vigilance)
          </div>
          <h2 className="text-2xl sm:text-4xl font-extrabold text-black leading-tight">
            הקש בכל פעם שתשמע את האות "א"
          </h2>
        </div>
        <ListenButton 
          text="אני אקריא סדרת אותיות. בכל פעם שאומר את האות א', עליך להקיש פעם אחת במסך." 
          pacedItems={VIGILANCE_SEQUENCE}
          size="lg" 
        />
      </div>

      <div className="bg-gray-50 p-5 sm:p-6 rounded-2xl border border-gray-100 flex-1 flex flex-col items-center justify-center">
        <button
          onClick={() => setTapped((prev: number) => prev + 1)}
          className="w-48 h-48 sm:w-64 sm:h-64 rounded-full bg-blue-100 border-4 border-blue-500 hover:bg-blue-200 active:bg-blue-300 active:scale-95 transition-all flex items-center justify-center shadow-lg focus-visible:outline-none focus-visible:ring-8 focus-visible:ring-blue-600 focus-visible:ring-opacity-50"
          aria-label="הקש כאן כשתשמע את האות א"
        >
          <span className="text-3xl sm:text-4xl font-black text-blue-900">הקש כאן</span>
        </button>
        <p className="mt-6 text-gray-500 font-medium">מספר הקשות: {tapped}</p>
      </div>
    </div>
  );
}
