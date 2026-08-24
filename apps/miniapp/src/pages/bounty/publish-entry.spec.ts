import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { requireProfile } from "../../state/session";
import { openPublishEntry } from "./publish-entry";

vi.mock("../../state/session", () => ({ requireProfile: vi.fn() }));

const requireProfileMock = vi.mocked(requireProfile);
const navigateTo = vi.fn();

describe("bounty publish entry", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("uni", { navigateTo });
  });

  it("allows only one profile gate and navigation while pending", async () => {
    let resolveGate!: (allowed: boolean) => void;

    requireProfileMock.mockReturnValue(
      new Promise<boolean>((resolvePromise) => {
        resolveGate = resolvePromise;
      }),
    );

    const pending = { value: false };

    const first = openPublishEntry(pending);
    const second = openPublishEntry(pending);

    expect(pending.value).toBe(true);
    expect(requireProfileMock).toHaveBeenCalledTimes(1);

    resolveGate(true);
    await Promise.all([first, second]);

    expect(navigateTo).toHaveBeenCalledTimes(1);
    expect(pending.value).toBe(false);
  });

  it("renders the publish entry as a natively disabled control", () => {
    const source = readFileSync(resolve(import.meta.dirname, "index.vue"), "utf8");

    expect(source).toMatch(/<button\b/);
    expect(source).toContain(':disabled="publishPending"');
    expect(source).toContain(':aria-disabled="publishPending"');
  });
});
