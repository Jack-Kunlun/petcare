import type { RbacCatalogResponse } from "@petcare/shared-types";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { apiClient } from "../auth";
import { fetchRbacCatalog } from "./catalog";

vi.mock("../auth", () => ({
  apiClient: {
    get: vi.fn(),
  },
}));

describe("fetchRbacCatalog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("gets the shared RBAC permission catalog and returns its unwrapped payload", async () => {
    const catalog: RbacCatalogResponse = { version: "catalog-v1", permissions: [] };

    vi.mocked(apiClient.get).mockResolvedValue({ data: catalog });

    await expect(fetchRbacCatalog()).resolves.toEqual(catalog);
    expect(apiClient.get).toHaveBeenCalledWith("/admin/rbac/catalog");
  });
});
