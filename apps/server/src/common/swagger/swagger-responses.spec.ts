import { INestApplication } from "@nestjs/common";
import { DocumentBuilder, OpenAPIObject, SwaggerModule } from "@nestjs/swagger";
import { Test } from "@nestjs/testing";
import { AccessTokenGuard } from "../../auth/access-token.guard";
import { AuthController } from "../../auth/auth.controller";
import { AuthService } from "../../auth/auth.service";
import { CaptchaService } from "../../auth/captcha.service";
import { ProfileCompleteGuard } from "../../auth/profile-complete.guard";
import { WechatAuthController } from "../../auth/wechat-auth.controller";
import { WechatAuthService } from "../../auth/wechat-auth.service";
import { ConfigService } from "../../config/config.service";
import { HealthController } from "../../health/health.controller";
import { AdminUserController } from "../../modules/user/admin-user.controller";
import { MiniappAccountController } from "../../modules/user/miniapp-account.controller";
import { MiniappAccountService } from "../../modules/user/miniapp-account.service";
import { UserController } from "../../modules/user/user.controller";
import { UserService } from "../../modules/user/user.service";

let app: INestApplication;
let document: OpenAPIObject;

beforeAll(async () => {
  const moduleReference = await Test.createTestingModule({
    controllers: [
      AuthController,
      WechatAuthController,
      HealthController,
      AdminUserController,
      UserController,
      MiniappAccountController,
    ],
    providers: [
      { provide: AuthService, useValue: {} },
      { provide: CaptchaService, useValue: {} },
      { provide: WechatAuthService, useValue: {} },
      { provide: ConfigService, useValue: {} },
      { provide: UserService, useValue: {} },
      { provide: MiniappAccountService, useValue: {} },
    ],
  })
    .overrideGuard(AccessTokenGuard)
    .useValue({ canActivate: () => true })
    .overrideGuard(ProfileCompleteGuard)
    .useValue({ canActivate: () => true })
    .compile();

  app = moduleReference.createNestApplication();
  document = SwaggerModule.createDocument(
    app,
    new DocumentBuilder().setTitle("Swagger response test").setVersion("1").build(),
  );
});

afterAll(async () => app.close());

describe("Swagger response documentation", () => {
  it("documents concrete success schemas for every route group", () => {
    expect(responseSchema("/auth/captcha", "get", "200")).toMatchObject({
      allOf: expect.any(Array),
    });
    expect(responseSchema("/auth/wechat/login", "post", "200")).toMatchObject({
      allOf: expect.any(Array),
    });
    expect(responseSchema("/health", "get", "200")).toMatchObject({
      allOf: expect.any(Array),
    });
    expect(responseSchema("/admin/users", "get", "200")).toMatchObject({
      allOf: expect.any(Array),
    });
  });

  it("documents only anonymous-safe public user fields", () => {
    expect(schemaPropertyNames("UserResponseDto")).toEqual([
      "avatar",
      "id",
      "nickname",
      "profile",
      "status",
      "userType",
    ]);
    expect(schemaPropertyNames("PublicUserProfileDto")).toEqual(["bio", "region"]);
  });

  it("documents the unified admin user pagination data fields", () => {
    const schema = document.components?.schemas?.AdminUserListResponseDto as {
      properties?: Record<string, unknown>;
    };

    expect(schema.properties).toMatchObject({
      list: {
        type: "array",
        items: { $ref: "#/components/schemas/AdminUserListItemDto" },
      },
      total: { type: "number", example: 120 },
      page: { type: "number", example: 1 },
      pageSize: { type: "number", example: 20 },
    });
  });

  it("documents logout and standard errors", () => {
    expect(document.paths["/auth/logout"]?.post?.responses?.["204"]).toBeDefined();
    expect(document.paths["/users/{id}"]?.get?.responses?.["404"]).toBeDefined();
    expect(document.paths["/auth/login/password"]?.post?.responses?.["401"]).toBeDefined();
    expect(document.paths["/auth/wechat/bind-phone"]).toBeUndefined();
    expect(document.paths["/users/register"]).toBeUndefined();
    expect(document.paths["/auth/wechat/login"]?.post?.responses?.["503"]).toBeDefined();
    expect(document.paths["/auth/wechat/logout"]?.post?.responses?.["204"]).toBeDefined();
    expect(document.paths["/users/me/phone/code"]?.post?.responses?.["503"]).toBeDefined();
    expect(document.paths["/users/me/cancellation/code"]?.post?.responses?.["503"]).toBeDefined();
  });
});

function responseSchema(path: string, method: "get" | "post", status: string): unknown {
  const response = document.paths[path]?.[method]?.responses?.[status] as
    { content?: Record<string, { schema?: unknown }> } | undefined;

  return response?.content?.["application/json"]?.schema;
}

function schemaPropertyNames(schemaName: string): string[] {
  const schema = document.components?.schemas?.[schemaName] as
    { properties?: Record<string, unknown> } | undefined;

  return Object.keys(schema?.properties ?? {}).sort();
}
