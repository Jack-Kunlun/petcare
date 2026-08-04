import { useState } from "react";
import { Outlet } from "react-router-dom";
import { useAuth } from "../auth/auth.context";
import { Header } from "../components/Header";
import { PageTransition } from "../components/PageTransition";
import { Sidebar } from "../components/Sidebar";

export default function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const auth = useAuth();

  return (
    <div className="flex h-screen min-h-0 overflow-hidden bg-slate-50">
      <a
        href="#main-content"
        className="fixed left-4 top-3 z-50 -translate-y-20 rounded-md bg-blue-700 px-4 py-2 font-medium text-white transition-transform focus:translate-y-0"
      >
        跳到主要内容
      </a>
      <Sidebar
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        permissions={auth.user?.permissions ?? []}
      />
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <Header onMenuOpen={() => setSidebarOpen(true)} />
        <main
          id="main-content"
          className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8"
          tabIndex={-1}
        >
          <PageTransition>
            <Outlet />
          </PageTransition>
        </main>
      </div>
    </div>
  );
}
