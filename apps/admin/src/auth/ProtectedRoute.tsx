import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "./auth.context";

export function ProtectedRoute() {
  const auth = useAuth();
  const location = useLocation();

  if (auth.status === "loading") {
    return <div className="min-h-screen grid place-items-center">正在恢复登录状态…</div>;
  }

  if (auth.status === "anonymous") {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  return <Outlet />;
}
