import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { KeyRound, LogOut, Menu, UserRound } from "lucide-react";
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
    <header className="flex h-[var(--admin-header-height)] shrink-0 items-center justify-between border-b border-slate-200 bg-white px-4 sm:px-6">
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
          <p className="truncate text-sm font-semibold text-slate-900">PetCare 管理后台</p>
          <p className="hidden text-xs text-slate-500 sm:block">管理当前已启用的账户与内容</p>
        </div>
      </div>

      <div className="flex items-center gap-1 sm:gap-2">
        <DropdownMenu.Root>
          <DropdownMenu.Trigger asChild>
            <button
              type="button"
              aria-label="账户菜单"
              className="flex min-h-11 min-w-11 cursor-pointer items-center gap-2.5 rounded-lg px-2 py-1 text-left transition-colors hover:bg-slate-100 active:bg-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
            >
              <span className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-blue-50 text-blue-700">
                {auth.user?.avatar ? (
                  <img
                    src={auth.user.avatar}
                    alt="当前头像"
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <UserRound aria-hidden="true" className="h-4 w-4" />
                )}
              </span>
              <span className="hidden min-w-0 sm:block">
                <span className="block max-w-32 truncate text-sm font-medium text-slate-800">
                  {auth.user?.nickname ?? "管理员"}
                </span>
                <span className="block text-xs text-slate-400">管理员</span>
              </span>
            </button>
          </DropdownMenu.Trigger>
          <DropdownMenu.Portal>
            <DropdownMenu.Content
              align="end"
              sideOffset={8}
              className="z-50 w-48 rounded-lg border border-slate-200 bg-white p-1 shadow-lg outline-none"
            >
              <DropdownMenu.Item
                className="flex min-h-11 cursor-pointer items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-slate-700 outline-none hover:bg-slate-100 focus:bg-slate-100"
                onSelect={() => navigate("/account")}
              >
                <UserRound aria-hidden="true" className="h-4 w-4" />
                个人中心
              </DropdownMenu.Item>
              <DropdownMenu.Item
                className="flex min-h-11 cursor-pointer items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-slate-700 outline-none hover:bg-slate-100 focus:bg-slate-100"
                onSelect={() => navigate("/account#password")}
              >
                <KeyRound aria-hidden="true" className="h-4 w-4" />
                修改密码
              </DropdownMenu.Item>
              <DropdownMenu.Separator className="my-1 h-px bg-slate-200" />
              <DropdownMenu.Item
                className="flex min-h-11 cursor-pointer items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-red-700 outline-none hover:bg-red-50 focus:bg-red-50"
                onSelect={() => void handleLogout()}
              >
                <LogOut aria-hidden="true" className="h-4 w-4" />
                退出登录
              </DropdownMenu.Item>
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        </DropdownMenu.Root>

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
