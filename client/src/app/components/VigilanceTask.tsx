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
    <div className="mx-auto flex h-full w-full max-w-5xl min-w-0 flex-col">
      <div className="mb-4 flex flex-col gap-3 sm:mb-5 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
        <div className="min-w-0">
          <div className="text-gray-500 font-bold uppercase tracking-wider text-xs sm:text-sm mb-2 sm:mb-3">
            7. קשב (Vigilance)
          </div>
          <h2 className="text-2xl font-extrabold leading-tight text-black sm:text-3xl">
            הקש בכל פעם שתשמע את האות "א"
          </h2>
        </div>
        <ListenButton 
          text="אני אקריא סדרת אותיות. בכל פעם שאומר את האות א', עליך להקיש פעם אחת במסך." 
          pacedItems={VIGILANCE_SEQUENCE}
          size="lg" 
        />
      </div>

      <div className="flex flex-1 flex-col items-center justify-center rounded-xl border border-gray-100 bg-gray-50 p-3 sm:rounded-2xl sm:p-6">
        <button
          onClick={() => setTapped((prev: number) => prev + 1)}
          className="flex h-40 w-40 items-center justify-center rounded-full border-4 border-blue-500 bg-blue-100 shadow-lg transition-all hover:bg-blue-200 active:scale-95 active:bg-blue-300 focus-visible:outline-none focus-visible:ring-8 focus-visible:ring-blue-600 focus-visible:ring-opacity-50 sm:h-56 sm:w-56 lg:h-64 lg:w-64"
          aria-label="הקש כאן כשתשמע את האות א"
        >
          <span className="text-2xl font-black text-blue-900 sm:text-4xl">הקש כאן</span>
        </button>
        <p className="mt-5 font-medium text-gray-500 sm:mt-6">מספר הקשות: {tapped}</p>
      </div>
    </div>
  );
}
