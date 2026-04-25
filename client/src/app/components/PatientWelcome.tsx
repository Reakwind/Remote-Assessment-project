import { useNavigate } from "react-router";
import { CheckCircle2, Volume2, PenTool, ArrowLeft } from "lucide-react";

export function PatientWelcome() {
  const navigate = useNavigate();

  const handleAudioTest = () => {
    const utterance = new SpeechSynthesisUtterance("בדיקת שמע הושלמה בהצלחה");
    utterance.lang = 'he-IL';
    utterance.rate = 0.9;
    window.speechSynthesis.speak(utterance);
  };

  return (
    <div
      dir="rtl"
      className="min-h-screen bg-gray-50 flex flex-col font-['Heebo',sans-serif]"
    >
      <div className="bg-white border-b border-gray-200 p-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-black flex items-center gap-3">
          <div className="w-10 h-10 bg-black text-white rounded-lg flex items-center justify-center text-sm">
            RC
          </div>
          Remote Check - MoCA
        </h1>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center p-6">
        <div className="max-w-2xl w-full bg-white rounded-3xl border border-gray-200 shadow-lg overflow-hidden">
          <div className="p-10 border-b border-gray-100">
            <h2 className="text-4xl font-extrabold text-black mb-6">
              ברוך הבא למבחן MoCA
            </h2>
            <div className="space-y-4 text-2xl text-gray-700">
              <p>המבחן כולל 12 משימות קצרות.</p>
              <p>זמן משוער: 25-30 דקות.</p>
            </div>
            
            <div className="mt-8 bg-blue-50 border border-blue-100 rounded-2xl p-6">
              <h3 className="text-xl font-bold text-blue-900 mb-4 flex items-center gap-2">
                💡 טיפים להצלחה:
              </h3>
              <ul className="space-y-3 text-lg text-blue-800">
                <li>• מצא מקום שקט ללא הסחות דעת</li>
                <li>• השתמש בעכבר או מסך מגע כדי לצייר</li>
                <li>• הקשב להוראות בקפידה בכל משימה</li>
              </ul>
            </div>
          </div>

          <div className="p-10 bg-gray-50">
            <h3 className="text-xl font-bold text-gray-900 mb-6">
              בדיקת מערכת:
            </h3>
            
            <div className="space-y-4">
              <div className="flex items-center gap-4 bg-white p-4 rounded-xl border border-gray-200">
                <div className="w-12 h-12 bg-green-100 text-green-600 rounded-full flex items-center justify-center shrink-0">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <div className="text-lg font-medium text-black">חיבור לאינטרנט</div>
              </div>

              <button
                onClick={handleAudioTest}
                className="w-full flex items-center gap-4 bg-white p-4 rounded-xl border border-gray-200 hover:border-blue-400 hover:shadow-md transition-all text-right"
              >
                <div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center shrink-0">
                  <Volume2 className="w-6 h-6" />
                </div>
                <div className="text-lg font-medium text-black flex-1">נסה קול (השמעת טקסט)</div>
              </button>

              <div className="flex items-center gap-4 bg-white p-4 rounded-xl border border-gray-200">
                <div className="w-12 h-12 bg-purple-100 text-purple-600 rounded-full flex items-center justify-center shrink-0">
                  <PenTool className="w-6 h-6" />
                </div>
                <div className="text-lg font-medium text-black flex-1">
                  המשימה הראשונה תהיה משימת ציור לבדיקת העכבר/מגע
                </div>
              </div>
            </div>

            <div className="mt-10">
              <button
                data-testid="patient-start"
                onClick={() => navigate("/patient/trail-making")}
                className="w-full h-20 bg-black text-white text-2xl font-bold rounded-2xl hover:bg-gray-800 focus:ring-4 focus:ring-black/20 transition-all flex items-center justify-center gap-4"
              >
                התחל מבחן
                <ArrowLeft className="w-8 h-8" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
