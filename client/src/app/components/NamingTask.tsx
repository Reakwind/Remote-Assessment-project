import { useState } from "react";
import { ListenButton } from "./ListenButton";
import { clsx } from "clsx";
import { useAssessmentStore } from "../store/AssessmentContext";
import { DevStimulusNotice, useStimuliManifest } from "./StimuliManifestProvider";
import { DEFAULT_MOCA_VERSION, type MocaVersion } from "../../lib/scoring/moca-config";

interface NamingItem {
  id: "item-1" | "item-2" | "item-3";
  assetId: "item-1" | "item-2" | "item-3";
  name: string;
  options: string[];
}

const NAMING_ITEMS_BY_VERSION: Record<MocaVersion, NamingItem[]> = {
  "8.1": [
    { id: "item-1", assetId: "item-1", name: "אריה", options: ["נמר", "אריה", "כלב", "חתול"] },
    { id: "item-2", assetId: "item-2", name: "קרנף", options: ["פיל", "קרנף", "היפופוטם", "זברה"] },
    { id: "item-3", assetId: "item-3", name: "גמל", options: ["סוס", "גמל", "פרד", "שור"] },
  ],
  "8.2": [
    { id: "item-1", assetId: "item-1", name: "נחש", options: ["נחש", "תולעת", "לטאה", "צב"] },
    { id: "item-2", assetId: "item-2", name: "פיל", options: ["קרנף", "פיל", "היפופוטם", "גמל"] },
    { id: "item-3", assetId: "item-3", name: "תנין", options: ["לטאה", "תנין", "נחש", "צב"] },
  ],
  "8.3": [
    { id: "item-1", assetId: "item-1", name: "סוס", options: ["חמור", "פרד", "סוס", "גמל"] },
    { id: "item-2", assetId: "item-2", name: "נמר", options: ["אריה", "נמר", "ברדלס", "חתול"] },
    { id: "item-3", assetId: "item-3", name: "ברווז", options: ["אווז", "תרנגול", "ברווז", "ברבור"] },
  ],
};

export function NamingTask() {
  const { state, updateTaskData } = useAssessmentStore();
  const { getAsset } = useStimuliManifest();
  const [currentIndex, setCurrentIndex] = useState(0);
  const mocaVersion = (state.scoringContext?.mocaVersion ?? DEFAULT_MOCA_VERSION) as MocaVersion;
  const namingItems = NAMING_ITEMS_BY_VERSION[mocaVersion] ?? NAMING_ITEMS_BY_VERSION[DEFAULT_MOCA_VERSION];
  
  const savedData = state.tasks.naming || { answers: {} };
  const [answers, setAnswers] = useState<Record<string, string>>(savedData.answers);

  const currentAnimal = namingItems[currentIndex];
  const stimulusAsset = getAsset("moca-naming", currentAnimal.assetId);
  const imageSrc = stimulusAsset?.signedUrl ?? null;
  const selectedAnswer = answers[currentAnimal.id];
  const isAnswered = !!selectedAnswer;

  const handleSelect = (option: string) => {
    const nextAnswers = { ...answers, [currentAnimal.id]: option };
    setAnswers(nextAnswers);
    updateTaskData('naming', { answers: nextAnswers });
  };

  const handleNext = () => {
    if (currentIndex < namingItems.length - 1) {
      setCurrentIndex((prev: number) => prev + 1);
    }
  };

  return (
    <div className="flex flex-col h-full max-w-5xl mx-auto w-full min-w-0">
      <div className="flex flex-col gap-4 sm:flex-row sm:justify-between sm:items-start mb-6 sm:mb-10">
        <div className="min-w-0">
          <div className="text-gray-500 font-bold uppercase tracking-wider text-xs sm:text-sm mb-2 sm:mb-3">
            משימת שיום · פריט {currentIndex + 1} מתוך 3
          </div>
          <h2 className="text-2xl sm:text-4xl font-extrabold text-black leading-tight">מה שם החיה בתמונה?</h2>
        </div>
        <ListenButton text="מה שם החיה בתמונה?" size="lg" />
      </div>

      {/* Progress Pips */}
      <div className="flex gap-2 mb-6 sm:mb-12">
        {namingItems.map((_, i) => (
          <div
            key={i}
              className={clsx(
                "h-2 rounded-full transition-all duration-300",
                i === currentIndex ? "w-12 bg-black" : "w-8",
                i < (currentIndex || 0) ? "bg-gray-500" : "bg-gray-200"
              )}
            />
          ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5 sm:gap-10 bg-gray-50 p-5 sm:p-10 rounded-2xl border border-gray-100 flex-1 min-h-[360px] sm:min-h-[500px]">
        {/* Right half (RTL): Image */}
        <div className="flex flex-col items-center justify-center gap-4 bg-white rounded-xl shadow-sm border border-gray-100 p-4 sm:p-8">
          {imageSrc ? (
            <img
              src={imageSrc}
              alt="Animal outline"
              className="w-full max-w-[360px] aspect-square object-contain rounded-lg shadow-inner grayscale contrast-125"
            />
          ) : (
            <DevStimulusNotice className="w-full text-center" />
          )}
        </div>

        {/* Left half (RTL): Answers */}
        <div className="flex flex-col gap-4 justify-center">
          <div className="text-gray-500 font-medium mb-2 text-base sm:text-lg text-center">
            בחר תשובה, או אמור את השם בקול רם
          </div>
          <div className="grid grid-cols-1 gap-4">
            {currentAnimal.options.map((option) => {
              const isSelected = selectedAnswer === option;
              
              let btnClass = "bg-white border-2 border-gray-200 text-gray-800 hover:border-black";
              
              if (isAnswered) {
                if (isSelected) {
                  btnClass = "bg-blue-50 border-blue-600 text-blue-950 shadow-[0_0_0_3px_rgba(37,99,235,0.18)]";
                } else {
                  btnClass = "bg-white border-gray-100 text-gray-500";
                }
              }

              return (
                <button
                  key={option}
                  onClick={() => handleSelect(option)}
                  aria-pressed={isSelected}
                  className={clsx(
                    "min-h-14 sm:min-h-[72px] rounded-xl text-xl sm:text-2xl font-bold flex items-center justify-between px-5 sm:px-8 transition-all relative overflow-hidden focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-600",
                    btnClass
                  )}
                >
                  <span>{option}</span>
                  {isSelected && <span className="text-base sm:text-lg font-extrabold text-blue-800">נבחר</span>}
                </button>
              );
            })}
          </div>

          {isAnswered && currentIndex < namingItems.length - 1 && (
            <button
              onClick={handleNext}
              className="mt-8 py-5 rounded-xl bg-black text-white text-xl font-bold hover:bg-gray-800 transition-colors focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-600"
            >
              לפריט הבא
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
