import { GUARDS_METADATA, HTTP_CODE_METADATA, MODULE_METADATA } from "@nestjs/common/constants";
import { SwaggerModule } from "@nestjs/swagger";
import { Test } from "@nestjs/testing";
import { AccessTokenGuard } from "../../auth/access-token.guard";
import { AuthService } from "../../auth/auth.service";
import { PermissionGuard } from "../../auth/permission.guard";
import { PERMISSIONS_METADATA_KEY } from "../../auth/permissions.decorator";
import { WebsiteContentModule } from "../website-content/website-content.module";
import { WebsiteMediaService } from "../website-content/website-media.service";
import { AdminContentController } from "./admin-content.controller";
import { ClassroomArticleService } from "./classroom-article.service";
import { ContentModule } from "./content.module";
import { ContentService } from "./content.service";

jest.mock("../website-content/media/website-media-file", () => ({
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
  const contentService = {
    findRewardPage: jest.fn().mockResolvedValue({ list: [], total: 0, page: 1, pageSize: 20 }),
    findPostPage: jest.fn().mockResolvedValue({ list: [], total: 0, page: 1, pageSize: 20 }),
  };
  const articleDetail = {
    id: "article-1",
    title: "文章",
    summary: "摘要",
    coverUrl: null,
    publicUrl: "https://website.example/articles/article-1",
    status: "draft",
    author: null,
    publishedAt: null,
    createdAt: "2026-08-24T00:00:00.000Z",
    updatedAt: "2026-08-24T00:00:00.000Z",
    bodyHtml: "<p>正文</p>",
  };
  const articleService = {
    findArticlePage: jest.fn().mockResolvedValue({ list: [], total: 0, page: 1, pageSize: 20 }),
    findAdminArticle: jest.fn().mockResolvedValue(articleDetail),
    createDraft: jest.fn().mockResolvedValue(articleDetail),
    updateEditable: jest.fn().mockResolvedValue(articleDetail),
    publish: jest.fn().mockResolvedValue(articleDetail),
    offline: jest.fn().mockResolvedValue(articleDetail),
  };
  const media = {
    upload: jest.fn().mockResolvedValue({
      publicAsset: {
        id: "asset-1",
        url: "https://cdn.example/article.png",
        width: 32,
        height: 32,
        mimeType: "image/png",
      },
    }),
  };

  return {
    controller: new AdminContentController(
      contentService as never,
      articleService as never,
      media as never,
    ),
    contentService,
    articleService,
    media,
    articleDetail,
  };
}

describe("AdminContentController", () => {
  it("declares guards and independent read/write/publish permissions for content endpoints", () => {
    const guards = Reflect.getMetadata(GUARDS_METADATA, AdminContentController) as unknown[];
    const permissions = (method: keyof AdminContentController) =>
      Reflect.getMetadata(PERMISSIONS_METADATA_KEY, AdminContentController.prototype[method]);

    expect(Reflect.getMetadata("path", AdminContentController)).toBe("admin/content");
    expect(guards).toEqual([AccessTokenGuard, PermissionGuard]);
    expect(permissions("findRewards")).toEqual(["content.reward.read"]);
    expect(permissions("findPosts")).toEqual(["content.post.read"]);
    expect(permissions("findArticles")).toEqual(["content.article.read"]);
    expect(permissions("findArticle")).toEqual(["content.article.write_action"]);
    expect(permissions("createArticle")).toEqual(["content.article.write_action"]);
    expect(permissions("updateArticle")).toEqual(["content.article.write_action"]);
    expect(permissions("uploadArticleMedia")).toEqual(["content.article.write_action"]);
    expect(permissions("publishArticle")).toEqual(["content.article.publish_action"]);
    expect(permissions("offlineArticle")).toEqual(["content.article.publish_action"]);
    expect(Reflect.getMetadata("path", AdminContentController.prototype.uploadArticleMedia)).toBe(
      "articles/media-assets",
    );
    expect(
      Reflect.getMetadata(HTTP_CODE_METADATA, AdminContentController.prototype.publishArticle),
    ).toBe(200);
    expect(
      Reflect.getMetadata(HTTP_CODE_METADATA, AdminContentController.prototype.offlineArticle),
    ).toBe(200);
  });

  it("delegates article reads and commands to the article service and uses the authenticated operator", async () => {
    const { controller, articleService, articleDetail } = createController();
    const create = { title: "文章", summary: "摘要", bodyHtml: "<p>正文</p>" };
    const update = {
      ...create,
      coverAssetId: null,
      expectedUpdatedAt: "2026-08-24T00:00:00.000Z",
    };
    const state = { expectedUpdatedAt: "2026-08-24T00:00:00.000Z" };
    const request = { user: { sub: "admin-1" } } as never;

    await expect(controller.findArticles({ page: 2, pageSize: 10 })).resolves.toMatchObject({
      page: 1,
    });
    await expect(controller.findArticle("article-1")).resolves.toEqual(articleDetail);
    await expect(controller.createArticle(create, request)).resolves.toEqual(articleDetail);
    await expect(controller.updateArticle("article-1", update)).resolves.toEqual(articleDetail);
    await expect(controller.publishArticle("article-1", state)).resolves.toEqual(articleDetail);
    await expect(controller.offlineArticle("article-1", state)).resolves.toEqual(articleDetail);

    expect(articleService.findArticlePage).toHaveBeenCalledWith({ page: 2, pageSize: 10 });
    expect(articleService.findAdminArticle).toHaveBeenCalledWith("article-1");
    expect(articleService.createDraft).toHaveBeenCalledWith("admin-1", create);
    expect(articleService.updateEditable).toHaveBeenCalledWith("article-1", update);
    expect(articleService.publish).toHaveBeenCalledWith("article-1", state);
    expect(articleService.offline).toHaveBeenCalledWith("article-1", state);
  });

  it("rejects an absent article image and returns only the validated public asset", async () => {
    const { controller, media } = createController();
    const request = { user: { sub: "admin-1" } } as never;
    const file = {
      buffer: Buffer.from("image"),
      originalname: "article.png",
      mimetype: "image/png",
    };

    await expect(controller.uploadArticleMedia(undefined, request)).rejects.toMatchObject({
      code: "WEBSITE_CONTENT_INVALID_MEDIA",
      status: 400,
    });
    await expect(controller.uploadArticleMedia(file, request)).resolves.toEqual({
      id: "asset-1",
      url: "https://cdn.example/article.png",
      width: 32,
      height: 32,
      mimeType: "image/png",
    });
    expect(media.upload).toHaveBeenCalledWith(
      {
        buffer: file.buffer,
        originalName: "article.png",
        mimeType: "image/png",
        operatorId: "admin-1",
      },
      expect.objectContaining({ mimeType: "image/png" }),
    );
  });

  it("documents all content list responses and standard errors", async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [AdminContentController],
      providers: [
        { provide: ContentService, useValue: {} },
        { provide: ClassroomArticleService, useValue: {} },
        { provide: WebsiteMediaService, useValue: {} },
        { provide: AuthService, useValue: {} },
      ],
    })
      .overrideGuard(AccessTokenGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(PermissionGuard)
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
        "/admin/content/rewards",
        "/admin/content/posts",
        "/admin/content/articles",
        "/admin/content/articles/{id}",
        "/admin/content/articles/{id}/publish",
        "/admin/content/articles/{id}/offline",
        "/admin/content/articles/media-assets",
      ]),
    );

    for (const path of [
      "/admin/content/rewards",
      "/admin/content/posts",
      "/admin/content/articles",
    ]) {
      const operation = document.paths[path]?.get;

      expect(operation?.responses).toHaveProperty("200");
      expect(operation?.responses).toHaveProperty("400");
      expect(operation?.responses).toHaveProperty("401");
      expect(operation?.responses).toHaveProperty("403");
      expect(operation?.responses).toHaveProperty("500");
      expect(operation?.responses?.["200"]).toHaveProperty(
        "content.application/json.schema.allOf.1.properties.data.$ref",
      );
    }

    for (const path of [
      "/admin/content/articles/{id}",
      "/admin/content/articles/{id}/publish",
      "/admin/content/articles/{id}/offline",
    ]) {
      const operations = document.paths[path];

      expect(operations).toBeDefined();

      for (const operation of Object.values(operations ?? {})) {
        if (typeof operation !== "object" || operation === null || !("responses" in operation)) {
          continue;
        }

        expect(operation.responses).toHaveProperty("401");
        expect(operation.responses).toHaveProperty("403");
        expect(operation.responses).toHaveProperty("404");
        expect(operation.responses).toHaveProperty("500");
      }
    }

    expect(document.paths["/admin/content/articles/{id}"]?.get?.responses).toHaveProperty("400");

    for (const path of [
      "/admin/content/articles/{id}",
      "/admin/content/articles/{id}/publish",
      "/admin/content/articles/{id}/offline",
    ]) {
      const operations = document.paths[path];
      const writable = operations?.put ?? operations?.post;

      expect(writable?.responses).toHaveProperty("400");

      if (path !== "/admin/content/articles/{id}" || operations?.put) {
        expect(writable?.responses).toHaveProperty("409");
      }
    }

    const upload = document.paths["/admin/content/articles/media-assets"]?.post;

    expect(upload?.requestBody).toMatchObject({
      content: { "multipart/form-data": { schema: { required: ["file"] } } },
    });
    expect(upload?.responses).toHaveProperty("400");
    expect(upload?.responses).toHaveProperty("401");
    expect(upload?.responses).toHaveProperty("403");
    expect(upload?.responses).toHaveProperty("413");
    expect(upload?.responses).toHaveProperty("503");

    await app.close();
  });

  it("imports the existing website media provider instead of registering another one", () => {
    expect(Reflect.getMetadata(MODULE_METADATA.IMPORTS, ContentModule)).toContain(
      WebsiteContentModule,
    );
    expect(Reflect.getMetadata(MODULE_METADATA.PROVIDERS, ContentModule)).toEqual(
      expect.arrayContaining([ContentService, ClassroomArticleService]),
    );
    expect(Reflect.getMetadata(MODULE_METADATA.PROVIDERS, ContentModule)).not.toContain(
      WebsiteMediaService,
    );
  });
});
