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

  it("shows the current administrator and logs out", async () => {
    const user = userEvent.setup();

    render(
      <MemoryRouter initialEntries={["/"]}>
        <Routes>
          <Route
            path="*"
            element={
              <>
                <Header />
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
});
