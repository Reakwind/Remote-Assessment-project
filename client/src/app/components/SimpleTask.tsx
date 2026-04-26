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
    <div className="flex flex-col h-full max-w-5xl mx-auto w-full min-w-0">
      <div className="flex flex-col gap-4 sm:flex-row sm:justify-between sm:items-start mb-6 sm:mb-10">
        <div className="min-w-0">
          <div className="text-gray-500 font-bold uppercase tracking-wider text-xs sm:text-sm mb-2 sm:mb-3">
            {stepNumber}. {stepTitle}
          </div>
          <h2 className="text-2xl sm:text-4xl font-extrabold text-black leading-tight">{mainTitle}</h2>
        </div>
        <ListenButton text={audioText} pacedItems={pacedItems} size="lg" />
      </div>

      <div className="bg-gray-50 p-5 sm:p-10 rounded-2xl border border-gray-100 flex-1 min-h-[360px] sm:min-h-[500px] flex flex-col justify-center items-center text-center">
        <div className="text-gray-600 font-medium mb-8 sm:mb-12 text-lg sm:text-2xl max-w-2xl leading-relaxed">
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
