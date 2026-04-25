import { useState } from "react";
import { CheckCircle2, XCircle } from "lucide-react";
import { ListenButton } from "./ListenButton";
import { clsx } from "clsx";
import { useAssessmentStore } from "../store/useAssessmentStore";

const ANIMALS = [
  { id: "lion", name: "אריה", options: ["נמר", "אריה", "כלב", "חתול"], image: "https://images.unsplash.com/photo-1776144743260-8c22afcde559?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxsaW9uJTIwbGluZSUyMGFydCUyMGlsbHVzdHJhdGlvbnxlbnwxfHx8fDE3NzY3NTM4NTR8MA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral" },
  { id: "rhino", name: "קרנף", options: ["פיל", "קרנף", "היפופוטם", "זברה"], image: "https://images.unsplash.com/photo-1745029795642-35953130a9c5?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxyaGlubyUyMGxpbmUlMjBhcnQlMjBpbGx1c3RyYXRpb258ZW58MXx8fHwxNzc2NzUzODU1fDA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral" },
  { id: "camel", name: "גמל", options: ["סוס", "גמל", "פרד", "שור"], image: "https://images.unsplash.com/photo-1525056477279-1527aee289f9?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxjYW1lbCUyMGxpbmUlMjBhcnQlMjBpbGx1c3RyYXRpb258ZW58MXx8fHwxNzc2NzUzODU1fDA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral" },
];

export function NamingTask() {
  const { state, updateTaskData } = useAssessmentStore();
  const [currentIndex, setCurrentIndex] = useState(0);
  
  const savedData = state.tasks.naming || { answers: {} };
  const [answers, setAnswers] = useState<Record<string, string>>(savedData.answers);

  const currentAnimal = ANIMALS[currentIndex];
  const selectedAnswer = answers[currentAnimal.id];
  const isAnswered = !!selectedAnswer;

  const handleSelect = (option: string) => {
    if (isAnswered) return;
    const nextAnswers = { ...answers, [currentAnimal.id]: option };
    setAnswers(nextAnswers);
    updateTaskData('naming', { answers: nextAnswers });
  };

  const handleNext = () => {
    if (currentIndex < ANIMALS.length - 1) {
      setCurrentIndex((prev: number) => prev + 1);
    }
  };

  return (
    <div className="flex flex-col h-full max-w-5xl mx-auto w-full">
      <div className="flex justify-between items-start mb-10">
        <div>
          <div className="text-gray-500 font-bold uppercase tracking-wider text-sm mb-3">
            משימת שיום · פריט {currentIndex + 1} מתוך 3
          </div>
          <h2 className="text-4xl font-extrabold text-black">מה שם החיה בתמונה?</h2>
        </div>
        <ListenButton text="מה שם החיה בתמונה?" size="lg" />
      </div>

      {/* Progress Pips */}
      <div className="flex gap-2 mb-12">
        {ANIMALS.map((_, i) => (
          <div
            key={i}
            className={clsx(
              "h-2 rounded-full transition-all duration-300",
              i === currentIndex ? "w-12 bg-black" : "w-8",
              i < (currentIndex || 0) ? (answers[ANIMALS[i].id] === ANIMALS[i].name ? "bg-green-600" : "bg-red-600") : "bg-gray-200"
            )}
          />
        ))}
      </div>

      <div className="grid grid-cols-2 gap-10 bg-gray-50 p-10 rounded-2xl border border-gray-100 flex-1 min-h-[500px]">
        {/* Right half (RTL): Image */}
        <div className="flex items-center justify-center bg-white rounded-xl shadow-sm border border-gray-100 p-8">
          <img
            src={currentAnimal.image}
            alt="Animal outline"
            className="w-[360px] h-[360px] object-contain rounded-lg shadow-inner grayscale contrast-125"
          />
        </div>

        {/* Left half (RTL): Answers */}
        <div className="flex flex-col gap-4 justify-center">
          <div className="text-gray-500 font-medium mb-2 text-lg text-center">
            בחר תשובה, או אמור את השם בקול רם
          </div>
          <div className="grid grid-cols-1 gap-4">
            {currentAnimal.options.map((option) => {
              const isSelected = selectedAnswer === option;
              const isCorrect = option === currentAnimal.name;
              
              let btnClass = "bg-white border-2 border-gray-200 text-gray-800 hover:border-black";
              
              if (isAnswered) {
                if (isSelected && isCorrect) {
                  btnClass = "bg-green-50 border-green-600 text-green-900 shadow-[0_0_0_3px_rgba(22,163,74,0.2)]";
                } else if (isSelected && !isCorrect) {
                  btnClass = "bg-red-50 border-red-600 text-red-900 shadow-[0_0_0_3px_rgba(220,38,38,0.2)]";
                } else if (!isSelected && isCorrect) {
                  btnClass = "bg-white border-green-300 text-green-700 opacity-60";
                } else {
                  btnClass = "bg-white border-gray-100 text-gray-400 opacity-40";
                }
              }

              return (
                <button
                  key={option}
                  onClick={() => handleSelect(option)}
                  disabled={isAnswered}
                  className={clsx(
                    "min-h-[72px] rounded-xl text-2xl font-bold flex items-center justify-between px-8 transition-all relative overflow-hidden focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-600",
                    btnClass
                  )}
                >
                  <span>{option}</span>
                  {isSelected && isCorrect && <CheckCircle2 className="w-8 h-8 text-green-600" />}
                  {isSelected && !isCorrect && <XCircle className="w-8 h-8 text-red-600" />}
                </button>
              );
            })}
          </div>

          {isAnswered && currentIndex < ANIMALS.length - 1 && (
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
