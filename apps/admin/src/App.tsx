import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "./auth/AuthProvider";
import { PermissionRoute } from "./auth/PermissionRoute";
import { ProtectedRoute } from "./auth/ProtectedRoute";
import { GlobalErrorMessage } from "./components/GlobalErrorMessage";
import Layout from "./components/Layout";
import Login from "./pages/Login";
import { ADMIN_ROUTE_REGISTRY } from "./routes/registry";

function App() {
  return (
    <>
      <GlobalErrorMessage />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route element={<ProtectedRoute />}>
              <Route path="/" element={<Layout />}>
                {ADMIN_ROUTE_REGISTRY.map((route) => (
                  <Route
                    key={route.id}
                    element={<PermissionRoute requireAll={route.requiredPermissions} />}
                  >
                    {route.path === "/" ? (
                      <Route index element={route.element} />
                    ) : (
                      <Route path={route.path} element={route.element} />
                    )}
                  </Route>
                ))}
              </Route>
            </Route>
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </>
  );
}

export default App;
