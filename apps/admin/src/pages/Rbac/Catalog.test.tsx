import type { RbacCatalogResponse } from "@petcare/shared-types";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as rbacApi from "../../api/rbac";
import RbacCatalog from "./Catalog";

vi.mock("../../api/rbac");

const catalog: RbacCatalogResponse = {
  version: "2026-08-02",
  permissions: [
    {
      code: "system.view",
      type: "menu",
      label: "系统设置",
      module: "system",
      path: "/settings",
      parentCode: null,
      order: 10,
      icon: "Settings",
      impliedApiCodes: [],
    },
    {
      code: "system.read",
      type: "api",
      label: "读取系统设置接口",
      module: "system",
      path: null,
      parentCode: null,
      order: 10,
      icon: null,
      impliedApiCodes: [],
    },
  ],
};

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <RbacCatalog />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("Rbac catalog page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(rbacApi.fetchRbacCatalog).mockResolvedValue(catalog);
  });

  it("renders the read-only menu catalog and excludes API permissions", async () => {
    renderPage();

    expect(await screen.findByRole("heading", { name: "菜单目录" })).toBeInTheDocument();
    expect(await screen.findByText("系统设置")).toBeInTheDocument();
    expect(
      screen.getByText("目录只读，API 权限由服务端根据菜单和按钮权限自动派生。"),
    ).toBeInTheDocument();
    expect(screen.queryByText("读取系统设置接口")).not.toBeInTheDocument();
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
  });
});
