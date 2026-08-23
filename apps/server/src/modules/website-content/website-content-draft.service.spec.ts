import { WEBSITE_CONTENT_ERROR_CODE, WEBSITE_CONTENT_KEY } from "@petcare/shared-types";
import { WEBSITE_CONTENT_SEED_TEMPLATES } from "../../seed/seed-website-content";
import { WebsiteContentDraftService } from "./website-content-draft.service";
import { WebsitePageTemplateRegistry } from "./website-page-template.registry";
import { WebsiteSectionTypeRegistry } from "./website-section-type.registry";

describe("WebsiteContentDraftService", () => {
  it("returns a current-template editing projection for a legacy home draft", async () => {
    const template = WEBSITE_CONTENT_SEED_TEMPLATES.find(
      ({ contentKey }) => contentKey === WEBSITE_CONTENT_KEY.HOME,
    )!;
    const legacySections = structuredClone(template.sections).filter(
      (section) => section.sectionKey !== "home_experience",
    );
    const legacyCta = legacySections.find((section) => section.sectionKey === "home_cta");

    if (!legacyCta) {
      throw new Error("Home CTA seed section is required for this test");
    }

    legacyCta.sortOrder = 4;

    const repository = {
      getCurrentDraft: jest.fn(async () => ({
        id: "draft-home-2",
        contentKey: WEBSITE_CONTENT_KEY.HOME,
        sections: legacySections,
      })),
    };
    const service = new WebsiteContentDraftService(
      repository as never,
      new WebsitePageTemplateRegistry(new WebsiteSectionTypeRegistry()),
      new WebsiteSectionTypeRegistry(),
    );

    await expect(service.getDraft(WEBSITE_CONTENT_KEY.HOME)).resolves.toMatchObject({
      id: "draft-home-2",
      sections: expect.arrayContaining([
        expect.objectContaining({ sectionKey: "home_experience", sortOrder: 4 }),
        expect.objectContaining({ sectionKey: "home_cta", sortOrder: 5 }),
      ]),
    });
  });

  it("creates a new immutable draft and never changes the published pointer", async () => {
    const sections = structuredClone(
      WEBSITE_CONTENT_SEED_TEMPLATES.find(
        ({ contentKey }) => contentKey === WEBSITE_CONTENT_KEY.HOME,
      )!.sections,
    );
    const repository = {
      saveDraft: jest.fn(async () => ({ id: "draft-3", revision: 3 })),
    };
    const service = new WebsiteContentDraftService(
      repository as never,
      new WebsitePageTemplateRegistry(new WebsiteSectionTypeRegistry()),
      new WebsiteSectionTypeRegistry(),
    );

    await expect(
      service.saveDraft({
        contentKey: WEBSITE_CONTENT_KEY.HOME,
        revision: 2,
        changeSummary: "更新首页标题",
        seo: {
          title: "首页",
          description: "首页描述",
          canonicalPath: "/",
          image: null,
        },
        sections,
        operatorId: "admin-1",
        requestId: "request-1",
      }),
    ).resolves.toMatchObject({ id: "draft-3", revision: 3 });
    expect(repository.saveDraft).toHaveBeenCalledWith(
      expect.objectContaining({ revision: 2, contentKey: WEBSITE_CONTENT_KEY.HOME }),
      expect.any(Array),
    );
  });

  it("persists the current template when a legacy client saves an old home snapshot", async () => {
    const template = WEBSITE_CONTENT_SEED_TEMPLATES.find(
      ({ contentKey }) => contentKey === WEBSITE_CONTENT_KEY.HOME,
    )!;
    const sections = structuredClone(template.sections).filter(
      (section) => section.sectionKey !== "home_experience",
    );
    const homeCta = sections.find((section) => section.sectionKey === "home_cta");

    if (!homeCta) {
      throw new Error("Home CTA seed section is required for this test");
    }

    homeCta.sortOrder = 4;

    const repository = { saveDraft: jest.fn(async () => ({ id: "draft-3", revision: 3 })) };
    const service = new WebsiteContentDraftService(
      repository as never,
      new WebsitePageTemplateRegistry(new WebsiteSectionTypeRegistry()),
      new WebsiteSectionTypeRegistry(),
    );

    await service.saveDraft({
      contentKey: WEBSITE_CONTENT_KEY.HOME,
      revision: 2,
      changeSummary: "更新旧版首页",
      seo: structuredClone(template.seo),
      sections,
      operatorId: "admin-1",
      requestId: "request-legacy",
    });

    expect(repository.saveDraft).toHaveBeenCalledWith(
      expect.objectContaining({
        sections: expect.arrayContaining([
          expect.objectContaining({ sectionKey: "home_experience", sortOrder: 4 }),
          expect.objectContaining({ sectionKey: "home_cta", sortOrder: 5 }),
        ]),
      }),
      expect.any(Array),
    );
  });

  it("rejects stale revisions with a stable conflict code", async () => {
    const repository = {
      saveDraft: jest.fn(async () => {
        const error = new Error("conflict") as Error & { code: string };

        error.code = WEBSITE_CONTENT_ERROR_CODE.REVISION_CONFLICT;
        throw error;
      }),
    };
    const service = new WebsiteContentDraftService(
      repository as never,
      new WebsitePageTemplateRegistry(new WebsiteSectionTypeRegistry()),
      new WebsiteSectionTypeRegistry(),
    );
    const template = WEBSITE_CONTENT_SEED_TEMPLATES.find(
      ({ contentKey }) => contentKey === WEBSITE_CONTENT_KEY.HOME,
    )!;

    await expect(
      service.saveDraft({
        contentKey: WEBSITE_CONTENT_KEY.HOME,
        revision: 1,
        changeSummary: "冲突保存",
        seo: template.seo,
        sections: structuredClone(template.sections),
        operatorId: "admin-1",
        requestId: "request-2",
      }),
    ).rejects.toMatchObject({ code: WEBSITE_CONTENT_ERROR_CODE.REVISION_CONFLICT });
  });
});
