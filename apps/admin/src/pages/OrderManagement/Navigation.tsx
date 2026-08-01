import { NavLink } from "react-router-dom";

const navigationItems = [
  { label: "订单列表", to: "/orders", end: true },
  { label: "投诉与纠纷", to: "/orders/complaints", end: false },
];

/** 订单管理模块的二级导航。 */
export function OrderManagementNavigation() {
  return (
    <nav
      aria-label="订单管理二级导航"
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
