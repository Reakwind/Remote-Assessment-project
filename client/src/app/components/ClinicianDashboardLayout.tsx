import { Outlet, NavLink, useNavigate } from "react-router";
import { Users } from "lucide-react";
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
  ];

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate("/clinician/auth");
  };

  return (
    <div dir="rtl" className="min-h-screen flex flex-col lg:flex-row bg-gray-50 text-black font-['Heebo',sans-serif]">
      <header className="lg:hidden bg-[#0a0a0a] text-white border-b border-gray-800">
        <div className="flex items-center justify-between gap-3 px-4 py-3">
          <div className="min-w-0">
            <div className="font-bold text-lg leading-tight">Remote Check</div>
            <div className="text-gray-400 text-xs">פורטל קלינאים</div>
          </div>
          <button
            onClick={handleSignOut}
            className="h-10 shrink-0 rounded-lg bg-white/10 px-3 text-sm font-bold text-gray-200 hover:bg-white/15"
          >
            התנתקות
          </button>
        </div>
        <nav className="flex gap-2 overflow-x-auto px-4 pb-3">
          {navItems.map((item) => (
            <NavLink
              key={item.name}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                clsx(
                  "inline-flex shrink-0 items-center gap-2 rounded-lg px-4 py-2 text-sm font-bold transition-colors",
                  isActive
                    ? "bg-white text-black"
                    : "bg-white/10 text-gray-200 hover:bg-white/15"
                )
              }
            >
              <item.icon className="w-4 h-4" />
              <span>{item.name}</span>
            </NavLink>
          ))}
        </nav>
      </header>

      {/* Sidebar */}
      <aside className="hidden lg:flex w-[240px] bg-[#0a0a0a] text-white flex-col h-screen sticky top-0">
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
          <div className="bg-white/10 rounded-xl p-4 flex min-w-0 items-center gap-3">
            <div className="w-10 h-10 shrink-0 rounded-full bg-blue-600 text-white font-bold flex items-center justify-center">
              {(profile?.full_name?.[0] || "ד").toUpperCase()}
            </div>
            <div className="min-w-0">
              <div className="truncate font-bold text-sm">{profile?.full_name || "ד״ר קלינאי"}</div>
              <div className="truncate text-gray-400 text-xs">{profile?.clinic_name || "Remote Check Clinic"}</div>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-4 sm:p-6 lg:p-[28px] overflow-auto min-w-0">
        <Outlet />
      </main>
    </div>
  );
}
