import { GUARDS_METADATA } from "@nestjs/common/constants";
import { SwaggerModule } from "@nestjs/swagger";
import { Test } from "@nestjs/testing";
import { AccessTokenGuard } from "../../auth/access-token.guard";
import { AuthService } from "../../auth/auth.service";
import { PermissionGuard } from "../../auth/permission.guard";
import { PERMISSIONS_METADATA_KEY } from "../../auth/permissions.decorator";
import { AdminContentController } from "./admin-content.controller";
import { ContentService } from "./content.service";

describe("AdminContentController", () => {
  it("declares guards and independent read permissions for each content endpoint", () => {
    const guards = Reflect.getMetadata(GUARDS_METADATA, AdminContentController) as unknown[];
    const permissions = (method: keyof AdminContentController) =>
      Reflect.getMetadata(PERMISSIONS_METADATA_KEY, AdminContentController.prototype[method]);

    expect(Reflect.getMetadata("path", AdminContentController)).toBe("admin/content");
    expect(guards).toEqual([AccessTokenGuard, PermissionGuard]);
    expect(permissions("findRewards")).toEqual(["content.reward.read"]);
    expect(permissions("findPosts")).toEqual(["content.post.read"]);
    expect(permissions("findArticles")).toEqual(["content.article.read"]);
  });

  it("documents all content list responses and standard errors", async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [AdminContentController],
      providers: [
        { provide: ContentService, useValue: {} },
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

    await app.close();
  });
});
