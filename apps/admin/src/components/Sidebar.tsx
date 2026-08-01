import {
  ChevronRight,
  House,
  Settings,
  ShieldCheck,
  ShoppingBag,
  Users,
  X,
  type LucideIcon,
} from "lucide-react";
import { NavLink } from "react-router-dom";

const menuItems: Array<{ icon: LucideIcon; label: string; path: string; permission?: string }> = [
  { icon: House, label: "运营概览", path: "/" },
  { icon: Users, label: "用户管理", path: "/users" },
  { icon: ShoppingBag, label: "订单管理", path: "/orders" },
  { icon: Settings, label: "系统设置", path: "/settings", permission: "system.view" },
];

interface SidebarProps {
  open?: boolean;
  onClose?: () => void;
  permissions?: string[];
}

export function Sidebar({ open = false, onClose, permissions }: SidebarProps) {
  const visibleMenuItems = menuItems.filter(
    (item) =>
      !item.permission || permissions === undefined || permissions.includes(item.permission),
  );

  return (
    <>
      {open ? (
        <button
          type="button"
          aria-label="关闭导航遮罩"
          className="fixed inset-0 z-30 cursor-pointer bg-slate-950/40 backdrop-blur-[1px] lg:hidden"
          onClick={onClose}
        />
      ) : null}

      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r border-slate-200 bg-slate-950 text-slate-300 shadow-xl transition-transform duration-200 lg:static lg:z-auto lg:translate-x-0 lg:shadow-none ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex h-16 items-center justify-between border-b border-white/10 px-5">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white shadow-lg shadow-blue-950/40">
              <ShieldCheck aria-hidden="true" className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <p className="truncate text-base font-semibold tracking-wide text-white">PetCare</p>
              <p className="truncate text-xs text-slate-400">运营管理中心</p>
            </div>
          </div>
          <button
            type="button"
            aria-label="关闭导航"
            className="flex h-11 w-11 cursor-pointer items-center justify-center rounded-md text-slate-400 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 lg:hidden"
            onClick={onClose}
          >
            <X aria-hidden="true" className="h-5 w-5" />
          </button>
        </div>

        <nav aria-label="后台主导航" className="flex-1 space-y-1 overflow-y-auto px-3 py-5">
          <p className="px-3 pb-2 text-xs font-semibold uppercase tracking-widest text-slate-500">
            工作台
          </p>
          {visibleMenuItems.map((item) => {
            const Icon = item.icon;

            return (
              <NavLink
                key={item.path}
                to={item.path}
                end={item.path === "/"}
                onClick={onClose}
                className={({ isActive }) =>
                  `group flex min-h-11 items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium outline-none transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-blue-400 ${
                    isActive
                      ? "bg-blue-600 text-white shadow-sm"
                      : "text-slate-300 hover:bg-white/8 hover:text-white"
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    <Icon
                      aria-hidden="true"
                      className={`h-4.5 w-4.5 shrink-0 ${isActive ? "text-white" : "text-slate-400 group-hover:text-white"}`}
                    />
                    <span className="flex-1">{item.label}</span>
                    {isActive ? (
                      <ChevronRight aria-hidden="true" className="h-4 w-4 text-blue-100" />
                    ) : null}
                  </>
                )}
              </NavLink>
            );
          })}
        </nav>

        <div className="border-t border-white/10 p-4">
          <div className="rounded-lg bg-white/5 px-3 py-3">
            <p className="text-xs font-medium text-slate-300">系统状态</p>
            <p className="mt-1.5 flex items-center gap-2 text-xs text-slate-400">
              <span className="h-2 w-2 rounded-full bg-emerald-400" />
              所有服务运行正常
            </p>
          </div>
        </div>
      </aside>
    </>
  );
}
