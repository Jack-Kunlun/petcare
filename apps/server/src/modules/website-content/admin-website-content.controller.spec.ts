import { GUARDS_METADATA, HTTP_CODE_METADATA } from "@nestjs/common/constants";
import { SwaggerModule } from "@nestjs/swagger";
import { Test } from "@nestjs/testing";
import { AccessTokenGuard } from "../../auth/access-token.guard";
import { PERMISSIONS_METADATA_KEY } from "../../auth/permissions.decorator";
import { AdminWebsiteContentController } from "./admin-website-content.controller";
import { WebsiteContentDiffService } from "./website-content-diff.service";
import { WebsiteContentDraftService } from "./website-content-draft.service";
import { WebsiteContentHistoryService } from "./website-content-history.service";
import { WebsiteContentPermissionGuard } from "./website-content-permission.guard";
import { WebsiteContentPublishingService } from "./website-content-publishing.service";
import { WebsiteContentRepository } from "./website-content.repository";
import { WebsiteMediaService } from "./website-media.service";
import { WebsitePreviewService } from "./website-preview.service";

jest.mock("./media/website-media-file", () => ({
  validateWebsiteMediaFile: jest.fn().mockResolvedValue({
    mimeType: "image/png",
    extension: "png",
    sizeBytes: 5,
    width: 32,
    height: 32,
    checksum: "checksum",
  }),
}));

function createController() {
  const repository = {
    getOverview: jest.fn().mockResolvedValue([]),
    getCurrentDraft: jest.fn().mockResolvedValue({ id: "draft-1" }),
  };
  const drafts = { saveDraft: jest.fn().mockResolvedValue({ id: "draft-2" }) };
  const diffs = { diffDraftFromPublished: jest.fn().mockResolvedValue([]) };
  const history = {
    listHistory: jest.fn().mockResolvedValue({ list: [], total: 0, page: 1, pageSize: 20 }),
    getHistoryVersion: jest.fn().mockResolvedValue({ id: "published-1" }),
    restoreAsDraft: jest.fn().mockResolvedValue({ id: "draft-3" }),
  };
  const publishing = { publish: jest.fn().mockResolvedValue({}) };
  const previews = { createPreview: jest.fn().mockResolvedValue({}) };
  const media = {
    list: jest.fn().mockResolvedValue({ list: [], total: 0, page: 1, pageSize: 20 }),
    upload: jest.fn().mockResolvedValue({ id: "asset-1" }),
    archive: jest.fn().mockResolvedValue(undefined),
  };

  return {
    controller: new AdminWebsiteContentController(
      repository as never,
      drafts as never,
      diffs as never,
      history as never,
      publishing as never,
      previews as never,
      media as never,
    ),
    repository,
    drafts,
    diffs,
    history,
    publishing,
    previews,
    media,
  };
}

