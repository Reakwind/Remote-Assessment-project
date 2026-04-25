import { Outlet, NavLink } from "react-router";
import { Users, Clock, BarChart2, BookOpen, Home } from "lucide-react";
import { clsx } from "clsx";
import { ClinicianAuthGate } from "./ClinicianAuthGate";

export function ClinicianDashboardLayout() {
  const navItems = [
    { name: "מטופלים", icon: Users, to: "/dashboard", end: true, badge: 18 },
    { name: "מבחנים אחרונים", icon: Clock, to: "/dashboard/recent" },
    { name: "ניתוחים", icon: BarChart2, to: "/dashboard/analytics" },
    { name: "ספריית מבחנים", icon: BookOpen, to: "/dashboard/library" },
  ];

  return (
    <ClinicianAuthGate>
      <div dir="rtl" className="min-h-screen flex bg-gray-50 text-black font-['Heebo',sans-serif]">
        <aside className="w-[240px] bg-[#0a0a0a] text-white flex flex-col h-screen sticky top-0">
          <div className="p-6 mb-4 border-b border-gray-800">
            <div className="font-bold text-xl">Remote Check</div>
            <div className="text-gray-400 text-xs mt-1 tracking-wider">CLINICIAN PORTAL</div>
          </div>

          <nav className="flex-1 px-4 space-y-2">
            {navItems.map((item) => (
              <NavLink
                key={item.name}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  clsx(
                    "flex items-center justify-between px-4 py-3 rounded-lg font-medium transition-colors",
                    isActive
                      ? "bg-white/10 text-white"
                      : "text-gray-400 hover:text-white hover:bg-white/5"
                  )
                }
              >
                <div className="flex items-center gap-3">
                  <item.icon className="w-5 h-5" />
                  <span>{item.name}</span>
                </div>
                {item.badge && (
                  <span className="bg-red-600 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                    {item.badge}
                  </span>
                )}
              </NavLink>
            ))}
          </nav>

          <div className="p-4 mt-auto">
            <NavLink
              to="/"
              className="mb-3 flex items-center gap-3 px-4 py-3 rounded-lg font-medium text-gray-300 hover:text-white hover:bg-white/5 transition-colors"
            >
              <Home className="w-5 h-5" />
              <span>כניסת מטופל</span>
            </NavLink>
            <div className="bg-white/10 rounded-xl p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-blue-600 text-white font-bold flex items-center justify-center">
                ד״ר
              </div>
              <div>
                <div className="font-bold text-sm">קלינאי</div>
                <div className="text-gray-400 text-xs">נוירופסיכולוג</div>
              </div>
            </div>
          </div>
        </aside>

        <main className="flex-1 p-[28px] overflow-auto">
          <Outlet />
        </main>
      </div>
    </ClinicianAuthGate>
  );
}
