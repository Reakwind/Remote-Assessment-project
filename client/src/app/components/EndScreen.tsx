import { useEffect, useRef } from "react";
import { useAssessmentStore } from "../store/AssessmentContext";
import { ListenButton } from "./ListenButton";

export function EndScreen() {
  const { completeAssessment, completionStatus, completionError } = useAssessmentStore();
  const submittedRef = useRef(false);

  useEffect(() => {
    if (submittedRef.current) return;
    submittedRef.current = true;
    void completeAssessment();
  }, [completeAssessment]);

  const retry = () => {
    submittedRef.current = true;
    void completeAssessment();
  };

  const isCompleted = completionStatus === "completed";
  const isError = completionStatus === "error";

  return (
    <div className="flex flex-col h-full max-w-5xl mx-auto w-full">
      <div className="flex justify-between items-start mb-10">
        <div>
          <div className="text-gray-500 font-bold uppercase tracking-wider text-sm mb-3">
            14. סיום
          </div>
          <h2 className="text-4xl font-extrabold text-black">
            {isCompleted ? "המבדק הושלם" : "שומר את המבדק"}
          </h2>
        </div>
        <ListenButton
          text={isCompleted ? "תודה רבה, המבדק הושלם בהצלחה." : "אנא המתן, הנתונים נשמרים."}
          size="lg"
        />
      </div>

      <div className="bg-gray-50 p-10 rounded-2xl border border-gray-100 flex-1 min-h-[500px] flex flex-col justify-center items-center text-center">
        <div className="text-gray-600 font-medium mb-12 text-2xl max-w-2xl">
          {isCompleted && (
            <div className="text-3xl text-green-700 font-bold mt-4">
              תודה רבה!
              <br /><br />
              <span className="text-xl text-gray-600 font-medium">
                הנתונים נשמרו ויעברו כעת לניתוח של הצוות המטפל.
              </span>
            </div>
          )}

          {!isCompleted && !isError && (
            <div className="text-3xl text-blue-700 font-bold mt-4">
              שומר נתונים...
              <br /><br />
              <span className="text-xl text-gray-600 font-medium">
                אנא המתן עד לאישור שהמבדק נשמר במערכת.
              </span>
            </div>
          )}

          {isError && (
            <div className="text-3xl text-red-700 font-bold mt-4">
              השמירה לא הושלמה
              <br /><br />
              <span className="text-xl text-gray-600 font-medium">
                {completionError || "אירעה שגיאה בשמירת המבדק. נסו שוב."}
              </span>
              <button
                type="button"
                onClick={retry}
                className="mt-8 h-14 px-8 rounded-xl bg-black text-white font-bold hover:bg-gray-800"
              >
                נסה שוב
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
