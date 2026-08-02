import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { Sidebar } from "./Sidebar";

describe("Sidebar", () => {
  it("only renders root menu links and highlights the current module", () => {
    render(
      <MemoryRouter initialEntries={["/orders/complaints"]}>
        <Sidebar />
      </MemoryRouter>,
    );

    expect(screen.getByRole("navigation", { name: "后台主导航" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "运营概览" })).toHaveAttribute("href", "/");
    expect(screen.getByRole("link", { name: "用户管理" })).toHaveAttribute("href", "/users");
    expect(screen.getByRole("link", { name: "订单管理" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "系统设置" })).toHaveAttribute("href", "/settings");
    expect(screen.queryByRole("link", { name: "投诉与纠纷" })).not.toBeInTheDocument();
  });

  it("does not expose root links when the user has no matching root permissions", () => {
    render(
      <MemoryRouter>
        <Sidebar permissions={[]} />
      </MemoryRouter>,
    );

    expect(screen.queryByRole("link", { name: "系统设置" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "订单管理" })).not.toBeInTheDocument();
  });

  it("does not flatten child permissions into the primary navigation", () => {
    render(
      <MemoryRouter>
        <Sidebar permissions={["dispute.view"]} />
      </MemoryRouter>,
    );

    expect(screen.queryByRole("link", { name: "投诉与纠纷" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "订单管理" })).not.toBeInTheDocument();
  });
});
