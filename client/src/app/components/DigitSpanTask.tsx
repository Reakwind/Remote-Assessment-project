import { AudioRecorder } from "./AudioRecorder";
import { ListenButton } from "./ListenButton";
import { useAssessmentStore } from "../store/AssessmentContext";

export function DigitSpanTask() {
  const { state, updateTaskData } = useAssessmentStore();
  const savedData = state.tasks.digitSpan || { audioId: null };

  const handleRecordingComplete = (audio: {
    audioId: string;
    audioStoragePath?: string;
    audioContentType?: string;
  }) => {
    updateTaskData('digitSpan', audio);
  };

  return (
    <div className="flex flex-col h-full max-w-5xl mx-auto w-full min-w-0">
      <div className="flex flex-col gap-4 sm:flex-row sm:justify-between sm:items-start mb-6 sm:mb-10">
        <div className="min-w-0">
          <div className="text-gray-500 font-bold uppercase tracking-wider text-xs sm:text-sm mb-2 sm:mb-3">
            6. קיבולת זיכרון
          </div>
          <h2 className="text-2xl sm:text-4xl font-extrabold text-black leading-tight">חזרה על מספרים</h2>
        </div>
      </div>

      <div className="bg-gray-50 p-5 sm:p-10 rounded-2xl border border-gray-100 flex-1 min-h-[360px] sm:min-h-[500px] flex flex-col justify-center items-center text-center">
        <div className="grid w-full max-w-3xl grid-cols-1 gap-4 sm:grid-cols-2 mb-8 sm:mb-10">
          <div className="rounded-2xl border border-gray-200 bg-white p-5 text-right shadow-sm">
            <div className="mb-3 text-sm font-extrabold uppercase tracking-wider text-gray-500">חלק ראשון</div>
            <h3 className="mb-4 text-xl font-extrabold text-black">סדרה קדימה</h3>
            <p className="mb-5 text-base font-medium leading-relaxed text-gray-600">
              האזן למספרים וחזור עליהם באותו הסדר.
            </p>
            <ListenButton
              text="אקריא לך סדרת מספרים קדימה. כשאסיים, חזור עליהם בדיוק באותו הסדר."
              pacedItems={["2", "1", "8", "5", "4"]}
              size="lg"
            />
          </div>

          <div className="rounded-2xl border border-gray-200 bg-white p-5 text-right shadow-sm">
            <div className="mb-3 text-sm font-extrabold uppercase tracking-wider text-gray-500">חלק שני</div>
            <h3 className="mb-4 text-xl font-extrabold text-black">סדרה אחורה</h3>
            <p className="mb-5 text-base font-medium leading-relaxed text-gray-600">
              האזן למספרים וחזור עליהם בסדר הפוך.
            </p>
            <ListenButton
              text="עכשיו סדרת מספרים אחורה. כשאסיים, חזור עליהם בסדר הפוך."
              pacedItems={["7", "4", "2"]}
              size="lg"
            />
          </div>
        </div>

        <div className="text-gray-600 font-medium mb-6 text-lg sm:text-2xl max-w-2xl leading-relaxed">
          לחץ על התחל הקלטה ועצור רק אחרי שני החלקים. יש לך עד דקה להשלים את המשימה.
        </div>

        <AudioRecorder
          taskId="digitSpan"
          initialAudioId={savedData.audioId}
          maxDurationSeconds={60}
          onRecordingComplete={handleRecordingComplete}
        />
      </div>
    </div>
  );
}
