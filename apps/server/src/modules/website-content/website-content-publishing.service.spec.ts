import {
  WEBSITE_CONTENT_ERROR_CODE,
  WEBSITE_CONTENT_KEY,
  WEBSITE_CONTENT_STATUS,
  type PublishWebsiteContentResponse,
  type WebsiteContentVersion,
} from "@petcare/shared-types";
import { WEBSITE_CONTENT_SEED_TEMPLATES } from "../../seed/seed-website-content";
import { WebsiteContentPublishingService } from "./website-content-publishing.service";
import { WebsitePageTemplateRegistry } from "./website-page-template.registry";
import { WebsiteSectionTypeRegistry } from "./website-section-type.registry";

function version(
  id: string,
  status: WebsiteContentVersion["status"],
  revision: number,
): WebsiteContentVersion {
  const template = WEBSITE_CONTENT_SEED_TEMPLATES.find(
    ({ contentKey }) => contentKey === WEBSITE_CONTENT_KEY.HOME,
  )!;

  return {
    id,
    contentKey: WEBSITE_CONTENT_KEY.HOME,
    revision,
    businessVersion: status === WEBSITE_CONTENT_STATUS.DRAFT ? null : 1,
    status,
    changeSummary: "Publish home",
    seo: structuredClone(template.seo),
    sections: structuredClone(template.sections),
    sourceVersionId: null,
    createdBy: { id: "admin-1", displayName: "Admin" },
    createdAt: "2026-08-13T00:00:00.000Z",
    publishedBy:
      status === WEBSITE_CONTENT_STATUS.DRAFT ? null : { id: "admin-1", displayName: "Admin" },
    publishedAt: status === WEBSITE_CONTENT_STATUS.DRAFT ? null : "2026-08-13T00:01:00.000Z",
  };
}

function createSubject() {
  const draft = version("draft-home-2", WEBSITE_CONTENT_STATUS.DRAFT, 2);
  const result: PublishWebsiteContentResponse = {
    published: version("published-home-2", WEBSITE_CONTENT_STATUS.PUBLISHED, 2),
    draft: version("draft-home-3", WEBSITE_CONTENT_STATUS.DRAFT, 3),
  };
  const repository = {
    getDraftAndPublished: jest.fn(async () => ({ draft, published: null })),
    publishDraft: jest.fn(async () => result),
  };
  const preflight = { verify: jest.fn(async () => new Map()) };
  const cache = { set: jest.fn(async () => true) };
  const logger = { warn: jest.fn() };
  const service = new WebsiteContentPublishingService(
    repository as never,
    new WebsitePageTemplateRegistry(new WebsiteSectionTypeRegistry()),
    new WebsiteSectionTypeRegistry(),
    preflight,
    cache as never,
    logger,
  );

  return { cache, draft, logger, preflight, repository, result, service };
}

describe("WebsiteContentPublishingService", () => {
  it("preflights a saved page snapshot before explicitly publishing only that content key", async () => {
    const { preflight, repository, service, result } = createSubject();

    await expect(
      service.publish({
        contentKey: WEBSITE_CONTENT_KEY.HOME,
        revision: 2,
        idempotencyKey: "publish-home-2",
        changeSummary: "Publish home",
        operatorId: "admin-1",
        requestId: "request-1",
      }),
    ).resolves.toEqual(result);

    expect(preflight.verify).toHaveBeenCalledWith(
      expect.objectContaining({ id: "draft-home-2", revision: 2 }),
      expect.any(Array),
    );
    expect(repository.publishDraft).toHaveBeenCalledWith(
      expect.objectContaining({ contentKey: WEBSITE_CONTENT_KEY.HOME, revision: 2 }),
      expect.any(Array),
    );
  });

  it("does not enter the publish transaction when preflight rejects referenced media", async () => {
    const { preflight, repository, service } = createSubject();

    preflight.verify.mockRejectedValue(new Error("COS object missing"));

    await expect(
      service.publish({
        contentKey: WEBSITE_CONTENT_KEY.HOME,
        revision: 2,
        idempotencyKey: "publish-home-2",
        changeSummary: "Publish home",
        operatorId: "admin-1",
        requestId: "request-1",
      }),
    ).rejects.toThrow("COS object missing");
    expect(repository.publishDraft).not.toHaveBeenCalled();
  });

  it("preserves a stable stale-revision error from the transactional repository", async () => {
    const { repository, service } = createSubject();
    const conflict = new Error("stale revision") as Error & { code: string };

    conflict.code = WEBSITE_CONTENT_ERROR_CODE.REVISION_CONFLICT;
    repository.publishDraft.mockRejectedValue(conflict);

    await expect(
      service.publish({
        contentKey: WEBSITE_CONTENT_KEY.HOME,
        revision: 1,
        idempotencyKey: "publish-home-stale",
        changeSummary: "Publish home",
        operatorId: "admin-1",
        requestId: "request-1",
      }),
    ).rejects.toMatchObject({ code: WEBSITE_CONTENT_ERROR_CODE.REVISION_CONFLICT });
  });

  it("keeps the committed publish successful when cache prewarm fails", async () => {
    const { cache, logger, service, result } = createSubject();

    cache.set.mockRejectedValue(new Error("redis unavailable"));

    await expect(
      service.publish({
        contentKey: WEBSITE_CONTENT_KEY.HOME,
        revision: 2,
        idempotencyKey: "publish-home-2",
        changeSummary: "Publish home",
        operatorId: "admin-1",
        requestId: "request-1",
      }),
    ).resolves.toEqual(result);
    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining("redis unavailable"));
  });
});
