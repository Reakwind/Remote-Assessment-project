import { ListenButton } from "./ListenButton";
import { BaseCanvas } from "./BaseCanvas";
import { useAssessmentStore } from "../store/useAssessmentStore";

export function ClockTask() {
  const { state, updateTaskData } = useAssessmentStore();
  
  const savedData = state.tasks.clock || { strokes: [] };
  const handleDrawChange = (nextStrokes: any[]) => {
    updateTaskData('clock', { strokes: nextStrokes });
  };

  const handleSave = (dataUrl: string, savedStrokes: any[][]) => {
    updateTaskData('clock', { strokes: savedStrokes }, dataUrl);
  };

  return (
    <div className="flex flex-col h-full max-w-5xl mx-auto w-full">
      <div className="flex justify-between items-start mb-10">
        <div>
          <div className="text-gray-500 font-bold uppercase tracking-wider text-sm mb-3">
            3. ציור שעון
          </div>
          <h2 className="text-4xl font-extrabold text-black">
            צייר שעון עגול וגדול
          </h2>
          <p className="text-gray-600 font-medium mt-2 text-xl">
            כולל את כל המספרים
            <br />
            הראה את השעה: <strong>אחת עשרה ועשרה</strong> (11:10)
          </p>
        </div>
        <ListenButton text="צייר שעון, הכנס בו את כל המספרים וכוון את השעה לאחת עשרה ועשרה." size="lg" />
      </div>

      <div className="bg-gray-50 p-6 rounded-2xl border border-gray-100 flex-1 flex flex-col items-center justify-center">
        <BaseCanvas 
          width={700} 
          height={400} 
          initialStrokes={savedData.strokes}
          onDrawChange={handleDrawChange}
          onSave={handleSave}
        />
      </div>
    </div>
  );
}
