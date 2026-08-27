import { WEBSITE_CONTENT_KEY } from "@petcare/shared-types";
import { describe, expect, it } from "vitest";
import { PAGE_CONTENT_BY_PATH } from "./page-routes";

describe("published page route registry", () => {
  it("owns only the five current personal-version page routes in code", () => {
    expect(PAGE_CONTENT_BY_PATH).toEqual({
      "/": WEBSITE_CONTENT_KEY.HOME,
      "/about": WEBSITE_CONTENT_KEY.ABOUT,
      "/contact": WEBSITE_CONTENT_KEY.CONTACT,
      "/privacy": WEBSITE_CONTENT_KEY.PRIVACY,
      "/terms": WEBSITE_CONTENT_KEY.TERMS,
    });
  });
});
