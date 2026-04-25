/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState } from "react";
import { ListenButton } from "./ListenButton";
import { BaseCanvas } from "./BaseCanvas";
import { useAssessmentStore } from "../store/AssessmentContext";
import { DevStimulusNotice, useStimuliManifest } from "./StimuliManifestProvider";

export function TrailMakingTask() {
  const { state, updateTaskData } = useAssessmentStore();
  const { getAsset } = useStimuliManifest();
  
  const savedData = state.tasks.trailMaking || { strokes: [] };
  const [, setHasDrawn] = useState(savedData.strokes.length > 0);

  const handleDrawChange = (strokes: any[]) => {
    setHasDrawn(strokes.length > 0);
    updateTaskData('trailMaking', { strokes });
  };

  const handleSave = (dataUrl: string, strokes: any[][]) => {
    updateTaskData('trailMaking', { strokes }, dataUrl);
  };
  const trailTemplate = getAsset("moca-visuospatial", "trail-template");

  return (
    <div className="flex flex-col h-full max-w-5xl mx-auto w-full">
      <div className="flex justify-between items-start mb-10">
        <div>
          <div className="text-gray-500 font-bold uppercase tracking-wider text-sm mb-3">
            1. חיבור נקודות (Trail Making)
          </div>
          <h2 className="text-4xl font-extrabold text-black">
            מתח קו בין מספר לאות בסדר עולה
          </h2>
          <p className="text-gray-600 font-medium mt-2 text-xl">
            התחל ב-1, עבור ל-א, אחר כך ל-2, ואז ל-ב וכן הלאה
          </p>
        </div>
        <ListenButton text="מתח קו בין מספר לאות בסדר עולה. התחל בספרה אחת, עבור לאות א, אחר כך לספרה שתיים, לאות ב וכן הלאה. סיים בנקודת הסיום." size="lg" />
      </div>

      <div className="bg-gray-50 p-6 rounded-2xl border border-gray-100 flex-1 flex flex-col items-center justify-center relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
          {trailTemplate?.signedUrl ? (
            <img
              src={trailTemplate.signedUrl}
              alt="Trail Making template"
              className="h-[400px] w-[800px] object-contain"
            />
          ) : (
            <div className="flex flex-col items-center gap-4 opacity-70">
              <div className="w-[600px] h-[400px] border-2 border-dashed border-gray-300 rounded-lg flex items-center justify-center text-gray-400 font-bold italic">
                [Trail Making Template: 1-א-2-ב-3-ג-4-ד-5-ה]
              </div>
              <DevStimulusNotice className="pointer-events-auto" />
            </div>
          )}
        </div>

        <BaseCanvas 
          width={800} 
          height={400} 
          initialStrokes={savedData.strokes}
          onDrawChange={handleDrawChange}
          onSave={handleSave}
        />
      </div>
    </div>
  );
}
