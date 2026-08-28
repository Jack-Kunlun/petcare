import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Header } from "./Header";

const logout = vi.hoisted(() => vi.fn());
const accountUser = vi.hoisted(() => ({ avatar: null as string | null }));

vi.mock("../auth/auth.context", () => ({
  useAuth: () => ({
    status: "authenticated",
    user: {
      id: "user-1",
      username: "admin",
      phone: "13800138000",
      nickname: "系统管理员",
      avatar: accountUser.avatar,
      roles: ["super_admin"],
    },
    logout,
  }),
}));

function LocationProbe() {
  const location = useLocation();

  return <div>{`${location.pathname}${location.hash}`}</div>;
}

describe("Header", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    accountUser.avatar = null;
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
    expect(screen.getByText("PetCare 管理后台")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /通知/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "退出登录" })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "账户菜单" }));
    await user.click(screen.getByRole("menuitem", { name: "退出登录" }));

    expect(logout).toHaveBeenCalledTimes(1);
    expect(await screen.findByText("/login")).toBeInTheDocument();
  });

  it("uses the shared shell height token", () => {
    const { container } = render(
      <MemoryRouter>
        <Header onMenuOpen={vi.fn()} />
      </MemoryRouter>,
    );

    expect(container.querySelector("header")).toHaveClass("h-[var(--admin-header-height)]");
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

    const menuControl = screen.getByRole("button", { name: "打开导航" });

    expect(menuControl).toHaveClass("h-11", "w-11", "cursor-pointer");
    expect(menuControl.className).toContain("hover:");
    expect(menuControl.className).toContain("active:");
    expect(menuControl.className).toContain("focus-visible:");

    const userInfo = screen.getByRole("button", { name: "账户菜单" });

    expect(userInfo).toHaveClass("min-h-11", "cursor-pointer");
    expect(userInfo.className).toContain("hover:");
    expect(userInfo.className).toContain("active:");
    expect(userInfo.className).toContain("focus-visible:");
    expect(screen.queryByRole("button", { name: "退出登录" })).not.toBeInTheDocument();
  });

  it("opens an accessible account menu with profile and password navigation", async () => {
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

    const accountButton = screen.getByRole("button", { name: "账户菜单" });

    expect(accountButton).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();

    await user.click(accountButton);

    expect(accountButton).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("menu")).toHaveTextContent("个人中心");
    expect(screen.getByRole("menuitem", { name: "修改密码" })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "退出登录" })).toBeInTheDocument();

    await user.click(screen.getByRole("menuitem", { name: "个人中心" }));

    await waitFor(() => expect(screen.getByText("/account")).toBeInTheDocument());
  });

  it("keeps the account menu button available at narrow widths and navigates to password", async () => {
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

    const accountButton = screen.getByRole("button", { name: "账户菜单" });

    expect(accountButton).not.toHaveClass("hidden");
    expect(accountButton).toHaveClass("min-h-11", "min-w-11");

    await user.click(accountButton);
    await user.click(screen.getByRole("menuitem", { name: "修改密码" }));

    await waitFor(() => expect(screen.getByText("/account#password")).toBeInTheDocument());
  });

  it("shows the current avatar in the account menu trigger when one is set", () => {
    accountUser.avatar = "https://cdn.example/avatar.webp";

    render(
      <MemoryRouter>
        <Header onMenuOpen={vi.fn()} />
      </MemoryRouter>,
    );

    expect(screen.getByRole("img", { name: "当前头像" })).toHaveAttribute(
      "src",
      "https://cdn.example/avatar.webp",
    );
  });
});