describe("AdminWebsiteContentController", () => {
  const request = { user: { sub: "operator-1" }, requestId: "request-1" } as never;

  it("declares the fixed admin route, guards, and separated permissions", () => {
    const guards = Reflect.getMetadata(GUARDS_METADATA, AdminWebsiteContentController) as unknown[];
    const permissions = (method: keyof AdminWebsiteContentController) =>
      Reflect.getMetadata(
        PERMISSIONS_METADATA_KEY,
        AdminWebsiteContentController.prototype[method],
      );

    expect(Reflect.getMetadata("path", AdminWebsiteContentController)).toBe(
      "admin/website-content",
    );
    expect(guards).toEqual([AccessTokenGuard, WebsiteContentPermissionGuard]);

    for (const method of [
      "getOverview",
      "getDraft",
      "getDiff",
      "getHistory",
      "getHistoryVersion",
      "listMedia",
    ] satisfies Array<keyof AdminWebsiteContentController>) {
      expect(permissions(method)).toEqual(["website.read"]);
    }

    for (const method of [
      "saveDraft",
      "createPreview",
      "uploadMedia",
      "archiveMedia",
    ] satisfies Array<keyof AdminWebsiteContentController>) {
      expect(permissions(method)).toEqual(["website.edit_action"]);
    }

    for (const method of ["publish", "restore"] satisfies Array<
      keyof AdminWebsiteContentController
    >) {
      expect(permissions(method)).toEqual(["website.publish_action"]);
      expect(
        Reflect.getMetadata(HTTP_CODE_METADATA, AdminWebsiteContentController.prototype[method]),
      ).toBe(200);
    }
  });

  it("forwards every immutable content command with the authenticated operator and request id", async () => {
    const { controller, repository, drafts, diffs, history, publishing, previews, media } =
      createController();
    const save = {
      revision: 2,
      changeSummary: "Update headline",
      seo: { title: "Home", description: "Home", canonicalPath: "/", image: null },
      sections: [],
    };
    const publish = { revision: 2, idempotencyKey: "publish-1", changeSummary: "Publish" };
    const restore = { versionId: "published-1", revision: 2, changeSummary: "Restore" };
    const historyQuery = { page: 2, pageSize: 10 };
    const mediaQuery = { page: 1, pageSize: 20 };

    await controller.getOverview();
    await controller.getDraft("home");
    await controller.saveDraft("home", save as never, request);
    await controller.getDiff("home");
    await controller.getHistory("home", historyQuery);
    await controller.getHistoryVersion("home", "published-1");
    await controller.createPreview("home", { revision: 2 }, request);
    await controller.publish("home", publish, request);
    await controller.restore("home", restore, request);
    await controller.listMedia(mediaQuery);
    await controller.archiveMedia("asset-1", request);

    expect(repository.getOverview).toHaveBeenCalledWith();
    expect(repository.getCurrentDraft).toHaveBeenCalledWith("home");
    expect(drafts.saveDraft).toHaveBeenCalledWith({
      ...save,
      contentKey: "home",
      operatorId: "operator-1",
      requestId: "request-1",
    });
    expect(diffs.diffDraftFromPublished).toHaveBeenCalledWith("home");
    expect(history.listHistory).toHaveBeenCalledWith("home", historyQuery);
    expect(history.getHistoryVersion).toHaveBeenCalledWith("home", "published-1");
    expect(previews.createPreview).toHaveBeenCalledWith({
      contentKey: "home",
      revision: 2,
      operatorId: "operator-1",
      requestId: "request-1",
    });
    expect(publishing.publish).toHaveBeenCalledWith({
      ...publish,
      contentKey: "home",
      operatorId: "operator-1",
      requestId: "request-1",
    });
    expect(history.restoreAsDraft).toHaveBeenCalledWith({
      ...restore,
      contentKey: "home",
      operatorId: "operator-1",
      requestId: "request-1",
    });
    expect(media.list).toHaveBeenCalledWith(mediaQuery);
    expect(media.archive).toHaveBeenCalledWith("asset-1", "operator-1", "request-1");
  });

  it("validates the multipart image bytes before forwarding the fixed file field", async () => {
    const { controller, media } = createController();
    const file: { buffer: Buffer; originalname: string; mimetype: string } = {
      buffer: Buffer.from("image"),
      originalname: "hero.png",
      mimetype: "image/png",
    };

    await controller.uploadMedia(file as never, request);

    expect(media.upload).toHaveBeenCalledWith(
      {
        buffer: file.buffer,
        originalName: "hero.png",
        mimeType: "image/png",
        operatorId: "operator-1",
      },
      expect.objectContaining({ mimeType: "image/png" }),
    );
  });

  it("documents all fixed Admin routes and the multipart file field", async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [AdminWebsiteContentController],
      providers: [
        { provide: WebsiteContentRepository, useValue: {} },
        { provide: WebsiteContentDraftService, useValue: {} },
        { provide: WebsiteContentDiffService, useValue: {} },
        { provide: WebsiteContentHistoryService, useValue: {} },
        { provide: WebsiteContentPublishingService, useValue: {} },
        { provide: WebsitePreviewService, useValue: {} },
        { provide: WebsiteMediaService, useValue: {} },
      ],
    })
      .overrideGuard(AccessTokenGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(WebsiteContentPermissionGuard)
      .useValue({ canActivate: () => true })
      .compile();
    const app = moduleRef.createNestApplication();

    await app.init();
    const document = SwaggerModule.createDocument(app, {
      openapi: "3.0.0",
      info: { title: "test", version: "1" },
    });

    expect(Object.keys(document.paths)).toEqual(
      expect.arrayContaining([
        "/admin/website-content",
        "/admin/website-content/{contentKey}/draft",
        "/admin/website-content/{contentKey}/diff",
        "/admin/website-content/{contentKey}/history",
        "/admin/website-content/{contentKey}/history/{versionId}",
        "/admin/website-content/{contentKey}/previews",
        "/admin/website-content/{contentKey}/publish",
        "/admin/website-content/{contentKey}/restore",
        "/admin/website-content/media-assets",
        "/admin/website-content/media-assets/{assetId}/archive",
      ]),
    );
    expect(document.paths["/admin/website-content/media-assets"]?.post?.requestBody).toMatchObject({
      content: {
        "multipart/form-data": {
          schema: { required: ["file"] },
        },
      },
    });

    await app.close();
  });
});
