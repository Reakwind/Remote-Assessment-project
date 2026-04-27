/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState } from "react";
import { ListenButton } from "./ListenButton";
import { BaseCanvas } from "./BaseCanvas";
import { useAssessmentStore } from "../store/AssessmentContext";
import { DevStimulusNotice, useStimuliManifest } from "./StimuliManifestProvider";

export function CubeTask() {
  const { state, updateTaskData } = useAssessmentStore();
  const { getAsset, isLoading } = useStimuliManifest();
  
  const savedData = state.tasks.cube || { strokes: [] };
  const [, setHasDrawn] = useState(savedData.strokes.length > 0);

  const handleDrawChange = (strokes: any[]) => {
    setHasDrawn(strokes.length > 0);
  };

  const handleSave = (dataUrl: string, strokes: any[][]) => {
    updateTaskData('cube', { strokes }, dataUrl);
  };
  const cubeStimulus = getAsset("moca-cube", "cube-stimulus");

  return (
    <div className="flex flex-col h-full max-w-5xl mx-auto w-full min-w-0">
      <div className="mb-4 flex flex-col gap-3 sm:mb-6 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
        <div className="min-w-0">
          <div className="text-gray-500 font-bold uppercase tracking-wider text-xs sm:text-sm mb-2 sm:mb-3">
            2. העתקת קובייה
          </div>
          <h2 className="text-2xl font-extrabold leading-tight text-black sm:text-3xl">
            העתק את הציור של הקובייה
          </h2>
          <p className="text-gray-600 font-medium mt-2 text-base sm:text-xl">
            נסה לדייק ככל האפשר
          </p>
        </div>
        <ListenButton text="העתק את הציור של הקובייה באופן מדויק ככל האפשר." size="lg" />
      </div>

      <div className="flex min-w-0 flex-1 flex-col items-center justify-center rounded-xl border border-gray-100 bg-gray-50 p-3 sm:rounded-2xl sm:p-6">
        <div className="grid w-full max-w-4xl grid-cols-1 gap-5 lg:grid-cols-[minmax(220px,0.8fr)_minmax(300px,1fr)] lg:gap-8">
          <div className="flex flex-col items-center gap-4">
            <span className="text-gray-500 font-bold uppercase tracking-widest text-sm">המקור</span>
            <div className="flex aspect-[4/3] w-full flex-col items-center justify-center gap-3 rounded-xl border border-gray-200 bg-white p-4 shadow-sm sm:aspect-square sm:p-6">
              {cubeStimulus?.signedUrl ? (
                <img
                  src={cubeStimulus.signedUrl}
                  alt="Cube copy stimulus"
                  className="h-32 w-32 object-contain sm:h-48 sm:w-48 lg:h-56 lg:w-56"
                />
              ) : !isLoading ? (
                <>
                  <svg viewBox="0 0 100 100" className="w-48 h-48" aria-label="Development cube placeholder">
                    <path d="M20 40 L50 40 L50 70 L20 70 Z" fill="none" stroke="black" strokeWidth="2" />
                    <path d="M40 20 L70 20 L70 50 L40 50 Z" fill="none" stroke="black" strokeWidth="2" />
                    <path d="M20 40 L40 20 M50 40 L70 20 M50 70 L70 50 M20 70 L40 50" fill="none" stroke="black" strokeWidth="2" />
                  </svg>
                  <DevStimulusNotice className="w-full text-center" />
                </>
              ) : null}
            </div>
          </div>
          <div className="flex flex-col items-center gap-4">
            <span className="text-gray-500 font-bold uppercase tracking-widest text-sm">הציור שלך</span>
            <BaseCanvas 
              width={340}
              height={340}
              initialStrokes={savedData.strokes}
              onDrawChange={handleDrawChange}
              onSave={handleSave}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
