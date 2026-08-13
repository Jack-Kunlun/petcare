import { GUARDS_METADATA } from "@nestjs/common/constants";
import { SwaggerModule } from "@nestjs/swagger";
import { Test } from "@nestjs/testing";
import { ContentService } from "./content.service";
import { PublicContentController } from "./public-content.controller";

describe("PublicContentController", () => {
  it("exposes unauthenticated published article list and detail routes", () => {
    expect(Reflect.getMetadata("path", PublicContentController)).toBe("content/articles");
    expect(Reflect.getMetadata(GUARDS_METADATA, PublicContentController)).toBeUndefined();
  });

  it("delegates article listing and stable id slug lookup to the public service seams", async () => {
    const contentService = {
      findPublishedArticlePage: jest
        .fn()
        .mockResolvedValue({ list: [], total: 0, page: 1, pageSize: 20 }),
      findPublishedArticleBySlug: jest.fn().mockResolvedValue({ slug: "article-1" }),
    };
    const controller = new PublicContentController(contentService as never);

    await expect(controller.findArticles({ page: 2, pageSize: 10 })).resolves.toMatchObject({
      page: 1,
    });
    await expect(controller.findArticle("article-1")).resolves.toEqual({ slug: "article-1" });

    expect(contentService.findPublishedArticlePage).toHaveBeenCalledWith({ page: 2, pageSize: 10 });
    expect(contentService.findPublishedArticleBySlug).toHaveBeenCalledWith("article-1");
  });

  it("documents public list and detail responses without admin authentication", async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [PublicContentController],
      providers: [{ provide: ContentService, useValue: {} }],
    }).compile();
    const app = moduleRef.createNestApplication();

    await app.init();
    const document = SwaggerModule.createDocument(app, {
      openapi: "3.0.0",
      info: { title: "test", version: "1" },
    });

    expect(document.paths["/content/articles"]?.get?.responses).toHaveProperty("200");
    expect(document.paths["/content/articles/{slug}"]?.get?.responses).toHaveProperty("200");
    expect(document.paths["/content/articles/{slug}"]?.get?.responses).toHaveProperty("404");

    await app.close();
  });
});
