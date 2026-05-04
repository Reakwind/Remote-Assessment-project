import { clsx } from "clsx";
import { ListenButton } from "./ListenButton";

export interface InstructionBoxProps {
  variant?: "clinical" | "paper" | "focus";
  title: string;
  steps: string[];
  example?: string;
  audioText: string;
}

export function InstructionBox({ variant = "clinical", title, steps, example, audioText }: InstructionBoxProps) {
  if (variant === "paper") {
    return (
      <div className="bg-gradient-to-br from-[#fdfcf9] to-[#faf8f3] shadow-md rounded-xl p-8 max-w-2xl mx-auto border border-gray-100">
        <h2 className="text-[30px] font-bold text-gray-900 mb-6 font-serif">{title}</h2>
        <ol className="list-decimal list-inside space-y-4 text-xl">
          {steps.map((step, i) => (
            <li key={i} className="pl-4 pb-4 border-b border-dashed border-gray-300 last:border-0">{step}</li>
          ))}
        </ol>
        {example && (
          <div className="mt-6 italic text-gray-600 text-lg border-r-4 border-gray-300 pr-4">
            דוגמה: {example}
          </div>
        )}
      </div>
    );
  }

  if (variant === "focus") {
    return (
      <div className="max-w-[820px] mx-auto text-center flex flex-col items-center gap-8 py-10">
        <div className="uppercase text-sm font-bold tracking-widest text-gray-500">הוראות</div>
        <h2 className="text-[38px] font-extrabold text-black leading-tight">{title}</h2>
        <ol className="w-full max-w-md text-right space-y-6 list-none m-0 p-0">
          {steps.map((step, i) => (
            <li key={i} className={clsx("flex items-start gap-4 p-4 rounded-xl", i === 0 && "bg-gray-100")}>
              <div className="flex-shrink-0 w-12 h-12 rounded-full border-2 border-black flex items-center justify-center font-bold text-xl">
                {i + 1}
              </div>
              <div className="text-xl font-medium pt-2">{step}</div>
            </li>
          ))}
        </ol>
        <ListenButton text={audioText} size="lg" className="mt-4" />
      </div>
    );
  }

  // Clinical Variant (Default)
  return (
    <div className="border-2 border-black rounded-lg p-[36px] relative bg-white max-w-3xl">
      <div className="absolute top-[36px] left-[36px]">
        <ListenButton text={audioText} size="lg" />
      </div>
      
      <div className="flex items-center gap-2 mb-4 text-gray-600 font-bold uppercase tracking-wider text-sm">
        <div className="w-2 h-2 rounded-full bg-black"></div>
        הוראות
      </div>
      
      <h2 className="text-[28px] font-extrabold text-black mb-8 pr-4">{title}</h2>
      
      <ol className="space-y-6 pr-4 list-none m-0 p-0">
        {steps.map((step, i) => (
          <li key={i} className="flex items-start gap-4">
            <div className="w-8 h-8 rounded-full bg-black text-white flex items-center justify-center font-bold flex-shrink-0 mt-1">
              {i + 1}
            </div>
            <div className="text-xl leading-relaxed font-medium text-gray-900">{step}</div>
          </li>
        ))}
      </ol>
      
      {example && (
        <div className="mt-8 pr-4 border-r-4 border-black mr-4 py-2 text-xl font-medium text-gray-700">
          <span className="font-bold text-black">למשל:</span> {example}
        </div>
      )}
    </div>
  );
}
