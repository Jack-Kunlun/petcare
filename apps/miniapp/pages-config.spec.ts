import { describe, expect, it } from "vitest";
import pagesConfig from "./pages.config";

const expectedSubPages = [
  "pages-account/pets/index",
  "pages-account/pets/form",
  "pages-account/pets/detail",
  "pages-account/profile/info",
  "pages-account/profile/edit",
  "pages-account/account/cancel",
  "pages-content/classroom/article",
  "pages-content/community/article",
  "pages-content/community/publish",
  "pages-content/help/index",
  "pages-content/contact/index",
  "pages-content/legal/index",
] as const;

describe("miniapp page contract", () => {
  it("does not reserve a native tab bar behind the custom root layout", () => {
    expect(pagesConfig.tabBar).toBeUndefined();
  });

  it("registers all subpackage pages exactly once", () => {
    const actual = (pagesConfig.subPackages ?? []).flatMap(({ root, pages }) =>
      pages.map(({ path }) => `${root}/${path}`),
    );

    expect(actual).toEqual(expectedSubPages);
    expect(new Set(actual).size).toBe(expectedSubPages.length);
  });

  it("does not register paused commercial route groups", () => {
    const registered = JSON.stringify(pagesConfig.subPackages ?? []);

    expect(registered).not.toContain("pages-bounty");
    expect(registered).not.toContain("pages-care");
    expect(registered).not.toContain("wallet");
    expect(registered).not.toContain("coupons");
  });
});
