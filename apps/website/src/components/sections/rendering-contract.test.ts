import { WEBSITE_SECTION_TYPE } from "@petcare/shared-types";
import { describe, expect, it } from "vitest";
import { assertRenderableSection, SECTION_RENDERER_NAMES } from "./rendering-contract";

describe("Website section rendering contract", () => {
  it("maps every shared section type to one renderer", () => {
    expect(Object.keys(SECTION_RENDERER_NAMES).sort()).toEqual(
      Object.values(WEBSITE_SECTION_TYPE).sort(),
    );
  });

  it("fails closed for unknown types and unsupported schema versions", () => {
    expect(() => assertRenderableSection({ sectionType: "script", schemaVersion: 1 })).toThrow(
      "Unsupported website section type",
    );
    expect(() =>
      assertRenderableSection({ sectionType: WEBSITE_SECTION_TYPE.HERO, schemaVersion: 2 }),
    ).toThrow("Unsupported website section schema version");
  });
});
