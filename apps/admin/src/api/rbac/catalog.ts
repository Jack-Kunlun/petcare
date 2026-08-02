import type { RbacCatalogResponse } from "@petcare/shared-types";
import { apiClient } from "../auth";

/** Retrieves the server-owned RBAC permission catalog after the API client unwraps its envelope. */
export async function fetchRbacCatalog(): Promise<RbacCatalogResponse> {
  const response = await apiClient.get<RbacCatalogResponse>("/admin/rbac/catalog");

  return response.data;
}
