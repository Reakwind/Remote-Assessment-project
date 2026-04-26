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
      <div className="flex flex-col gap-4 sm:flex-row sm:justify-between sm:items-start mb-6 sm:mb-10">
        <div className="min-w-0">
          <div className="text-gray-500 font-bold uppercase tracking-wider text-xs sm:text-sm mb-2 sm:mb-3">
            2. העתקת קובייה
          </div>
          <h2 className="text-2xl sm:text-4xl font-extrabold text-black leading-tight">
            העתק את הציור של הקובייה
          </h2>
          <p className="text-gray-600 font-medium mt-2 text-base sm:text-xl">
            נסה לדייק ככל האפשר
          </p>
        </div>
        <ListenButton text="העתק את הציור של הקובייה באופן מדויק ככל האפשר." size="lg" />
      </div>

      <div className="bg-gray-50 p-3 sm:p-6 rounded-2xl border border-gray-100 flex-1 flex flex-col items-center justify-center min-w-0">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8 w-full max-w-4xl">
          <div className="flex flex-col items-center gap-4">
            <span className="text-gray-500 font-bold uppercase tracking-widest text-sm">המקור</span>
            <div className="bg-white p-4 sm:p-6 rounded-xl border border-gray-200 shadow-sm w-full aspect-square flex flex-col items-center justify-center gap-4">
              {cubeStimulus?.signedUrl ? (
                <img
                  src={cubeStimulus.signedUrl}
                  alt="Cube copy stimulus"
                  className="h-44 w-44 sm:h-56 sm:w-56 object-contain"
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
              width={400} 
              height={400} 
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
