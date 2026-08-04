import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Header } from "./Header";

const logout = vi.hoisted(() => vi.fn());

vi.mock("../auth/auth.context", () => ({
  useAuth: () => ({
    status: "authenticated",
    user: {
      id: "user-1",
      username: "admin",
      phone: "17679141878",
      nickname: "系统管理员",
      roles: ["super_admin"],
    },
    logout,
  }),
}));

function LocationProbe() {
  return <div>{useLocation().pathname}</div>;
}

describe("Header", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    logout.mockResolvedValue(undefined);
  });

  it("展示当前管理员并支持退出登录", async () => {
    const user = userEvent.setup();

    render(
      <MemoryRouter initialEntries={["/"]}>
        <Routes>
          <Route
            path="*"
            element={
              <>
                <Header onMenuOpen={vi.fn()} />
                <LocationProbe />
              </>
            }
          />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByText("系统管理员")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "退出登录" }));

    expect(logout).toHaveBeenCalledTimes(1);
    expect(await screen.findByText("/login")).toBeInTheDocument();
  });

  it("可从窄屏顶栏打开主导航", async () => {
    const user = userEvent.setup();
    const onMenuOpen = vi.fn();

    render(
      <MemoryRouter>
        <Header onMenuOpen={onMenuOpen} />
      </MemoryRouter>,
    );

    await user.click(screen.getByRole("button", { name: "打开导航" }));
    expect(onMenuOpen).toHaveBeenCalledTimes(1);
  });

  it("keeps every interactive header control touch-friendly and keyboard-visible", () => {
    render(
      <MemoryRouter>
        <Header onMenuOpen={vi.fn()} />
      </MemoryRouter>,
    );

    for (const name of ["打开导航", /^通知，\d+ 条未读$/, "退出登录"]) {
      const control = screen.getByRole("button", { name });

      expect(control).toHaveClass("h-11", "w-11", "cursor-pointer");
      expect(control.className).toContain("hover:");
      expect(control.className).toContain("active:");
      expect(control.className).toContain("focus-visible:");
    }

    const userInfo = screen.getByTestId("header-user-info");

    expect(userInfo).toHaveClass("cursor-pointer");
    expect(userInfo.className).toContain("hover:");
    expect(userInfo.className).toContain("active:");
    expect(userInfo.className).toContain("focus-visible:");
  });
});
