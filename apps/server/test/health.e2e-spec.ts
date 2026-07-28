import { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { AppModule } from "../src/app.module";

describe("HealthController (e2e)", () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app?.close();
  });

  it("GET /health returns the unified response envelope", async () => {
    const response = await request(app.getHttpServer()).get("/health").expect(200);

    expect(response.body).toEqual({
      code: "SUCCESS",
      message: "操作成功",
      data: { status: "ok" },
      meta: {
        requestId: expect.any(String),
        timestamp: expect.any(String),
      },
    });
    expect(response.headers["x-request-id"]).toBe(response.body.meta.requestId);
    expect(Number.isNaN(Date.parse(response.body.meta.timestamp))).toBe(false);
  });
});
