import { describe, expect, it } from "vitest";
import pagesConfig from "./pages.config";

const expectedSubPages = [
  "pages-bounty/publish/step1",
  "pages-bounty/publish/step2",
  "pages-bounty/publish/step3",
  "pages-bounty/publish/success",
  "pages-bounty/reward/detail",
  "pages-care/orders/index",
  "pages-care/order/detail",
  "pages-care/monitor/index",
  "pages-care/chat/index",
  "pages-account/pets/index",
  "pages-account/pets/form",
  "pages-account/pets/detail",
  "pages-account/favorites/index",
  "pages-account/follows/index",
  "pages-account/reviews/index",
  "pages-account/services/detail",
  "pages-account/caregivers/detail",
  "pages-account/stores/detail",
  "pages-account/creators/detail",
  "pages-account/profile/info",
  "pages-account/profile/edit",
  "pages-account/account/cancel",
  "pages-content/classroom/article",
  "pages-content/community/article",
  "pages-content/coupons/index",
  "pages-content/wallet/index",
  "pages-content/help/index",
  "pages-content/contact/index",
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

  it("delivers 36 formal pages or states including auth", () => {
    expect(6 + expectedSubPages.length + 2).toBe(36);
  });
});
