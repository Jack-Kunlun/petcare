import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { WechatAuthController } from "../src/auth/wechat-auth.controller";
import { WechatAuthService } from "../src/auth/wechat-auth.service";
import { ApiExceptionFilter } from "../src/common/http/api-exception.filter";
import { ApiResponseInterceptor } from "../src/common/http/api-response.interceptor";
import { RequestIdMiddleware } from "../src/common/http/request-id.middleware";
import { AppLogger } from "../src/logging/app-logger.service";

describe("WechatAuthController (e2e)", () => {
  const wechatAuthService = {
    login: jest.fn(),
    bindPhone: jest.fn(),
    refresh: jest.fn(),
    logout: jest.fn(),
    getCurrentUser: jest.fn(),
  };
  let app: INestApplication;

  beforeAll(async () => {
    const moduleReference = await Test.createTestingModule({
      controllers: [WechatAuthController],
      providers: [Reflector, { provide: WechatAuthService, useValue: wechatAuthService }],
    }).compile();

    app = moduleReference.createNestApplication();
    const requestIdMiddleware = new RequestIdMiddleware();
    const logger = { write: jest.fn() } as unknown as AppLogger;

    app.use(requestIdMiddleware.use.bind(requestIdMiddleware));
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
        forbidNonWhitelisted: true,
      }),
    );
    app.useGlobalInterceptors(new ApiResponseInterceptor(moduleReference.get(Reflector)));
    app.useGlobalFilters(new ApiExceptionFilter(logger));
    await app.init();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    wechatAuthService.login.mockResolvedValue({
      status: "phone_required",
      bindToken: "bind-token",
    });
    wechatAuthService.logout.mockResolvedValue(undefined);
  });

  afterAll(async () => {
    await app.close();
  });

  it("returns the unified envelope for a valid login code", async () => {
    const response = await request(app.getHttpServer())
      .post("/auth/wechat/login")
      .send({ loginCode: "login-code" })
      .expect(200);

    expect(response.body).toEqual({
      code: "SUCCESS",
      message: "操作成功",
      data: { status: "phone_required", bindToken: "bind-token" },
      meta: {
        requestId: expect.any(String),
        timestamp: expect.any(String),
      },
    });
  });

  it.each([
    ["an empty login code", { loginCode: "" }],
    ["a caller-supplied openid", { loginCode: "login-code", openid: "openid-1" }],
  ])("rejects %s", async (_name, body) => {
    const response = await request(app.getHttpServer())
      .post("/auth/wechat/login")
      .send(body)
      .expect(400);

    expect(response.body).toMatchObject({
      code: "VALIDATION_FAILED",
      data: null,
      meta: { requestId: expect.any(String) },
    });
    expect(wechatAuthService.login).not.toHaveBeenCalled();
  });

  it("returns an empty 204 response when logging out", async () => {
    const response = await request(app.getHttpServer())
      .post("/auth/wechat/logout")
      .send({ refreshToken: "refresh-token" })
      .expect(204);

    expect(response.text).toBe("");
    expect(wechatAuthService.logout).toHaveBeenCalledWith("refresh-token");
  });
});
