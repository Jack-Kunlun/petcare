import { Home, Users, ShoppingCart, Settings } from "lucide-react";
import { Link, useLocation } from "react-router-dom";

const menuItems = [
  { icon: Home, label: "仪表盘", path: "/" },
  { icon: Users, label: "用户管理", path: "/users" },
  { icon: ShoppingCart, label: "订单管理", path: "/orders" },
  { icon: Settings, label: "系统设置", path: "/settings" },
];

export function Sidebar() {
  const location = useLocation();

  return (
    <aside className="w-64 bg-white shadow-md">
      <div className="p-6">
        <h1 className="text-2xl font-bold text-primary">PetCare</h1>
        <p className="text-sm text-gray-500">后台管理系统</p>
      </div>
      <nav className="mt-6">
        {menuItems.map((item) => {
          const isActive = location.pathname === item.path;

          return (
            <Link
              key={item.path}
              to={item.path}
              className={`flex items-center px-6 py-3 hover:bg-gray-100 ${
                isActive ? "bg-blue-50 text-blue-600 border-r-4 border-blue-600" : "text-gray-700"
              }`}
            >
              <item.icon className="w-5 h-5 mr-3" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
