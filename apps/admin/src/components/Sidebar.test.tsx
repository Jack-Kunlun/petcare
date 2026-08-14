import { fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import colorSymbolUrl from "../assets/brand/petcare-symbol-color.svg";
import { Sidebar } from "./Sidebar";

function getNavigationHrefs(root: HTMLElement) {
  return within(root)
    .getAllByRole("link")
    .map((link) => link.getAttribute("href"));
}

describe("Sidebar", () => {
  it("uses the color PetCare symbol with an accessible label", () => {
    render(
      <MemoryRouter>
        <Sidebar />
      </MemoryRouter>,
    );

    expect(screen.getByRole("img", { name: "PetCare 运营管理中心" })).toHaveAttribute(
      "src",
      colorSymbolUrl,
    );
    expect(screen.getByRole("img", { name: "PetCare 运营管理中心" })).toHaveClass("h-10", "w-10");
    expect(screen.getByText("PetCare")).toBeInTheDocument();
    expect(screen.getByText("运营管理中心")).toBeInTheDocument();
  });

  it("renders module and page routes as one expandable navigation tree", () => {
    render(
      <MemoryRouter initialEntries={["/orders/complaints"]}>
        <Sidebar />
      </MemoryRouter>,
    );

    expect(screen.getByRole("navigation", { name: "后台主导航" })).toBeInTheDocument();
    const desktopTree = screen.getByTestId("desktop-menu-tree");
    const tree = within(desktopTree);

    expect(getNavigationHrefs(desktopTree)).toEqual(
      expect.arrayContaining(["/", "/orders", "/orders/complaints"]),
    );
    expect(tree.getByRole("button", { name: "订单管理菜单" })).toHaveClass("bg-blue-600/40");
    expect(tree.getByRole("link", { name: "投诉与纠纷" })).toHaveClass("bg-blue-600");
    expect(tree.getByRole("link", { name: "投诉与纠纷" })).toHaveAttribute("aria-current", "page");
  });

  it("supports collapsing and expanding a branch without changing the current route", () => {
    render(
      <MemoryRouter initialEntries={["/orders"]}>
        <Sidebar />
      </MemoryRouter>,
    );

    const desktopTree = screen.getByTestId("desktop-menu-tree");
    const tree = within(desktopTree);
    const toggle = tree.getByRole("button", { name: "订单管理菜单" });

    expect(toggle).toHaveAttribute("aria-expanded", "true");
    expect(toggle).toHaveClass("cursor-pointer");
    expect(toggle.className).toContain("focus-visible:");
    expect(tree.getByRole("link", { name: "订单管理" })).toHaveClass("bg-blue-600");
    expect(tree.getByRole("link", { name: "投诉与纠纷" })).toBeInTheDocument();

    fireEvent.click(toggle);

    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(tree.queryByRole("link", { name: "投诉与纠纷" })).not.toBeInTheDocument();
    const collapsedSubmenu = desktopTree.querySelector("#submenu-orders");

    if (collapsedSubmenu === null) {
      throw new Error("订单管理子菜单应保持挂载以支持收起动画");
    }

    expect(collapsedSubmenu).toBeInTheDocument();
    expect(collapsedSubmenu).toHaveAttribute("aria-hidden", "true");
    expect(collapsedSubmenu.parentElement).toHaveClass("grid", "grid-rows-[0fr]", "duration-200");

    fireEvent.click(toggle);

    expect(tree.getByRole("link", { name: "投诉与纠纷" })).toBeInTheDocument();
    expect(desktopTree.querySelector("#submenu-orders")).toHaveAttribute("aria-hidden", "false");
  });

  it("renders the user module page and certification page as sibling child menus", () => {
    render(
      <MemoryRouter initialEntries={["/users"]}>
        <Sidebar permissions={["user.view", "provider_certification.view"]} />
      </MemoryRouter>,
    );

    const tree = within(screen.getByTestId("desktop-menu-tree"));

    expect(tree.getByRole("button", { name: "用户管理菜单" })).toHaveAttribute(
      "aria-expanded",
      "true",
    );
    expect(tree.getByRole("link", { name: "用户列表" })).toHaveAttribute("href", "/users");
    expect(tree.getByRole("link", { name: "认证审核" })).toHaveAttribute(
      "href",
      "/users/certifications",
    );
  });

  it("keeps system settings and permission management as separate root menus", () => {
    render(
      <MemoryRouter initialEntries={["/rbac/catalog"]}>
        <Sidebar permissions={["system.view", "rbac.view", "rbac.catalog.view"]} />
      </MemoryRouter>,
    );

    const tree = within(screen.getByTestId("desktop-menu-tree"));

    expect(tree.getByRole("link", { name: "系统设置" })).toHaveAttribute("href", "/settings");
    expect(tree.getByRole("button", { name: "权限管理菜单" })).toHaveAttribute(
      "aria-expanded",
      "true",
    );
    expect(tree.getByRole("link", { name: "角色管理" })).toHaveAttribute("href", "/rbac");
    expect(tree.getByRole("link", { name: "菜单目录" })).toHaveAttribute("aria-current", "page");
  });

  it("renders Website Settings as a leaf menu without an expand indicator", () => {
    render(
      <MemoryRouter initialEntries={["/website-content"]}>
        <Sidebar permissions={["website.view"]} />
      </MemoryRouter>,
    );

    const tree = within(screen.getByTestId("desktop-menu-tree"));
    const websiteSettings = tree.getByRole("link", { name: "官网设置" });

    expect(websiteSettings).toHaveAttribute("href", "/website-content");
    expect(websiteSettings.querySelector(".lucide-earth")).toBeInTheDocument();
    expect(websiteSettings.querySelector(".lucide-chevron-right")).toBeNull();
    expect(tree.queryByRole("button", { name: "官网设置菜单" })).not.toBeInTheDocument();
  });

  it("keeps mobile navigation flat while the desktop menu uses the tree", () => {
    render(
      <MemoryRouter initialEntries={["/orders"]}>
        <Sidebar />
      </MemoryRouter>,
    );

    const mobileMenu = within(screen.getByTestId("mobile-menu"));

    expect(mobileMenu.getByRole("link", { name: "订单管理" })).toHaveAttribute("href", "/orders");
    expect(mobileMenu.queryByRole("link", { name: "投诉与纠纷" })).not.toBeInTheDocument();
  });

  it("does not expose menu links when the user has no matching permissions", () => {
    render(
      <MemoryRouter>
        <Sidebar permissions={[]} />
      </MemoryRouter>,
    );

    expect(screen.queryByRole("link", { name: "系统设置" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "订单管理" })).not.toBeInTheDocument();
  });

  it("does not expose a child route without its parent menu permission", () => {
    render(
      <MemoryRouter>
        <Sidebar permissions={["dispute.view"]} />
      </MemoryRouter>,
    );

    expect(screen.queryByRole("link", { name: "投诉与纠纷" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "订单管理" })).not.toBeInTheDocument();
  });
});
