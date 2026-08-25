import { useState } from "react";
import { createBrowserRouter, RouterProvider, type RouteObject } from "react-router-dom";
import { AuthProvider } from "./auth/AuthProvider";
import { PermissionRoute } from "./auth/PermissionRoute";
import { ProtectedRoute } from "./auth/ProtectedRoute";
import { GlobalErrorMessage } from "./components/GlobalErrorMessage";
import Layout from "./components/Layout";
import Login from "./pages/Login";
import { ADMIN_ROUTE_REGISTRY } from "./routes/registry";

function createAdminRoutes(): RouteObject[] {
  return [
    { path: "/login", element: <Login /> },
    {
      element: <ProtectedRoute />,
      children: [
        {
          path: "/",
          element: <Layout />,
          children: ADMIN_ROUTE_REGISTRY.map((route) => ({
            element: <PermissionRoute requireAll={route.requiredPermissions} />,
            children: [
              route.path === "/"
                ? { index: true, element: route.element }
                : { path: route.path, element: route.element },
            ],
          })),
        },
      ],
    },
  ];
}

/** Creates the stable Data Router tree for the Admin application. */
// eslint-disable-next-line react-refresh/only-export-components
export function createAdminRouter() {
  return createBrowserRouter(createAdminRoutes());
}

function App() {
  const [router] = useState(createAdminRouter);

  return (
    <>
      <GlobalErrorMessage />
      <AuthProvider>
        <RouterProvider router={router} />
      </AuthProvider>
    </>
  );
}

export default App;
