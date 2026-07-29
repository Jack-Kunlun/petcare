import { NavLink } from "react-router-dom";

const navigationItems = [
  { label: "用户列表", to: "/users", end: true },
  { label: "认证审核", to: "/users/certifications", end: false },
];

/** 用户管理模块的二级导航。 */
export function UserManagementNavigation() {
  return (
    <nav
      aria-label="用户管理二级导航"
      className="flex gap-1 rounded-lg border border-slate-200 bg-white p-1 shadow-sm"
    >
      {navigationItems.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.end}
          className={({ isActive }) =>
            `inline-flex min-h-11 items-center rounded-md px-4 text-sm font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-blue-600 ${
              isActive
                ? "bg-blue-700 text-white"
                : "text-slate-600 hover:bg-slate-100 hover:text-slate-950"
            }`
          }
        >
          {item.label}
        </NavLink>
      ))}
    </nav>
  );
}
