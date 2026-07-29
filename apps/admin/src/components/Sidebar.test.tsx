import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { Sidebar } from "./Sidebar";

describe("Sidebar", () => {
  it("展示后台主导航并标识当前页面", () => {
    render(
      <MemoryRouter initialEntries={["/orders"]}>
        <Sidebar />
      </MemoryRouter>,
    );

    expect(screen.getByRole("navigation", { name: "后台主导航" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "运营概览" })).toHaveAttribute("href", "/");
    expect(screen.getByRole("link", { name: "用户管理" })).toHaveAttribute("href", "/users");
    expect(screen.getByRole("link", { name: "订单管理" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "系统设置" })).toHaveAttribute("href", "/settings");
  });
});
