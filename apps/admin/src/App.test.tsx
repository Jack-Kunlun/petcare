import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import App from "./App";

vi.mock("./auth/AuthProvider", () => ({
  AuthProvider: ({ children }: { children: React.ReactNode }) => children,
}));

vi.mock("./auth/ProtectedRoute", async () => {
  const { Outlet } = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");

  return { ProtectedRoute: Outlet };
});

vi.mock("./components/Layout", async () => {
  const { Outlet } = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");

  return { default: Outlet };
});

vi.mock("./pages/OrderManagement/Complaint", () => ({
  default: () => "投诉工作队列路由",
}));

describe("App complaint routes", () => {
  beforeEach(() => {
    window.history.replaceState({}, "", "/orders/complaints");
  });

  it("registers the complaint list route without requiring the detail page", async () => {
    render(<App />);

    expect(await screen.findByText("投诉工作队列路由")).toBeInTheDocument();
  });
});
