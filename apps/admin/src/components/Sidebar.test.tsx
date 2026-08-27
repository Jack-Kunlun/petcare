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
  it("uses the shared shell width and header-height tokens", () => {
    const { container } = render(
      <MemoryRouter>
        <Sidebar />
      </MemoryRouter>,
    );

    const sidebar = container.querySelector("aside");

    expect(sidebar).toHaveClass("w-[var(--admin-sidebar-width)]");
    expect(sidebar?.firstElementChild).toHaveClass("h-[var(--admin-header-height)]");
  });

  it("uses current personal administration branding", () => {
    render(
      <MemoryRouter>
        <Sidebar />
      </MemoryRouter>,
    );

    expect(screen.getByRole("img", { name: "PetCare 管理后台" })).toHaveAttribute(
      "src",
      colorSymbolUrl,
    );
    expect(screen.getByRole("img", { name: "PetCare 管理后台" })).toHaveClass("h-10", "w-10");
    expect(screen.getByText("PetCare")).toBeInTheDocument();
    expect(screen.getByText("个人版管理后台")).toBeInTheDocument();
    expect(screen.getByText("本地管理功能可用")).toBeInTheDocument();
  });

  it("renders current content routes as one expandable navigation tree", () => {
    render(
      <MemoryRouter initialEntries={["/content/posts"]}>
        <Sidebar />
      </MemoryRouter>,
    );

    expect(screen.getByRole("navigation", { name: "后台主导航" })).toBeInTheDocument();
    const desktopTree = screen.getByTestId("desktop-menu-tree");
    const tree = within(desktopTree);

    expect(getNavigationHrefs(desktopTree)).toEqual(
      expect.arrayContaining(["/", "/content", "/content/posts", "/content/articles"]),
    );
    expect(tree.getByRole("button", { name: "内容管理菜单" })).toHaveClass("bg-blue-600/40");
    expect(tree.getByRole("link", { name: "帖子管理" })).toHaveClass("bg-blue-600");
    expect(tree.getByRole("link", { name: "帖子管理" })).toHaveAttribute("aria-current", "page");
  });

  it("supports collapsing and expanding a current content branch", () => {
    render(
      <MemoryRouter initialEntries={["/content"]}>
        <Sidebar />
      </MemoryRouter>,
    );

    const desktopTree = screen.getByTestId("desktop-menu-tree");
    const tree = within(desktopTree);
    const toggle = tree.getByRole("button", { name: "内容管理菜单" });

    expect(toggle).toHaveAttribute("aria-expanded", "true");
    expect(toggle).toHaveClass("cursor-pointer");
    expect(toggle.className).toContain("focus-visible:");
    expect(tree.getByRole("link", { name: "内容概览" })).toHaveClass("bg-blue-600");
    expect(tree.getByRole("link", { name: "帖子管理" })).toBeInTheDocument();

    fireEvent.click(toggle);

    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(tree.queryByRole("link", { name: "帖子管理" })).not.toBeInTheDocument();
    const collapsedSubmenu = desktopTree.querySelector("#submenu-content");

    if (collapsedSubmenu === null) {
      throw new Error("内容管理子菜单应保持挂载以支持收起动画");
    }

    expect(collapsedSubmenu).toHaveAttribute("aria-hidden", "true");
    expect(collapsedSubmenu.parentElement).toHaveClass("grid", "grid-rows-[0fr]", "duration-200");

    fireEvent.click(toggle);

    expect(tree.getByRole("link", { name: "帖子管理" })).toBeInTheDocument();
    expect(desktopTree.querySelector("#submenu-content")).toHaveAttribute("aria-hidden", "false");
  });

  it("renders user management as a leaf without certification siblings", () => {
    render(
      <MemoryRouter initialEntries={["/users"]}>
        <Sidebar permissions={["user.view"]} />
      </MemoryRouter>,
    );

    const tree = within(screen.getByTestId("desktop-menu-tree"));
    const users = tree.getByRole("link", { name: "用户管理" });

    expect(users).toHaveAttribute("href", "/users");
    expect(users).toHaveAttribute("aria-current", "page");
    expect(tree.queryByRole("button", { name: "用户管理菜单" })).not.toBeInTheDocument();
    expect(tree.queryByText("认证审核")).not.toBeInTheDocument();
  });

  it("renders permission management with its current catalog child", () => {
    render(
      <MemoryRouter initialEntries={["/rbac/catalog"]}>
        <Sidebar permissions={["rbac.view", "rbac.catalog.view"]} />
      </MemoryRouter>,
    );

    const tree = within(screen.getByTestId("desktop-menu-tree"));

    expect(tree.getByRole("button", { name: "权限管理菜单" })).toHaveAttribute(
      "aria-expanded",
      "true",
    );
    expect(tree.getByRole("link", { name: "角色管理" })).toHaveAttribute("href", "/rbac");
    expect(tree.getByRole("link", { name: "菜单目录" })).toHaveAttribute("aria-current", "page");
  });

  it("renders Website and shared content as separate leaf menus with the same compatible access", () => {
    render(
      <MemoryRouter initialEntries={["/website-content"]}>
        <Sidebar permissions={["website.view"]} />
      </MemoryRouter>,
    );

    const tree = within(screen.getByTestId("desktop-menu-tree"));
    const websiteSettings = tree.getByRole("link", { name: "官网管理" });
    const sharedSettings = tree.getByRole("link", { name: "公共内容配置" });

    expect(websiteSettings).toHaveAttribute("href", "/website-content");
    expect(websiteSettings.querySelector(".lucide-earth")).toBeInTheDocument();
    expect(sharedSettings).toHaveAttribute("href", "/shared-content");
    expect(sharedSettings.querySelector(".lucide-settings-2")).toBeInTheDocument();
    expect(tree.queryByRole("button", { name: "官网管理菜单" })).not.toBeInTheDocument();
    expect(tree.queryByRole("button", { name: "公共内容配置菜单" })).not.toBeInTheDocument();
  });

  it("keeps mobile navigation flat while desktop uses the current content tree", () => {
    render(
      <MemoryRouter initialEntries={["/content"]}>
        <Sidebar />
      </MemoryRouter>,
    );

    const mobileMenu = within(screen.getByTestId("mobile-menu"));

    expect(mobileMenu.getByRole("link", { name: "内容管理" })).toHaveAttribute("href", "/content");
    expect(mobileMenu.queryByRole("link", { name: "帖子管理" })).not.toBeInTheDocument();
  });

  it("does not expose menu links without matching permissions", () => {
    render(
      <MemoryRouter>
        <Sidebar permissions={[]} />
      </MemoryRouter>,
    );

    expect(screen.queryByRole("link", { name: "内容管理" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "权限管理" })).not.toBeInTheDocument();
  });

  it("does not expose a child route without its parent menu permission", () => {
    render(
      <MemoryRouter>
        <Sidebar permissions={["content.post.view"]} />
      </MemoryRouter>,
    );

    expect(screen.queryByRole("link", { name: "帖子管理" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "内容管理" })).not.toBeInTheDocument();
  });

  it("does not expose paused commercial navigation paths", () => {
    render(
      <MemoryRouter>
        <Sidebar />
      </MemoryRouter>,
    );

    const hrefs = getNavigationHrefs(screen.getByRole("navigation", { name: "后台主导航" }));

    for (const path of ["/orders", "/users/certifications", "/settings"]) {
      expect(hrefs).not.toContain(path);
    }
  });
});
