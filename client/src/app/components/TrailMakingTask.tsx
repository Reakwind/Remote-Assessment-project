/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState } from "react";
import { ListenButton } from "./ListenButton";
import { BaseCanvas } from "./BaseCanvas";
import { useAssessmentStore } from "../store/AssessmentContext";
import { DevStimulusNotice, useStimuliManifest } from "./StimuliManifestProvider";

export function TrailMakingTask() {
  const { state, updateTaskData } = useAssessmentStore();
  const { getAsset, isLoading } = useStimuliManifest();
  
  const savedData = state.tasks.trailMaking || { strokes: [] };
  const [, setHasDrawn] = useState(savedData.strokes.length > 0);

  const handleDrawChange = (strokes: any[]) => {
    setHasDrawn(strokes.length > 0);
  };

  const handleSave = (dataUrl: string, strokes: any[][]) => {
    updateTaskData('trailMaking', { strokes }, dataUrl);
  };
  const trailTemplate = getAsset("moca-visuospatial", "trail-template");

  return (
    <div className="flex flex-col h-full max-w-5xl mx-auto w-full min-w-0">
      <div className="mb-4 flex flex-col gap-3 sm:mb-6 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
        <div className="min-w-0">
          <div className="text-gray-500 font-bold uppercase tracking-wider text-xs sm:text-sm mb-2 sm:mb-3">
            1. חיבור נקודות
          </div>
          <h2 className="text-2xl font-extrabold leading-tight text-black sm:text-3xl">
            מתח קו בין מספר לאות בסדר עולה
          </h2>
          <p className="text-gray-600 font-medium mt-2 text-base sm:text-xl leading-relaxed">
            התחל ב-1, עבור ל-א, אחר כך ל-2, ואז ל-ב וכן הלאה
          </p>
        </div>
        <ListenButton text="מתח קו בין מספר לאות בסדר עולה. התחל בספרה אחת, עבור לאות א, אחר כך לספרה שתיים, לאות ב וכן הלאה. סיים בנקודת הסיום." size="lg" />
      </div>

      <div className="relative flex min-w-0 flex-1 flex-col items-center justify-center overflow-hidden rounded-xl border border-gray-100 bg-gray-50 p-3 sm:rounded-2xl sm:p-6">
        {!isLoading && !trailTemplate?.signedUrl && (
          <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
            <div className="flex w-full max-w-[600px] flex-col items-center gap-4 opacity-70 px-3">
              <div className="w-full aspect-[3/2] border-2 border-dashed border-gray-300 rounded-lg flex items-center justify-center text-center text-gray-400 font-bold italic text-xs sm:text-base">
                [תבנית חיבור נקודות: 1-א-2-ב-3-ג-4-ד-5-ה]
              </div>
              <DevStimulusNotice className="pointer-events-auto" />
            </div>
          </div>
        )}

        <BaseCanvas 
          width={660}
          height={400}
          backgroundImageUrl={trailTemplate?.signedUrl}
          backgroundPadding={24}
          initialStrokes={savedData.strokes}
          onDrawChange={handleDrawChange}
          onSave={handleSave}
        />
      </div>
    </div>
  );
}
