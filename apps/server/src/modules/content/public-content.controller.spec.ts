import { GUARDS_METADATA } from "@nestjs/common/constants";
import { SwaggerModule } from "@nestjs/swagger";
import { Test } from "@nestjs/testing";
import { CLASSROOM_ARTICLE_CATEGORY } from "@petcare/shared-types";
import { ClassroomArticleService } from "./classroom-article.service";
import { PublicContentController } from "./public-content.controller";

describe("PublicContentController", () => {
  it("exposes unauthenticated published article list and detail routes", () => {
    expect(Reflect.getMetadata("path", PublicContentController)).toBe("content/articles");
    expect(Reflect.getMetadata(GUARDS_METADATA, PublicContentController)).toBeUndefined();
  });

  it("delegates article listing and stable id slug lookup to the public service seams", async () => {
    const articleService = {
      findPublishedArticlePage: jest
        .fn()
        .mockResolvedValue({ list: [], total: 0, page: 1, pageSize: 20 }),
      findPublishedArticleBySlug: jest
        .fn()
        .mockResolvedValue({ slug: "article-1", bodyHtml: "<p>正文</p>" }),
    };
    const controller = new PublicContentController(articleService as never);

    const query = {
      page: 2,
      pageSize: 10,
      keyword: "喂养",
      category: CLASSROOM_ARTICLE_CATEGORY.FEEDING_GUIDE,
    };

    await expect(controller.findArticles(query)).resolves.toMatchObject({ page: 1 });
    await expect(controller.findArticle("article-1")).resolves.toEqual({
      slug: "article-1",
      bodyHtml: "<p>正文</p>",
    });

    expect(articleService.findPublishedArticlePage).toHaveBeenCalledWith(query);
    expect(articleService.findPublishedArticleBySlug).toHaveBeenCalledWith("article-1");
  });

  it("documents public list and detail responses without admin authentication", async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [PublicContentController],
      providers: [{ provide: ClassroomArticleService, useValue: {} }],
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
