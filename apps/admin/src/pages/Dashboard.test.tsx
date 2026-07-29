import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import Dashboard from "./Dashboard";

describe("Dashboard", () => {
  it("展示运营核心指标和待办事项", () => {
    render(
      <MemoryRouter>
        <Dashboard />
      </MemoryRouter>,
    );

    expect(screen.getByRole("heading", { name: "运营概览" })).toBeInTheDocument();
    expect(screen.getByText("累计用户")).toBeInTheDocument();
    expect(screen.getByText("今日订单")).toBeInTheDocument();
    expect(screen.getByText("本月成交额")).toBeInTheDocument();
    expect(screen.getByText("待处理事项")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "查看待审核宠托师" })).toHaveAttribute(
      "href",
      "/users",
    );
    expect(screen.getByRole("link", { name: "查看待处理纠纷" })).toHaveAttribute("href", "/orders");
  });
});
