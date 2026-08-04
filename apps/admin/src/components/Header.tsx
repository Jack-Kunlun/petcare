import { Bell, LogOut, Menu, UserRound } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth/auth.context";

interface HeaderProps {
  onMenuOpen: () => void;
}

export function Header({ onMenuOpen }: HeaderProps) {
  const auth = useAuth();
  const navigate = useNavigate();

  async function handleLogout() {
    await auth.logout();
    navigate("/login", { replace: true });
  }

  return (
    <header className="flex h-16 shrink-0 items-center justify-between border-b border-slate-200 bg-white px-4 sm:px-6">
      <div className="flex min-w-0 items-center gap-3">
        <button
          type="button"
          aria-label="打开导航"
          className="flex h-11 w-11 cursor-pointer items-center justify-center rounded-lg text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-950 active:bg-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 lg:hidden"
          onClick={onMenuOpen}
        >
          <Menu aria-hidden="true" className="h-5 w-5" />
        </button>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-slate-900">PetCare 运营管理中心</p>
          <p className="hidden text-xs text-slate-500 sm:block">让每一笔服务都安心可追踪</p>
        </div>
      </div>

      <div className="flex items-center gap-1 sm:gap-2">
        <button
          type="button"
          aria-label="通知，3 条未读"
          className="relative flex h-11 w-11 cursor-pointer items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 active:bg-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
        >
          <Bell aria-hidden="true" className="h-5 w-5" />
          <span className="absolute right-2 top-2 h-2 w-2 rounded-full border-2 border-white bg-red-500" />
        </button>

        <div className="mx-1 hidden h-7 w-px bg-slate-200 sm:block" />

        <div
          data-testid="header-user-info"
          tabIndex={0}
          className="hidden min-w-0 cursor-pointer items-center gap-2.5 rounded-lg px-2 py-1 transition-colors hover:bg-slate-100 active:bg-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 sm:flex"
        >
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-50 text-blue-700">
            <UserRound aria-hidden="true" className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <p className="max-w-32 truncate text-sm font-medium text-slate-800">
              {auth.user?.nickname ?? "管理员"}
            </p>
            <p className="text-xs text-slate-400">平台管理员</p>
          </div>
        </div>

        <button
          type="button"
          aria-label="退出登录"
          className="flex h-11 w-11 cursor-pointer items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-red-50 hover:text-red-700 active:bg-red-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-600"
          onClick={handleLogout}
        >
          <LogOut aria-hidden="true" className="h-5 w-5" />
        </button>
      </div>
    </header>
  );
}
