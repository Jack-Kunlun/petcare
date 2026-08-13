import { ROUTE_ARGS_METADATA } from "@nestjs/common/constants";
import { SwaggerModule } from "@nestjs/swagger";
import { Test } from "@nestjs/testing";
import { PublicWebsiteContentController } from "./public-website-content.controller";
import { WebsiteContentPublicService } from "./website-content-public.service";
import { WebsitePreviewService } from "./website-preview.service";

describe("PublicWebsiteContentController", () => {
  it("declares the static preview route before the content-key parameter route", () => {
    const methods = Object.getOwnPropertyNames(PublicWebsiteContentController.prototype);

    expect(methods.indexOf("getPreview")).toBeLessThan(methods.indexOf("getPublished"));
    expect(Reflect.getMetadata(ROUTE_ARGS_METADATA, PublicWebsiteContentController, "getPreview")).toBeDefined();
  });

  it("returns only published content for the public fixed route", async () => {
    const content = { contentKey: "home", businessVersion: 1 };
    const published = { getPublished: jest.fn().mockResolvedValue(content) };
    const previews = { readPreview: jest.fn() };
    const controller = new PublicWebsiteContentController(published as never, previews as never);

    await expect(controller.getPublished("home")).resolves.toBe(content);
    expect(published.getPublished).toHaveBeenCalledWith("home");
  });

  it("reads a preview only from the dedicated request header and prevents caching", async () => {
    const version = { contentKey: "home", revision: 2, sections: [], seo: {} };
    const published = { getPublished: jest.fn() };
    const previews = { readPreview: jest.fn().mockResolvedValue(version) };
    const response = { setHeader: jest.fn() };
    const controller = new PublicWebsiteContentController(published as never, previews as never);

    await expect(
      controller.getPreview("home", "preview-token", { requestId: "request-1" } as never, response as never),
    ).resolves.toMatchObject({ contentKey: "home", revision: 2 });

    expect(previews.readPreview).toHaveBeenCalledWith("home", "preview-token", "request-1");
    expect(response.setHeader).toHaveBeenCalledWith("Cache-Control", "private, no-store");
  });

  it("documents published and preview routes separately with the preview token header", async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [PublicWebsiteContentController],
      providers: [
        { provide: WebsiteContentPublicService, useValue: {} },
        { provide: WebsitePreviewService, useValue: {} },
      ],
    }).compile();
    const app = moduleRef.createNestApplication();

    await app.init();
    const document = SwaggerModule.createDocument(app, {
      openapi: "3.0.0",
      info: { title: "test", version: "1" },
    });

    expect(document.paths).toHaveProperty("/website-content/{contentKey}");
    expect(document.paths).toHaveProperty("/website-content/previews/{contentKey}");
    expect(document.paths["/website-content/previews/{contentKey}"]?.get?.parameters).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: "X-Website-Preview-Token",
          in: "header",
          required: true,
        }),
      ]),
    );

    await app.close();
  });
});
