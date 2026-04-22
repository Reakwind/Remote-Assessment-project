/* eslint-disable react-hooks/incompatible-library */
import { Search, ChevronLeft, Plus } from "lucide-react";
import { useNavigate } from "react-router";
import { useVirtualizer } from "@tanstack/react-virtual";
import { useRef, useMemo, useState } from "react";

// Generate fake patients to demonstrate virtualization
const FIRST_NAMES = ["ישראל", "דוד", "שרה", "רחל", "משה", "רבקה", "יוסף", "חיים", "מרים", "לאה"];
const LAST_NAMES = ["ישראלי", "לוי", "כהן", "אברהם", "מזרחי", "פרץ", "ביטון", "דסקל", "אוחיון", "פרידמן"];

const generatePatients = (count: number) => {
  return Array.from({ length: count }).map((_, i) => {
    const fn = FIRST_NAMES[Math.floor(Math.random() * FIRST_NAMES.length)];
    const ln = LAST_NAMES[Math.floor(Math.random() * LAST_NAMES.length)];
    const isNew = i < 18; // First 18 are 'new' / 'review'
    return {
      id: `P-${1049 + i}`,
      name: `${fn} ${ln}`,
      age: 65 + Math.floor(Math.random() * 25),
      tests: 1 + Math.floor(Math.random() * 4),
      lastActive: i === 0 ? "היום, 10:30" : i < 5 ? "אתמול" : `21.04.2026`,
      status: i === 0 ? "review" : isNew ? "new" : "completed",
      score: isNew ? "-" : `${15 + Math.floor(Math.random() * 15)}/30`,
    };
  });
};

export function ClinicianDashboardList() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const allPatients = useMemo(() => generatePatients(1000), []);
  
  const filteredPatients = useMemo(() => {
    return allPatients.filter(p => 
      p.name.includes(search) || p.id.includes(search)
    );
  }, [allPatients, search]);

  const parentRef = useRef<HTMLDivElement>(null);

  const rowVirtualizer = useVirtualizer({
    count: filteredPatients.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 88, // estimated row height
    overscan: 5,
  });

  return (
    <div className="max-w-6xl mx-auto h-[calc(100vh-56px)] flex flex-col">
      <div className="flex items-center justify-between mb-8 shrink-0">
        <div>
          <h1 className="text-4xl font-extrabold text-black mb-2">מטופלים</h1>
          <div className="text-gray-500 font-medium text-lg">
            1000 פעילים · 18 דורשים סקירה
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="relative">
            <Search className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input 
              type="text" 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="חיפוש לפי שם או מזהה…" 
              className="pl-4 pr-12 py-3 bg-white border border-gray-200 rounded-xl w-80 text-lg shadow-sm focus:outline-none focus:ring-4 focus:ring-blue-600 focus:border-blue-600 transition-all"
            />
          </div>
          <button className="flex items-center gap-2 bg-black text-white px-6 py-3 rounded-xl font-bold hover:bg-gray-800 transition-colors shadow-md text-lg">
            <Plus className="w-5 h-5" />
            <span>מטופל חדש</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-6 mb-8 shrink-0">
        {[
          { label: "מבחנים השבוע", value: "48", delta: "+12%" },
          { label: "ציון MoCA ממוצע", value: "24.5", delta: "-0.5" },
          { label: "זמן ממוצע (דקות)", value: "14:20", delta: "-1:10" },
          { label: "ממתינים לבדיקה", value: "18", delta: "+3", warn: true },
        ].map((stat, i) => (
          <div key={i} className="bg-white border border-gray-200 p-6 rounded-2xl shadow-sm">
            <div className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-2">{stat.label}</div>
            <div className="flex items-end justify-between">
              <div className="text-4xl font-extrabold text-black tabular-nums">{stat.value}</div>
              <div className={`text-sm font-bold ${stat.warn ? "text-red-600" : "text-green-600"} bg-gray-50 px-2 py-1 rounded-md`}>
                {stat.delta}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm flex-1 flex flex-col min-h-0">
        <div className="bg-gray-50 border-b border-gray-200 text-gray-500 text-sm uppercase tracking-wider font-bold shrink-0">
          <div className="flex text-right px-6 py-4">
            <div className="w-1/4 font-bold">שם</div>
            <div className="w-1/12 font-bold">גיל</div>
            <div className="w-1/12 font-bold">מבחנים</div>
            <div className="w-2/12 font-bold">פעילות אחרונה</div>
            <div className="w-2/12 font-bold">סטטוס</div>
            <div className="w-2/12 font-bold">ציון MoCA</div>
            <div className="w-1/12"></div>
          </div>
        </div>

        <div 
          ref={parentRef} 
          className="overflow-auto flex-1 relative"
        >
          <div 
            style={{
              height: `${rowVirtualizer.getTotalSize()}px`,
              width: '100%',
              position: 'relative',
            }}
          >
            {rowVirtualizer.getVirtualItems().map((virtualRow) => {
              const p = filteredPatients[virtualRow.index];
              return (
                <div
                  key={virtualRow.index}
                  onClick={() => navigate(`/dashboard/${p.id}`)}
                  className="absolute top-0 left-0 w-full hover:bg-gray-50 transition-colors cursor-pointer group border-b border-gray-100 flex items-center text-right px-6"
                  style={{
                    height: `${virtualRow.size}px`,
                    transform: `translateY(${virtualRow.start}px)`,
                  }}
                >
                  <div className="w-1/4 flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-lg shrink-0">
                      {p.name.charAt(0)}
                    </div>
                    <div className="min-w-0">
                      <div className="font-bold text-lg text-black truncate">{p.name}</div>
                      <div className="text-sm text-gray-500 font-mono">{p.id}</div>
                    </div>
                  </div>
                  <div className="w-1/12 text-gray-600 text-lg tabular-nums">{p.age}</div>
                  <div className="w-1/12 text-gray-600 text-lg tabular-nums">{p.tests}</div>
                  <div className="w-2/12 text-gray-600 text-lg tabular-nums">{p.lastActive}</div>
                  <div className="w-2/12">
                    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-bold ${
                      p.status === 'review' ? 'bg-amber-100 text-amber-800' :
                      p.status === 'completed' ? 'bg-green-100 text-green-800' :
                      'bg-blue-100 text-blue-800'
                    }`}>
                      <span className="w-1.5 h-1.5 rounded-full bg-current" />
                      {p.status === 'review' ? 'בבדיקה' :
                       p.status === 'completed' ? 'הושלם' : 'חדש'}
                    </span>
                  </div>
                  <div className="w-2/12 font-extrabold text-xl text-black tabular-nums">{p.score}</div>
                  <div className="w-1/12 text-left flex justify-end">
                    <div className="w-10 h-10 rounded-full flex items-center justify-center bg-transparent group-hover:bg-white border border-transparent group-hover:border-gray-200 group-hover:shadow-sm transition-all text-gray-400">
                      <ChevronLeft className="w-5 h-5" />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
