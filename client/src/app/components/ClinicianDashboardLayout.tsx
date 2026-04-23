import { Outlet, NavLink, useNavigate } from "react-router";
import { Users, Clock, BarChart2, BookOpen } from "lucide-react";
import { clsx } from "clsx";
import { useClinicianAuth } from "./auth/useClinicianAuth";
import { supabase } from "../../lib/supabase";

interface DashboardNavItem {
  name: string;
  icon: React.ComponentType<{ className?: string }>;
  to: string;
  end?: boolean;
  badge?: number;
}

export function ClinicianDashboardLayout() {
  const navigate = useNavigate();
  const { profile } = useClinicianAuth();
  const navItems: DashboardNavItem[] = [
    { name: "מטופלים", icon: Users, to: "/dashboard", end: true },
    { name: "מבחנים אחרונים", icon: Clock, to: "/dashboard/recent" },
    { name: "ניתוחים", icon: BarChart2, to: "/dashboard/analytics" },
    { name: "ספריית מבחנים", icon: BookOpen, to: "/dashboard/library" },
  ];

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate("/clinician/auth");
  };

  return (
    <div dir="rtl" className="min-h-screen flex bg-gray-50 text-black font-['Heebo',sans-serif]">
      {/* Sidebar */}
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
          <button
            onClick={handleSignOut}
            className="w-full mb-3 h-10 rounded-lg bg-white/5 text-gray-300 hover:bg-white/10 hover:text-white transition-colors text-sm font-bold"
          >
            התנתקות
          </button>
          <div className="bg-white/10 rounded-xl p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-blue-600 text-white font-bold flex items-center justify-center">
              {(profile?.full_name?.[0] || "ד").toUpperCase()}
            </div>
            <div>
              <div className="font-bold text-sm">{profile?.full_name || "ד״ר קלינאי"}</div>
              <div className="text-gray-400 text-xs">{profile?.clinic_name || "Remote Check Clinic"}</div>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-[28px] overflow-auto">
        <Outlet />
      </main>
    </div>
  );
}
