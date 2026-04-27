/* eslint-disable @typescript-eslint/no-explicit-any */
import { ListenButton } from "./ListenButton";
import { AudioRecorder } from "./AudioRecorder";
import { useAssessmentStore } from "../store/AssessmentContext";

export function SimpleTask({
  stepNumber,
  stepTitle,
  mainTitle,
  description,
  audioText,
  pacedItems,
  taskId,
  maxRecordingSeconds,
}: {
  stepNumber: number;
  stepTitle: string;
  mainTitle: string;
  description: React.ReactNode;
  audioText: string;
  pacedItems?: string[];
  taskId: string;
  maxRecordingSeconds?: number;
}) {
  const { state, updateTaskData } = useAssessmentStore();
  // Safe cast since tasks is an indexable object in the store
  const savedData = (state.tasks as any)[taskId] || { audioId: null };

  const handleRecordingComplete = (audio: {
    audioId: string;
    audioStoragePath?: string;
    audioContentType?: string;
  }) => {
    updateTaskData(taskId as any, audio);
  };

  return (
    <div className="mx-auto flex h-full w-full max-w-5xl min-w-0 flex-col">
      <div className="mb-4 flex flex-col gap-3 sm:mb-5 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
        <div className="min-w-0">
          <div className="text-gray-500 font-bold uppercase tracking-wider text-xs sm:text-sm mb-2 sm:mb-3">
            {stepNumber}. {stepTitle}
          </div>
          <h2 className="text-2xl font-extrabold leading-tight text-black sm:text-3xl">{mainTitle}</h2>
        </div>
        <ListenButton text={audioText} pacedItems={pacedItems} size="lg" />
      </div>

      <div className="flex min-w-0 flex-1 flex-col items-center justify-center rounded-xl border border-gray-100 bg-gray-50 p-3 text-center sm:rounded-2xl sm:p-5 md:grid md:grid-cols-[minmax(0,1fr)_minmax(300px,380px)] md:gap-6">
        <div className="mb-4 max-w-2xl text-base font-medium leading-relaxed text-gray-600 sm:mb-5 sm:text-lg md:mb-0 md:text-right">
          {description}
        </div>
        
        <AudioRecorder 
          taskId={taskId}
          initialAudioId={savedData.audioId}
          maxDurationSeconds={maxRecordingSeconds}
          onRecordingComplete={handleRecordingComplete}
        />
      </div>
    </div>
  );
}
