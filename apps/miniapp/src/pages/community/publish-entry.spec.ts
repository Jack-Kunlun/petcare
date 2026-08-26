import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { requireProfile } from "../../state/session";
import { openCommunityPublishEntry } from "./publish-entry";

vi.mock("../../state/session", () => ({ requireProfile: vi.fn() }));

const requireProfileMock = vi.mocked(requireProfile);
const navigateTo = vi.fn();

describe("community publish entry", () => {
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

    const first = openCommunityPublishEntry(pending);
    const second = openCommunityPublishEntry(pending);

    expect(pending.value).toBe(true);
    expect(requireProfileMock).toHaveBeenCalledTimes(1);

    resolveGate(true);
    await Promise.all([first, second]);

    expect(navigateTo).toHaveBeenCalledWith({ url: "/pages-content/community/publish" });
    expect(pending.value).toBe(false);
  });

  it("renders the entry as a natively disabled control while navigation is pending", () => {
    const source = readFileSync(resolve(import.meta.dirname, "index.vue"), "utf8");

    expect(source).toMatch(/<button\b/);
    expect(source).toContain(':disabled="publishPending"');
    expect(source).toContain(':aria-disabled="publishPending"');
  });
});
