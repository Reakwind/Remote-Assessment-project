import { Navigate, Outlet, useLocation } from "react-router";
import { Loader2 } from "lucide-react";
import { useClinicianAuth } from "./useClinicianAuth";

export function ClinicianProtectedRoute() {
  const { signedIn, loading, mfaRequired, aal } = useClinicianAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div
        dir="rtl"
        className="min-h-screen bg-gray-50 flex items-center justify-center p-6 font-['Heebo',sans-serif]"
      >
        <div className="bg-white border border-gray-200 shadow-lg rounded-3xl p-10 text-center">
          <Loader2 className="w-10 h-10 text-blue-600 animate-spin mx-auto mb-4" />
          <p className="text-lg font-bold text-black">טוען פרטי משתמש...</p>
        </div>
      </div>
    );
  }

  if (!signedIn) {
    return <Navigate to="/clinician/auth" replace state={{ from: location.pathname }} />;
  }

  if (mfaRequired || aal !== "aal2") {
    return <Navigate to="/clinician/2fa" replace state={{ from: location.pathname }} />;
  }

  return <Outlet />;
}
