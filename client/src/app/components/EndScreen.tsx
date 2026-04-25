import { useEffect } from "react";
import { useAssessmentStore } from "../store/useAssessmentStore";
import { ListenButton } from "./ListenButton";

export function EndScreen() {
  const { completeAssessment } = useAssessmentStore();

  useEffect(() => {
    completeAssessment();
  }, [completeAssessment]);

  return (
    <div data-testid="patient-complete" className="flex flex-col h-full max-w-5xl mx-auto w-full">
      <div className="flex justify-between items-start mb-10">
        <div>
          <div className="text-gray-500 font-bold uppercase tracking-wider text-sm mb-3">
            14. סיום
          </div>
          <h2 className="text-4xl font-extrabold text-black">המבדק הושלם</h2>
        </div>
        <ListenButton text="תודה רבה, המבדק הושלם בהצלחה." size="lg" />
      </div>

      <div className="bg-gray-50 p-10 rounded-2xl border border-gray-100 flex-1 min-h-[500px] flex flex-col justify-center items-center text-center">
        <div className="text-gray-600 font-medium mb-12 text-2xl max-w-2xl">
          <div className="text-3xl text-green-700 font-bold mt-4">
            תודה רבה!
            <br /><br />
            <span className="text-xl text-gray-600 font-medium">
              הנתונים נשמרו ויעברו כעת לניתוח של הצוות המטפל.
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
