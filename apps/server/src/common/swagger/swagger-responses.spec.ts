import { INestApplication } from "@nestjs/common";
import { DocumentBuilder, OpenAPIObject, SwaggerModule } from "@nestjs/swagger";
import { Test } from "@nestjs/testing";
import { AuthController } from "../../auth/auth.controller";
import { AuthService } from "../../auth/auth.service";
import { CaptchaService } from "../../auth/captcha.service";
import { ConfigService } from "../../config/config.service";
import { HealthController } from "../../health/health.controller";
import { OrderController } from "../../modules/order/order.controller";
import { OrderService } from "../../modules/order/order.service";
import { UserController } from "../../modules/user/user.controller";
import { UserService } from "../../modules/user/user.service";

let app: INestApplication;
let document: OpenAPIObject;

beforeAll(async () => {
  const moduleReference = await Test.createTestingModule({
    controllers: [AuthController, HealthController, UserController, OrderController],
    providers: [
      { provide: AuthService, useValue: {} },
      { provide: CaptchaService, useValue: {} },
      { provide: ConfigService, useValue: {} },
      { provide: UserService, useValue: {} },
      { provide: OrderService, useValue: {} },
    ],
  }).compile();

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
    expect(responseSchema("/health", "get", "200")).toMatchObject({
      allOf: expect.any(Array),
    });
    expect(responseSchema("/users/register", "post", "201")).toMatchObject({
      allOf: expect.any(Array),
    });
    expect(responseSchema("/orders", "get", "200")).toMatchObject({
      allOf: expect.any(Array),
    });
  });

  it("documents the unified order pagination data fields", () => {
    const schema = document.components?.schemas?.OrderListResponseDto as {
      properties?: Record<string, unknown>;
    };

    expect(schema.properties).toMatchObject({
      list: {
        type: "array",
        items: { $ref: "#/components/schemas/OrderResponseDto" },
      },
      total: { type: "number", example: 1 },
      page: { type: "number", example: 1 },
      pageSize: { type: "number", example: 20 },
    });
    expect(schema.properties).not.toHaveProperty("orders");
  });

  it("documents logout and standard errors", () => {
    expect(document.paths["/auth/logout"]?.post?.responses?.["204"]).toBeDefined();
    expect(document.paths["/users/{id}"]?.get?.responses?.["404"]).toBeDefined();
    expect(document.paths["/orders/{id}"]?.get?.responses?.["404"]).toBeDefined();
    expect(document.paths["/auth/login/password"]?.post?.responses?.["401"]).toBeDefined();
  });
});

function responseSchema(path: string, method: "get" | "post", status: string): unknown {
  const response = document.paths[path]?.[method]?.responses?.[status] as
    { content?: Record<string, { schema?: unknown }> } | undefined;

  return response?.content?.["application/json"]?.schema;
}
