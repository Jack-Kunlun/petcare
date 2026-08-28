import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = (path: string) => readFileSync(resolve(import.meta.dirname, path), "utf8");

const app = source("../App.vue");
const home = source("../pages/index/index.vue");
const community = source("../pages/community/index.vue");
const contact = source("../pages-content/contact/index.vue");
const petList = source("../pages-account/pets/index.vue");
const petDetail = source("../pages-account/pets/detail.vue");
const petForm = source("../pages-account/pets/form.vue");
const profile = source("../pages/profile/index.vue");
const profileInfo = source("../pages-account/profile/info.vue");

describe("miniapp visual system", () => {
  it("centers native button labels and removes the platform pseudo border", () => {
    expect(app).toMatch(/button,\s*uni-button\s*\{[\s\S]*display: flex !important;/u);
    expect(app).toMatch(/button,\s*uni-button\s*\{[\s\S]*align-items: center;/u);
    expect(app).toMatch(/button,\s*uni-button\s*\{[\s\S]*justify-content: center;/u);
    expect(app).toMatch(/button::after,\s*uni-button::after\s*\{[\s\S]*border: 0 !important;/u);
  });

  it("preserves flex navigation rows through the H5 wrapper element", () => {
    expect(app).toMatch(
      /uni-navigator > \.navigator-wrap\s*\{[\s\S]*display: flex;[\s\S]*gap: inherit;/u,
    );
  });

  it("uses restrained surfaces instead of decorative gradients on primary content pages", () => {
    for (const page of [home, community, contact]) {
      expect(page).not.toContain("bg-gradient-to-r");
    }
  });

  it("keeps unavailable and incomplete states neutral instead of yellow", () => {
    for (const page of [petList, petDetail, petForm]) {
      expect(page).not.toContain("bg-warning-soft");
    }

    expect(profile).not.toContain("text-warning");
    expect(profileInfo).not.toContain("text-warning");
  });

  it("uses the shared palette for native confirmations and controls", () => {
    for (const page of [petDetail, petForm]) {
      expect(page).toContain("miniappDesignTokens.colors.danger");
      expect(page).not.toMatch(/#(?:4a6cf7|f04438)/iu);
    }

    expect(petList).toContain("PcButton");
    expect(petList).not.toMatch(/#(?:4a6cf7|f04438)/iu);
    expect(petForm).toContain(':color="miniappDesignTokens.colors.brand"');
  });
});
