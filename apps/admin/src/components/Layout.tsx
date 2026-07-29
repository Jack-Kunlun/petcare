import { useState } from "react";
import { Outlet } from "react-router-dom";
import { Header } from "../components/Header";
import { Sidebar } from "../components/Sidebar";

export default function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="flex min-h-screen bg-slate-50">
      <a
        href="#main-content"
        className="fixed left-4 top-3 z-50 -translate-y-20 rounded-md bg-blue-700 px-4 py-2 font-medium text-white transition-transform focus:translate-y-0"
      >
        跳到主要内容
      </a>
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="flex min-h-screen min-w-0 flex-1 flex-col">
        <Header onMenuOpen={() => setSidebarOpen(true)} />
        <main id="main-content" className="flex-1 overflow-auto p-4 sm:p-6 lg:p-8" tabIndex={-1}>
          <Outlet />
        </main>
      </div>
    </div>
  );
}
