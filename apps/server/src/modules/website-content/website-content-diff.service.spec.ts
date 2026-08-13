import { WebsiteContentDiffService } from "./website-content-diff.service";

describe("WebsiteContentDiffService", () => {
  it("returns stable field-level paths independent of object key order", () => {
    const service = new WebsiteContentDiffService();

    expect(
      service.diff(
        { seo: { title: "旧标题" }, sections: [{ sectionKey: "hero", content: { title: "旧标题" } }] },
        { sections: [{ content: { title: "新标题" }, sectionKey: "hero" }], seo: { title: "新标题" } },
      ),
    ).toEqual([
      expect.objectContaining({ path: "sections.hero.content.title", changeType: "modified" }),
      expect.objectContaining({ path: "seo.title", changeType: "modified" }),
    ]);
  });
});
