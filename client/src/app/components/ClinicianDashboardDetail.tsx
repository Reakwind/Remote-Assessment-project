/* eslint-disable @typescript-eslint/no-explicit-any */
import { ChevronRight, FileDown, Download, CheckSquare, Mic } from "lucide-react";
import { Link, useParams } from "react-router";
import { clsx } from "clsx";
import { useState } from "react";
import { useAssessmentStore } from "../store/AssessmentContext";
import { PlaybackCanvas } from "./PlaybackCanvas";
import { PlaybackAudio } from "./PlaybackAudio";

const SUMMARY = [
  { label: "סך הכל MoCA", value: "24/30", color: "warn" },
  { label: "מרחבי-חזותי", value: "3/5", color: "warn" },
  { label: "שיום", value: "3/3", color: "pass" },
  { label: "זכירה מושהית", value: "2/5", color: "warn" },
  { label: "קשב", value: "6/6", color: "pass" },
  { label: "משך זמן", value: "14:20", color: "neutral" },
];

export function ClinicianDashboardDetail() {
  const { patientId } = useParams();
  const { state } = useAssessmentStore();
  const [activeTab, setActiveTab] = useState<'clock' | 'cube' | 'trail' | 'memory' | 'digitSpan' | 'serial7' | 'language' | 'abstraction' | 'delayedRecall' | 'orientation'>('clock');
  const [rubrics, setRubrics] = useState({
    clock: { contour: true, numbers: false, hands: false },
    cube: { shape: false, lines: false, parallel: false },
    trail: { correct: false, noLinesCrossed: false },
    memory: { recall1: false, recall2: false, recall3: false, recall4: false, recall5: false },
    digitSpan: { forward: false, backward: false },
    serial7: { first: false, second: false, third: false, fourth: false, fifth: false },
    language: { sentence1: false, sentence2: false, fluency: false },
    abstraction: { train: false, watch: false },
    delayedRecall: { word1: false, word2: false, word3: false, word4: false, word5: false },
    orientation: { day: false, month: false, year: false, dayOfWeek: false, place: false, city: false }
  });

  // Extract stroke data from assessment state
  const clockStrokes = state.tasks.clock?.strokes || [];
  const cubeStrokes = state.tasks.cube?.strokes || [];
  const trailStrokes = state.tasks.trailMaking?.strokes || [];

  const getDrawingStats = (strokes: any[][]) => {
    const valid = (strokes || []).filter(s => s && s.length > 0);
    if (valid.length === 0) return { count: 0, duration: '0s', usedPen: false };

    const firstPoint = valid[0][0];
    const lastStroke = valid[valid.length - 1];
    const lastPoint = lastStroke[lastStroke.length - 1];
    const durationMs = lastPoint.time - firstPoint.time;
    const duration = durationMs > 0 ? (durationMs / 1000).toFixed(1) + 's' : '0s';

    const usedPen = valid.some(s => s.some(pt => pt.pointerType === 'pen'));

    return { count: valid.length, duration, usedPen };
  };

  const currentStrokes = activeTab === 'clock' ? clockStrokes : activeTab === 'cube' ? cubeStrokes : trailStrokes;
  const currentStats = getDrawingStats(currentStrokes);

  const toggleRubric = (key: string) => {
    setRubrics(prev => ({
      ...prev,
      [activeTab]: {
        ...prev[activeTab],
        [key]: !prev[activeTab][key as keyof typeof prev[typeof activeTab]]
      }
    }));
  };

  const getRubricData = () => {
    if (activeTab === 'clock') {
      return {
        max: 3,
        score: (rubrics.clock.contour ? 1 : 0) + (rubrics.clock.numbers ? 1 : 0) + (rubrics.clock.hands ? 1 : 0),
        items: [
          { id: "contour", label: "מתאר", desc: "המעגל סגור ופרופורציונלי" },
          { id: "numbers", label: "מספרים", desc: "כל המספרים נמצאים במיקום הנכון" },
          { id: "hands", label: "מחוגים", desc: "השעה 11:10 בדיוק" },
        ]
      };
    } else if (activeTab === 'cube') {
      return {
        max: 1,
        score: (rubrics.cube.shape && rubrics.cube.lines && rubrics.cube.parallel) ? 1 : 0,
        items: [
          { id: "shape", label: "תלת מימד", desc: "הצורה היא תלת מימדית" },
          { id: "lines", label: "כל הקווים מצוירים", desc: "כל הקווים הפנימיים קיימים" },
          { id: "parallel", label: "קווים מקבילים", desc: "הקווים מקבילים פחות או יותר" },
        ]
      };
    } else if (activeTab === 'trail') {
      return {
        max: 1,
        score: (rubrics.trail.correct && rubrics.trail.noLinesCrossed) ? 1 : 0,
        items: [
          { id: "correct", label: "סדר נכון", desc: "מתח קו מ-1 ל-א, ל-2 וכו' עד ה" },
          { id: "noLinesCrossed", label: "קווים לא נחתכים", desc: "המסלול לא חותך את עצמו" },
        ]
      };
    } else if (activeTab === 'memory') {
      return {
        max: 0,
        score: 0,
        items: [
          { id: "recall1", label: "פנים", desc: "הנבדק חזר על המילה" },
          { id: "recall2", label: "קטיפה", desc: "הנבדק חזר על המילה" },
          { id: "recall3", label: "כנסייה", desc: "הנבדק חזר על המילה" },
          { id: "recall4", label: "חרצית", desc: "הנבדק חזר על המילה" },
          { id: "recall5", label: "אדום", desc: "הנבדק חזר על המילה" },
        ]
      };
    } else if (activeTab === 'digitSpan') {
      return {
        max: 2,
        score: (rubrics.digitSpan.forward ? 1 : 0) + (rubrics.digitSpan.backward ? 1 : 0),
        items: [
          { id: "forward", label: "2-1-8-5-4 קדימה", desc: "חזר על הסדרה בסדר מדויק" },
          { id: "backward", label: "7-4-2 אחורה", desc: "חזר על הסדרה בסדר הפוך מדויק" },
        ]
      };
    } else if (activeTab === 'serial7') {
      return {
        max: 3,
        score: Object.values(rubrics.serial7).filter(v => v).length,
        items: [
          { id: "first", label: "93", desc: "תשובה ראשונה נכונה" },
          { id: "second", label: "86", desc: "תשובה שנייה נכונה" },
          { id: "third", label: "79", desc: "תשובה שלישית נכונה" },
          { id: "fourth", label: "72", desc: "תשובה רביעית נכונה" },
          { id: "fifth", label: "65", desc: "תשובה חמישית נכונה" },
        ]
      };
    } else if (activeTab === 'language') {
      return {
        max: 3,
        score: (rubrics.language.sentence1 ? 1 : 0) + (rubrics.language.sentence2 ? 1 : 0) + (rubrics.language.fluency ? 1 : 0),
        items: [
          { id: "sentence1", label: "משפט 1", desc: "חזר על המשפט בדיוק רב" },
          { id: "sentence2", label: "משפט 2", desc: "חזר על המשפט בדיוק רב" },
          { id: "fluency", label: "שטף מילולי", desc: "מנה מעל 11 מילים" },
        ]
      };
    } else if (activeTab === 'abstraction') {
      return {
        max: 2,
        score: (rubrics.abstraction.train ? 1 : 0) + (rubrics.abstraction.watch ? 1 : 0),
        items: [
          { id: "train", label: "רכבת/אופניים", desc: "אמצעי תחבורה / כלי רכב" },
          { id: "watch", label: "שעון/סרגל", desc: "כלי מדידה" },
        ]
      };
    } else if (activeTab === 'delayedRecall') {
      return {
        max: 5,
        score: Object.values(rubrics.delayedRecall).filter(v => v).length,
        items: [
          { id: "word1", label: "פנים", desc: "נזכר ספונטנית" },
          { id: "word2", label: "קטיפה", desc: "נזכר ספונטנית" },
          { id: "word3", label: "כנסייה", desc: "נזכר ספונטנית" },
          { id: "word4", label: "חרצית", desc: "נזכר ספונטנית" },
          { id: "word5", label: "אדום", desc: "נזכר ספונטנית" },
        ]
      };
    } else {
      return {
        max: 6,
        score: Object.values(rubrics.orientation).filter(v => v).length,
        items: [
          { id: "day", label: "יום בחודש", desc: "תאריך מדויק" },
          { id: "month", label: "חודש", desc: "חודש מדויק" },
          { id: "year", label: "שנה", desc: "שנה מדויקה" },
          { id: "dayOfWeek", label: "יום בשבוע", desc: "היום המדויק" },
          { id: "place", label: "מקום/מוסד", desc: "שם המוסד/מקום" },
          { id: "city", label: "עיר", desc: "העיר הנכונה" },
        ]
      };
    }
  };

  const rubricData = getRubricData();

  const renderTaskContent = () => {
    if (['clock', 'cube', 'trail'].includes(activeTab)) {
      return (
        <div className="flex flex-col items-center">
          <PlaybackCanvas strokes={currentStrokes} width={450} height={400} />
          
          <div className="mt-8 w-full border-t border-gray-100 pt-6">
            <h4 className="font-bold text-gray-500 text-sm mb-3">סטטיסטיקת ציור</h4>
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-gray-50 p-4 rounded-xl text-center">
                <div className="text-xs font-bold text-gray-500 mb-1">מספר משיכות</div>
                <div className="text-2xl font-extrabold tabular-nums text-black">{currentStats.count}</div>
              </div>
              <div className="bg-gray-50 p-4 rounded-xl text-center">
                <div className="text-xs font-bold text-gray-500 mb-1">משך זמן ברוטו</div>
                <div className="text-2xl font-extrabold tabular-nums text-black">{currentStats.duration}</div>
              </div>
              <div className="bg-gray-50 p-4 rounded-xl text-center">
                <div className="text-xs font-bold text-gray-500 mb-1">מגע לעומת עט</div>
                <div className="text-2xl font-extrabold tabular-nums text-blue-600">
                  {currentStats.usedPen ? 'עט חכם' : 'אצבע/עכבר'}
                </div>
              </div>
            </div>
          </div>
        </div>
      );
    } else {
      const audioId = (state.tasks as any)[activeTab]?.audioId || null;
      return (
        <div className="flex flex-col items-center w-full min-h-[400px] justify-center">
          <div className="w-20 h-20 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mb-8 shadow-sm">
            <Mic className="w-10 h-10" />
          </div>
          <h3 className="text-2xl font-extrabold text-black mb-10">האזן להקלטת המטופל</h3>
          
          <PlaybackAudio audioId={audioId} />
        </div>
      );
    }
  };

  return (
    <div className="max-w-6xl mx-auto pb-20">
      <div className="mb-6">
        <Link to="/dashboard" className="text-gray-500 font-bold hover:text-black flex items-center gap-2 transition-colors w-fit">
          <ChevronRight className="w-5 h-5" />
          <span>מטופלים / ישראל ישראלי</span>
        </Link>
      </div>

      <div className="flex items-start justify-between mb-8 bg-white p-8 rounded-2xl border border-gray-200 shadow-sm">
        <div className="flex gap-6 items-center">
          <div className="w-20 h-20 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-extrabold text-3xl">
            י
          </div>
          <div>
            <h1 className="text-3xl font-extrabold text-black mb-2">ישראל ישראלי</h1>
            <div className="flex gap-4 text-gray-500 font-medium text-lg items-center">
              <span className="font-mono bg-gray-100 px-2 py-0.5 rounded-md">{patientId || "P-1049"}</span>
              <span>גיל 72</span>
              <span>מבחן שני</span>
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-bold bg-amber-100 text-amber-800">
                <span className="w-1.5 h-1.5 rounded-full bg-current" />
                בבדיקה
              </span>
            </div>
          </div>
        </div>

        <div className="flex gap-4">
          <button className="flex items-center gap-2 px-6 py-3 rounded-xl font-bold bg-white border-2 border-gray-200 hover:border-black transition-colors text-black">
            <FileDown className="w-5 h-5" />
            <span>PDF</span>
          </button>
          <button className="flex items-center gap-2 px-6 py-3 rounded-xl font-bold bg-white border-2 border-gray-200 hover:border-black transition-colors text-black">
            <Download className="w-5 h-5" />
            <span>CSV</span>
          </button>
          <button className="px-8 py-3 rounded-xl font-bold bg-black text-white hover:bg-gray-800 transition-colors shadow-md text-lg">
            סגור מבחן
          </button>
        </div>
      </div>

      <div className="grid grid-cols-6 gap-4 mb-8">
        {SUMMARY.map((item, i) => (
          <div key={i} className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm flex flex-col items-center justify-center text-center">
            <div className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-2">{item.label}</div>
            <div className={clsx(
              "text-3xl font-extrabold tabular-nums",
              item.color === 'warn' ? 'text-red-600' : item.color === 'pass' ? 'text-green-600' : 'text-black'
            )}>
              {item.value}
            </div>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-6 mb-6 mt-12 border-b border-gray-200 overflow-x-auto pb-1 scrollbar-hide">
        {[
          { id: 'clock', label: 'שעון' },
          { id: 'cube', label: 'קוביה' },
          { id: 'trail', label: 'מסלול' },
          { id: 'memory', label: 'זיכרון' },
          { id: 'digitSpan', label: 'קיבולת זיכרון' },
          { id: 'serial7', label: 'סדרת 7' },
          { id: 'language', label: 'שפה' },
          { id: 'abstraction', label: 'הפשטה' },
          { id: 'delayedRecall', label: 'שליפה' },
          { id: 'orientation', label: 'התמצאות' },
        ].map((tab) => (
          <h2 
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={clsx(
              "text-xl font-extrabold pb-4 border-b-4 cursor-pointer transition-colors whitespace-nowrap",
              activeTab === tab.id ? "border-black text-black" : "border-transparent text-gray-400 hover:text-gray-600"
            )}
          >{tab.label}</h2>
        ))}
      </div>
      
      <div className="grid grid-cols-12 gap-8">
        {/* Right side: Drawing/Audio */}
        <div className="col-span-7 bg-white p-8 rounded-2xl border border-gray-200 shadow-sm flex flex-col items-center justify-center">
          {renderTaskContent()}
        </div>

        {/* Left side: Rubric */}
        <div className="col-span-5 bg-gray-50 p-8 rounded-2xl border border-gray-200 shadow-sm flex flex-col">
          <div className="flex items-center justify-between mb-8 pb-4 border-b border-gray-200">
            <h3 className="text-2xl font-extrabold text-black">ניקוד</h3>
            <div className="text-3xl font-extrabold tabular-nums bg-white px-4 py-2 rounded-xl shadow-sm border border-gray-200">
              <span className="text-black">{rubricData.score}</span>
              <span className="text-gray-400">/{rubricData.max}</span>
            </div>
          </div>

          <div className="space-y-3 mb-8 flex-1">
            {rubricData.items.map((crit) => {
              const isChecked = (rubrics[activeTab] as any)[crit.id];
              return (
                <div 
                  key={crit.id}
                  onClick={() => toggleRubric(crit.id)}
                  className={clsx(
                    "flex gap-4 p-5 rounded-xl cursor-pointer transition-all border-2",
                    isChecked 
                      ? "bg-[#ecfdf5] border-green-200" 
                      : "bg-white border-transparent hover:border-gray-200"
                  )}
                >
                  <div className={clsx(
                    "mt-1 w-6 h-6 rounded flex items-center justify-center flex-shrink-0 transition-colors",
                    isChecked ? "bg-green-600 text-white" : "bg-gray-200 text-transparent"
                  )}>
                    <CheckSquare className="w-5 h-5" />
                  </div>
                  <div>
                    <div className={clsx("font-bold text-lg", isChecked ? "text-green-900" : "text-black")}>
                      {crit.label}
                    </div>
                    <div className={clsx("text-sm mt-1", isChecked ? "text-green-700" : "text-gray-500")}>
                      {crit.desc}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div>
            <label className="block text-sm font-bold text-gray-500 mb-2">הערות</label>
            <textarea 
              placeholder="הוסף הערה קלינית…" 
              className="w-full h-32 p-4 bg-white border border-gray-200 rounded-xl resize-none text-lg focus:outline-none focus:ring-4 focus:ring-blue-600 focus:border-blue-600 transition-all"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
