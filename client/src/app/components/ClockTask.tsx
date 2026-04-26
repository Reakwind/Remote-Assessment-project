/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState } from "react";
import { ListenButton } from "./ListenButton";
import { BaseCanvas } from "./BaseCanvas";
import { useAssessmentStore } from "../store/AssessmentContext";

export function ClockTask() {
  const { state, updateTaskData } = useAssessmentStore();
  
  const savedData = state.tasks.clock || { strokes: [] };
  const [, setHasDrawn] = useState(savedData.strokes.length > 0);

  const handleDrawChange = (strokes: any[]) => {
    setHasDrawn(strokes.length > 0);
  };

  const handleSave = (dataUrl: string, strokes: any[][]) => {
    // Sync base64 image
    updateTaskData('clock', { strokes }, dataUrl);
  };

  return (
    <div className="flex flex-col h-full max-w-5xl mx-auto w-full min-w-0">
      <div className="flex flex-col gap-4 sm:flex-row sm:justify-between sm:items-start mb-6 sm:mb-10">
        <div className="min-w-0">
          <div className="text-gray-500 font-bold uppercase tracking-wider text-xs sm:text-sm mb-2 sm:mb-3">
            3. ציור שעון
          </div>
          <h2 className="text-2xl sm:text-4xl font-extrabold text-black leading-tight">
            צייר שעון עגול וגדול
          </h2>
          <p className="text-gray-600 font-medium mt-2 text-base sm:text-xl leading-relaxed">
            כולל את כל המספרים
            <br />
            הראה את השעה: <strong>אחת עשרה ועשרה</strong> (11:10)
          </p>
        </div>
        <ListenButton text="צייר שעון, הכנס בו את כל המספרים וכוון את השעה לאחת עשרה ועשרה." size="lg" />
      </div>

      <div className="bg-gray-50 p-3 sm:p-6 rounded-2xl border border-gray-100 flex-1 flex flex-col items-center justify-center min-w-0">
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
