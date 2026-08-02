import { render } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { AuthContext, type AuthContextValue } from "../auth/auth.context";
import Layout from "./Layout";

const auth: AuthContextValue = {
  status: "authenticated",
  user: {
    id: "admin-1",
    username: "admin",
    phone: "17679141878",
    nickname: "系统管理员",
    roles: ["super_admin"],
    permissions: ["user.view", "provider_certification.view"],
  },
  loginWithPassword: vi.fn(),
  loginWithSms: vi.fn(),
  getCaptcha: vi.fn(),
  sendSmsCode: vi.fn(),
  logout: vi.fn(),
};

describe("Layout", () => {
  it("keeps page scrolling inside main while sidebars stay viewport-bound", () => {
    const { baseElement } = render(
      <AuthContext.Provider value={auth}>
        <MemoryRouter initialEntries={["/users"]}>
          <Routes>
            <Route element={<Layout />}>
              <Route path="/users" element={<div>内容</div>} />
            </Route>
          </Routes>
        </MemoryRouter>
      </AuthContext.Provider>,
    );

    const main = baseElement.querySelector("#main-content");
    const contentColumn = main?.parentElement;
    const layout = contentColumn?.parentElement;

    expect(layout).toHaveClass("h-screen", "min-h-0", "overflow-hidden");
    expect(contentColumn).toHaveClass("min-h-0");
    expect(main).toHaveClass("min-h-0", "overflow-y-auto");
  });
});
