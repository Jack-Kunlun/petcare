import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { SecondarySidebar } from "./SecondarySidebar";

describe("SecondarySidebar", () => {
  it("renders user module pages as vertical secondary links", () => {
    render(
      <MemoryRouter initialEntries={["/users"]}>
        <SecondarySidebar permissions={["user.view", "provider_certification.view"]} />
      </MemoryRouter>,
    );

    expect(screen.getByRole("navigation", { name: "后台二级导航" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "用户列表" })).toHaveAttribute("href", "/users");
    expect(screen.getByRole("link", { name: "认证审核" })).toHaveAttribute(
      "href",
      "/users/certifications",
    );
    expect(screen.getByRole("link", { name: "用户列表" })).toHaveAttribute("aria-current", "page");
  });

  it("highlights the parent list entry for a detail route", () => {
    render(
      <MemoryRouter initialEntries={["/orders/complaints/complaint-1"]}>
        <SecondarySidebar permissions={["order.view", "dispute.view"]} />
      </MemoryRouter>,
    );

    expect(screen.getByRole("link", { name: "投诉与纠纷" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(screen.getByRole("link", { name: "投诉与纠纷" })).toHaveAttribute(
      "href",
      "/orders/complaints",
    );
  });

  it("renders system settings and RBAC pages in the same secondary menu", () => {
    render(
      <MemoryRouter initialEntries={["/rbac/catalog"]}>
        <SecondarySidebar permissions={["system.view", "rbac.view", "rbac.catalog.view"]} />
      </MemoryRouter>,
    );

    expect(screen.getByRole("link", { name: "系统设置" })).toHaveAttribute("href", "/settings");
    expect(screen.getByRole("link", { name: "角色管理" })).toHaveAttribute("href", "/rbac");
    expect(screen.getByRole("link", { name: "菜单目录" })).toHaveAttribute("aria-current", "page");
  });

  it("does not render an empty secondary sidebar for the dashboard", () => {
    render(
      <MemoryRouter initialEntries={["/"]}>
        <SecondarySidebar permissions={["stats.view"]} />
      </MemoryRouter>,
    );

    expect(screen.queryByRole("navigation", { name: "后台二级导航" })).not.toBeInTheDocument();
  });
});
