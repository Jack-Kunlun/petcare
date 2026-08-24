import { beforeEach, describe, expect, it, vi } from "vitest";
import { showApiError } from "./lib/global-error";
import { createAdminQueryClient } from "./query-client";

vi.mock("./lib/global-error", () => ({ showApiError: vi.fn() }));

describe("admin query client", () => {
  beforeEach(() => vi.clearAllMocks());

  it("reports one query error only after retries are exhausted", async () => {
    const client = createAdminQueryClient();
    const queryFn = vi.fn().mockRejectedValue(new Error("offline"));

    await expect(client.fetchQuery({ queryKey: ["failure"], queryFn })).rejects.toThrow();

    expect(queryFn).toHaveBeenCalledTimes(3);
    expect(showApiError).toHaveBeenCalledTimes(1);
  });

  it("reports a failed mutation once", async () => {
    const client = createAdminQueryClient();
    const mutation = client.getMutationCache().build(client, {
      mutationFn: async () => Promise.reject(new Error("save failed")),
    });

    await expect(mutation.execute(undefined)).rejects.toThrow("save failed");

    expect(showApiError).toHaveBeenCalledTimes(1);
  });
});
