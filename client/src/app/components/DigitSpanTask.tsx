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
    <div className="mx-auto flex h-full w-full max-w-5xl min-w-0 flex-col">
      <div className="mb-4 flex flex-col gap-3 sm:mb-5 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
        <div className="min-w-0">
          <div className="text-gray-500 font-bold uppercase tracking-wider text-xs sm:text-sm mb-2 sm:mb-3">
            6. קיבולת זיכרון
          </div>
          <h2 className="text-2xl font-extrabold leading-tight text-black sm:text-3xl">חזרה על מספרים</h2>
        </div>
      </div>

      <div className="flex min-w-0 flex-1 flex-col items-center justify-center rounded-xl border border-gray-100 bg-gray-50 p-3 text-center sm:rounded-2xl sm:p-5">
        <div className="mb-5 grid w-full max-w-3xl grid-cols-1 gap-3 sm:mb-6 sm:grid-cols-2 sm:gap-4">
          <div className="rounded-xl border border-gray-200 bg-white p-4 text-right shadow-sm sm:rounded-2xl sm:p-5">
            <div className="mb-2 text-xs font-extrabold uppercase tracking-wider text-gray-500 sm:mb-3 sm:text-sm">חלק ראשון</div>
            <h3 className="mb-3 text-lg font-extrabold text-black sm:mb-4 sm:text-xl">סדרה קדימה</h3>
            <p className="mb-4 text-sm font-medium leading-relaxed text-gray-600 sm:mb-5 sm:text-base">
              האזן למספרים וחזור עליהם באותו הסדר.
            </p>
            <ListenButton
              text="אקריא לך סדרת מספרים קדימה. כשאסיים, חזור עליהם בדיוק באותו הסדר."
              pacedItems={["2", "1", "8", "5", "4"]}
              size="lg"
            />
          </div>

          <div className="rounded-xl border border-gray-200 bg-white p-4 text-right shadow-sm sm:rounded-2xl sm:p-5">
            <div className="mb-2 text-xs font-extrabold uppercase tracking-wider text-gray-500 sm:mb-3 sm:text-sm">חלק שני</div>
            <h3 className="mb-3 text-lg font-extrabold text-black sm:mb-4 sm:text-xl">סדרה אחורה</h3>
            <p className="mb-4 text-sm font-medium leading-relaxed text-gray-600 sm:mb-5 sm:text-base">
              האזן למספרים וחזור עליהם בסדר הפוך.
            </p>
            <ListenButton
              text="עכשיו סדרת מספרים אחורה. כשאסיים, חזור עליהם בסדר הפוך."
              pacedItems={["7", "4", "2"]}
              size="lg"
            />
          </div>
        </div>

        <div className="mb-4 max-w-2xl text-base font-medium leading-relaxed text-gray-600 sm:mb-5 sm:text-lg">
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
