import { lazy, Suspense, type ReactNode } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "./auth/AuthProvider";
import { PermissionRoute } from "./auth/PermissionRoute";
import { ProtectedRoute } from "./auth/ProtectedRoute";
import Layout from "./components/Layout";
import Dashboard from "./pages/Dashboard";
import Login from "./pages/Login";
import OrderManagement from "./pages/OrderManagement";
import ComplaintWorkQueue from "./pages/OrderManagement/Complaint";
import ComplaintDetail from "./pages/OrderManagement/Complaint/Detail";
import UserManagement from "./pages/UserManagement";
import ProviderCertificationList from "./pages/UserManagement/Certification";
import ProviderCertificationDetail from "./pages/UserManagement/Certification/Detail";

const Settings = lazy(() => import("./pages/Settings"));
const SettingsDetail = lazy(() => import("./pages/Settings/Detail"));
const SettingsEdit = lazy(() => import("./pages/Settings/Edit"));

function settingsRoute(element: ReactNode) {
  return (
    <Suspense
      fallback={
        <p
          aria-live="polite"
          className="rounded-xl border border-slate-200 bg-white p-8 text-center text-slate-600"
        >
          正在加载系统设置…
        </p>
      }
    >
      {element}
    </Suspense>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route element={<ProtectedRoute />}>
            <Route path="/" element={<Layout />}>
              <Route index element={<Dashboard />} />
              <Route path="users" element={<UserManagement />} />
              <Route path="users/certifications" element={<ProviderCertificationList />} />
              <Route path="users/certifications/:id" element={<ProviderCertificationDetail />} />
              <Route path="orders" element={<OrderManagement />} />
              <Route path="orders/complaints" element={<ComplaintWorkQueue />} />
              <Route path="orders/complaints/:id" element={<ComplaintDetail />} />
              <Route element={<PermissionRoute requireAll={["system.view"]} />}>
                <Route path="settings" element={settingsRoute(<Settings />)} />
                <Route path="settings/:domain/edit" element={settingsRoute(<SettingsEdit />)} />
                <Route
                  path="settings/:domain/history/:versionId"
                  element={settingsRoute(<SettingsDetail />)}
                />
              </Route>
            </Route>
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
