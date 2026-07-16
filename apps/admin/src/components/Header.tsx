import { Bell, User } from "lucide-react";

export function Header() {
  return (
    <header className="bg-white shadow-sm px-6 py-4 flex justify-between items-center">
      <div>
        <h2 className="text-xl font-semibold">欢迎使用PetCare后台管理系统</h2>
      </div>
      <div className="flex items-center space-x-4">
        <button className="p-2 hover:bg-gray-100 rounded-full">
          <Bell className="w-5 h-5 text-gray-600" />
        </button>
        <button className="flex items-center space-x-2 p-2 hover:bg-gray-100 rounded-full">
          <User className="w-5 h-5 text-gray-600" />
          <span className="text-sm">管理员</span>
        </button>
      </div>
    </header>
  );
}
