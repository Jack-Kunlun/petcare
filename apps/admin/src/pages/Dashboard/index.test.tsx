import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import Dashboard from ".";

describe("Dashboard", () => {
  it("只展示当前真实管理能力及对应入口", () => {
    render(
      <MemoryRouter>
        <Dashboard />
      </MemoryRouter>,
    );

    expect(screen.getByRole("heading", { name: "管理概览" })).toBeInTheDocument();
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
});
