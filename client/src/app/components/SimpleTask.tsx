import { ListenButton } from "./ListenButton";
import { AudioRecorder } from "./AudioRecorder";
import { useAssessmentStore } from "../store/useAssessmentStore";

export function SimpleTask({
  stepNumber,
  stepTitle,
  mainTitle,
  description,
  audioText,
  pacedItems,
  taskId,
}: {
  stepNumber: number;
  stepTitle: string;
  mainTitle: string;
  description: React.ReactNode;
  audioText: string;
  pacedItems?: string[];
  taskId: string;
}) {
  const { state, updateTaskData } = useAssessmentStore();
  // Safe cast since tasks is an indexable object in the store
  const savedData = (state.tasks as any)[taskId] || { audioId: null };

  const handleRecordingComplete = (audioId: string, audioBlob: Blob) => {
    updateTaskData(taskId as any, { audioId }, undefined, audioBlob);
  };

  return (
    <div className="flex flex-col h-full max-w-5xl mx-auto w-full">
      <div className="flex justify-between items-start mb-10">
        <div>
          <div className="text-gray-500 font-bold uppercase tracking-wider text-sm mb-3">
            {stepNumber}. {stepTitle}
          </div>
          <h2 className="text-4xl font-extrabold text-black">{mainTitle}</h2>
        </div>
        <ListenButton text={audioText} pacedItems={pacedItems} size="lg" />
      </div>

      <div className="bg-gray-50 p-10 rounded-2xl border border-gray-100 flex-1 min-h-[500px] flex flex-col justify-center items-center text-center">
        <div className="text-gray-600 font-medium mb-12 text-2xl max-w-2xl">
          {description}
        </div>
        
        <AudioRecorder 
          taskId={taskId}
          initialAudioId={savedData.audioId}
          onRecordingComplete={handleRecordingComplete}
        />
      </div>
    </div>
  );
}
