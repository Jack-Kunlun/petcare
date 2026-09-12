import { afterEach, describe, expect, it, vi } from "vitest";

describe("miniapp feature boundaries", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("keeps commercial navigation closed unless the build explicitly enables it", async () => {
    vi.stubEnv("VITE_COMMERCIAL_SERVICES_ENABLED", "false");
    expect((await import("./features")).commercialServicesEnabled).toBe(false);

    vi.resetModules();
    vi.stubEnv("VITE_COMMERCIAL_SERVICES_ENABLED", "true");
    expect((await import("./features")).commercialServicesEnabled).toBe(true);
  });

  it("keeps qualification navigation independent and closed by default", async () => {
    vi.stubEnv("VITE_QUALIFICATION_WORKFLOW_ENABLED", "false");
    expect((await import("./features")).qualificationWorkflowEnabled).toBe(false);

    vi.resetModules();
    vi.stubEnv("VITE_QUALIFICATION_WORKFLOW_ENABLED", "true");
    expect((await import("./features")).qualificationWorkflowEnabled).toBe(true);
  });
});
