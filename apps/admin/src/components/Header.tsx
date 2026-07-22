import { Bell, LogOut, User } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth/auth.context";

export function Header() {
  const auth = useAuth();
  const navigate = useNavigate();

  async function handleLogout() {
    await auth.logout();
    navigate("/login", { replace: true });
  }

  return (
    <header className="bg-white shadow-sm px-6 py-4 flex justify-between items-center">
      <div>
        <h2 className="text-xl font-semibold">欢迎使用PetCare后台管理系统</h2>
      </div>
      <div className="flex items-center space-x-4">
        <button type="button" aria-label="通知" className="p-2 hover:bg-gray-100 rounded-full">
          <Bell className="w-5 h-5 text-gray-600" />
        </button>
        <div className="flex items-center space-x-2 p-2">
          <User className="w-5 h-5 text-gray-600" />
          <span className="text-sm">{auth.user?.nickname ?? "管理员"}</span>
        </div>
        <button
          type="button"
          aria-label="退出登录"
          className="p-2 hover:bg-gray-100 rounded-full"
          onClick={handleLogout}
        >
          <LogOut className="w-5 h-5 text-gray-600" />
        </button>
      </div>
    </header>
  );
}
