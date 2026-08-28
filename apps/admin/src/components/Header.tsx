import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { ChevronDown, KeyRound, LogOut, Menu, UserRound } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth/auth.context";
import { Button } from "./ui/Button";

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
    <header className="flex h-[var(--admin-header-height)] shrink-0 items-center justify-between border-b border-border bg-surface px-4 sm:px-6">
      <div className="flex min-w-0 items-center gap-3">
        <Button
          aria-label="打开导航"
          className="h-11 w-11 lg:hidden"
          intent="ghost"
          onClick={onMenuOpen}
          size="icon"
        >
          <Menu aria-hidden="true" className="h-5 w-5" />
        </Button>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-text-primary">PetCare 管理后台</p>
          <p className="hidden text-xs text-text-secondary sm:block">账户、内容与权限工作台</p>
        </div>
      </div>

      <div className="flex items-center">
        <DropdownMenu.Root>
          <DropdownMenu.Trigger asChild>
            <button
              type="button"
              aria-label="账户菜单"
              className="flex min-h-11 min-w-11 cursor-pointer items-center gap-2.5 rounded-lg px-2 py-1 text-left outline-none transition-colors hover:bg-surface-subtle active:bg-surface-muted focus-visible:ring-2 focus-visible:ring-brand-primary"
            >
              <span className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-brand-soft text-brand-primary">
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
                <span className="block max-w-32 truncate text-sm font-medium text-text-primary">
                  {auth.user?.nickname ?? "管理员"}
                </span>
                <span className="block text-xs text-text-muted">管理员</span>
              </span>
              <ChevronDown aria-hidden="true" className="hidden h-4 w-4 text-text-muted sm:block" />
            </button>
          </DropdownMenu.Trigger>
          <DropdownMenu.Portal>
            <DropdownMenu.Content
              align="end"
              sideOffset={8}
              className="z-50 w-52 rounded-xl border border-border bg-surface p-1.5 shadow-panel-hover outline-none"
            >
              <DropdownMenu.Item
                className="flex min-h-10 cursor-pointer items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-text-primary outline-none hover:bg-surface-subtle focus:bg-surface-subtle"
                onSelect={() => navigate("/account")}
              >
                <UserRound aria-hidden="true" className="h-4 w-4" />
                个人中心
              </DropdownMenu.Item>
              <DropdownMenu.Item
                className="flex min-h-10 cursor-pointer items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-text-primary outline-none hover:bg-surface-subtle focus:bg-surface-subtle"
                onSelect={() => navigate("/account#password")}
              >
                <KeyRound aria-hidden="true" className="h-4 w-4" />
                修改密码
              </DropdownMenu.Item>
              <DropdownMenu.Separator className="my-1 h-px bg-border" />
              <DropdownMenu.Item
                className="flex min-h-10 cursor-pointer items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-danger outline-none hover:bg-danger-soft focus:bg-danger-soft"
                onSelect={() => void handleLogout()}
              >
                <LogOut aria-hidden="true" className="h-4 w-4" />
                退出登录
              </DropdownMenu.Item>
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        </DropdownMenu.Root>
      </div>
    </header>
  );
}
