import { useState, useEffect } from "react";
import { useAssessmentStore } from "../store/useAssessmentStore";
import { ListenButton } from "./ListenButton";

export function VigilanceTask() {
  const { state, updateTaskData } = useAssessmentStore();
  const savedData = state.tasks.vigilance || { tapped: 0 };
  const [tapped, setTapped] = useState(savedData.tapped);

  useEffect(() => {
    updateTaskData('vigilance', { tapped });
  }, [tapped, updateTaskData]);

  return (
    <div className="flex flex-col h-full max-w-5xl mx-auto w-full">
      <div className="flex justify-between items-start mb-10">
        <div>
          <div className="text-gray-500 font-bold uppercase tracking-wider text-sm mb-3">
            7. קשב (Vigilance)
          </div>
          <h2 className="text-4xl font-extrabold text-black">
            הקש בכל פעם שתשמע את האות "א"
          </h2>
        </div>
        <ListenButton 
          text="אני אקריא סדרת אותיות. בכל פעם שאומר את האות א', עליך להקיש פעם אחת במסך." 
          pacedItems={["ו", "ב", "א", "ג", "מ", "נ", "א", "א", "י", "כ", "ל", "ב", "א", "ו", "א", "כ", "ד", "ה", "א", "א", "א", "י", "א", "מ", "ס", "ו", "א", "א", "ב"]}
          size="lg" 
        />
      </div>

      <div className="bg-gray-50 p-6 rounded-2xl border border-gray-100 flex-1 flex flex-col items-center justify-center">
        <button
          onClick={() => setTapped((prev: number) => prev + 1)}
          className="w-64 h-64 rounded-full bg-blue-100 border-4 border-blue-500 hover:bg-blue-200 active:bg-blue-300 active:scale-95 transition-all flex items-center justify-center shadow-lg focus-visible:outline-none focus-visible:ring-8 focus-visible:ring-blue-600 focus-visible:ring-opacity-50"
          aria-label="הקש כאן כשתשמע את האות א"
        >
          <span className="text-4xl font-black text-blue-900">הקש כאן</span>
        </button>
        <p className="mt-6 text-gray-500 font-medium">מספר הקשות: {tapped}</p>
      </div>
    </div>
  );
}
