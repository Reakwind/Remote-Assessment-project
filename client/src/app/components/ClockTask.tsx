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
      <div className="mb-4 flex flex-col gap-3 sm:mb-6 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
        <div className="min-w-0">
          <div className="text-gray-500 font-bold uppercase tracking-wider text-xs sm:text-sm mb-2 sm:mb-3">
            3. ציור שעון
          </div>
          <h2 className="text-2xl font-extrabold leading-tight text-black sm:text-3xl">
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

      <div className="flex min-w-0 flex-1 flex-col items-center justify-center rounded-xl border border-gray-100 bg-gray-50 p-3 sm:rounded-2xl sm:p-6">
        <BaseCanvas 
          width={500}
          height={300}
          initialStrokes={savedData.strokes}
          onDrawChange={handleDrawChange}
          onSave={handleSave}
        />
      </div>
    </div>
  );
}
