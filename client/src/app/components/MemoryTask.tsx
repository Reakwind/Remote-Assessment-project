import { ListenButton } from "./ListenButton";
import { AudioRecorder } from "./AudioRecorder";
import { useAssessmentStore } from "../store/useAssessmentStore";

export function MemoryTask() {
  const { state, updateTaskData } = useAssessmentStore();
  const savedData = state.tasks.memory || { audioId: null };
  
  // 5 words for MoCA memory in Hebrew
  const words = ["פנים", "קטיפה", "כנסייה", "חרצית", "אדום"];

  const handleRecordingComplete = (audioId: string, audioBlob: Blob) => {
    updateTaskData('memory', { audioId }, undefined, audioBlob);
  };
  
  return (
    <div className="flex flex-col h-full max-w-5xl mx-auto w-full">
      <div className="flex justify-between items-start mb-10">
        <div>
          <div className="text-gray-500 font-bold uppercase tracking-wider text-sm mb-3">
            משימת זיכרון · למידה
          </div>
          <h2 className="text-4xl font-extrabold text-black">זכור את המילים הבאות</h2>
        </div>
        <ListenButton 
          text="אקריא לך כעת רשימת מילים שעליך לזכור. הקשב היטב וכשאסיים, חזור על כל המילים שאתה זוכר, באיזה סדר שתרצה." 
          pacedItems={words} 
          size="lg" 
        />
      </div>

      <div className="bg-gray-50 p-10 rounded-2xl border border-gray-100 flex-1 min-h-[500px] flex flex-col justify-center items-center text-center">
        <div className="text-gray-600 font-medium mb-12 text-2xl max-w-2xl">
          המערכת תקריא 5 מילים. עליך להקשיב היטב, לזכור אותן, ולחזור עליהן כעת על ידי הקלטת קולך.
          <br /><br />
          תתבקש לחזור עליהן שוב בסוף המבדק.
        </div>
        
        <AudioRecorder 
          taskId="memory" 
          initialAudioId={savedData.audioId}
          onRecordingComplete={handleRecordingComplete} 
        />
      </div>
    </div>
  );
}
