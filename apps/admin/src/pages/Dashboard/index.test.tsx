import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import Dashboard from ".";

const auth = vi.hoisted(() => ({ roles: [] as string[] }));

vi.mock("../../auth/auth.context", () => ({
  useAuth: () => ({ user: { roles: auth.roles } }),
}));

describe("Dashboard", () => {
  it("只展示当前真实管理能力及对应入口", () => {
    render(
      <MemoryRouter>
        <Dashboard />
      </MemoryRouter>,
    );

    expect(screen.getByRole("heading", { name: "管理概览" })).toBeInTheDocument();
    expect(screen.getByText("5 个已启用模块")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "查看用户资料" })).toHaveAttribute("href", "/users");
    expect(screen.getByRole("link", { name: "进入社区审核" })).toHaveAttribute(
      "href",
      "/content/posts",
    );
    expect(screen.getByRole("link", { name: "管理课堂文章" })).toHaveAttribute(
      "href",
      "/content/articles",
    );
    expect(screen.getByRole("link", { name: "管理官网内容" })).toHaveAttribute(
      "href",
      "/website-content",
    );
    expect(screen.getByRole("link", { name: "管理公共内容" })).toHaveAttribute(
      "href",
      "/shared-content",
    );
    expect(screen.queryByText("今日订单")).not.toBeInTheDocument();
    expect(screen.queryByText("本月成交额")).not.toBeInTheDocument();
    expect(screen.queryByText("待审核宠托师")).not.toBeInTheDocument();
    expect(screen.queryByText(/本地个人版|可本地验证|当前范围已收窄/)).not.toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "服务流程演示" })).not.toBeInTheDocument();
  });

  it("shows the demonstration entry only to super administrators", () => {
    auth.roles = ["super_admin"];

    try {
      render(
        <MemoryRouter>
          <Dashboard />
        </MemoryRouter>,
      );

      expect(screen.getByRole("region", { name: "服务流程演示" })).toBeInTheDocument();
      expect(screen.getByRole("textbox", { name: /小程序演示编号/ })).toBeInTheDocument();
      expect(screen.getByText(/不产生真实订单、资金、账务或服务约定/)).toBeInTheDocument();
    } finally {
      auth.roles = [];
    }
  });

  it("applies keyboard and pointer states to dashboard actions", () => {
    render(
      <MemoryRouter>
        <Dashboard />
      </MemoryRouter>,
    );
    const action = screen.getAllByRole("link")[0];

    expect(action).toHaveClass("cursor-pointer");
    expect(action.className).toContain("hover:");
    expect(action.className).toContain("active:");
    expect(action.className).toContain("focus-visible:");
  });

  it("delays the five-column layout until the widest desktop breakpoint", () => {
    render(
      <MemoryRouter>
        <Dashboard />
      </MemoryRouter>,
    );

    expect(screen.getByRole("region", { name: "当前管理能力" })).toHaveClass(
      "xl:grid-cols-3",
      "2xl:grid-cols-5",
    );
  });
});
