import { type INestApplication, HttpStatus } from "@nestjs/common";
import { GUARDS_METADATA, HTTP_CODE_METADATA } from "@nestjs/common/constants";
import { SwaggerModule } from "@nestjs/swagger";
import { Test } from "@nestjs/testing";
import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";
import supertest from "supertest";
import { AccessTokenGuard } from "../../auth/access-token.guard";
import { AuthService } from "../../auth/auth.service";
import { PermissionGuard } from "../../auth/permission.guard";
import { PERMISSIONS_METADATA_KEY } from "../../auth/permissions.decorator";
import { AdminSystemSettingsController } from "./admin-system-settings.controller";
import { SaveFeeConfigDraftDto, SaveSopConfigDraftDto } from "./dto/system-settings.dto";
import { ConfigPublishingService } from "./publishing/config-publishing.service";
import { SystemSettingsOverviewService } from "./system-settings-overview.service";

const validSopConfig = {
  steps: Array.from({ length: 5 }, (_, index) => ({
    stepNumber: index + 1,
    stepName: `步骤${index + 1}`,
    instruction: `这是第${index + 1}步的完整执行说明，确保服务过程安全规范。`,
    expectedDurationMinutes: 10,
    minimumPhotoCount: 1,
    videoRequired: false,
  })),
  violationRules: [
    {
      severity: "minor",
      description: "未按要求上传完整服务记录时，应由管理员复核并给出处理指引。",
      serviceFeeDeductionBps: 0,
      ratingDeductionScore: 0,
      suspensionDays: 0,
      retrainingRequired: false,
      sortOrder: 1,
    },
  ],
};

function feeDto(withdrawalFeeBps: number) {
  return plainToInstance(SaveFeeConfigDraftDto, {
    revision: 0,
    changeSummary: "调整提现手续费边界",
    config: {
      platformCommissionBps: 1000,
      rewardServiceFeeCents: 200,
      withdrawalFeeBps,
      minimumWithdrawalFeeCents: 100,
    },
  });
}

describe("AdminSystemSettingsController", () => {
  it("allows system.view reads but rejects publishing without system.publish", async () => {
    const authorization = {
      getCurrentUserAuthorization: jest.fn().mockResolvedValue({
        roles: ["settings_reader"],
        permissions: ["system.view"],
      }),
    };
    const overview = { getOverview: jest.fn().mockResolvedValue({}) };

    let app: INestApplication | undefined;
    const moduleRef = await Test.createTestingModule({
      controllers: [AdminSystemSettingsController],
      providers: [
        { provide: ConfigPublishingService, useValue: {} },
        { provide: SystemSettingsOverviewService, useValue: overview },
        { provide: AuthService, useValue: authorization },
        PermissionGuard,
      ],
    })
      .overrideGuard(AccessTokenGuard)
      .useValue({
        canActivate(context: { switchToHttp(): { getRequest(): { user?: { sub: string } } } }) {
          context.switchToHttp().getRequest().user = { sub: "settings-reader" };

          return true;
        },
      })
      .compile();

    try {
      app = moduleRef.createNestApplication();
      await app.init();

      await supertest(app.getHttpServer())
        .get("/admin/system-settings/overview")
        .expect(HttpStatus.OK);
      await supertest(app.getHttpServer())
        .post("/admin/system-settings/fee/publish")
        .send({})
        .expect(HttpStatus.FORBIDDEN);
    } finally {
      await app?.close();
    }
  });

  it("拒绝 DTO 中的小数、越界值、空摘要和嵌套非法步骤", async () => {
    const fee = plainToInstance(SaveFeeConfigDraftDto, {
      revision: 0,
      changeSummary: "   ",
      config: {
        platformCommissionBps: 5000.5,
        rewardServiceFeeCents: -1,
        withdrawalFeeBps: 100,
        minimumWithdrawalFeeCents: 100,
      },
    });
    const sop = plainToInstance(SaveSopConfigDraftDto, {
      revision: 0,
      changeSummary: "更新服务流程",
      config: {
        ...validSopConfig,
        steps: [{ ...validSopConfig.steps[0], stepNumber: 1.5 }],
      },
    });
    const incompleteRule = plainToInstance(SaveSopConfigDraftDto, {
      revision: 0,
      changeSummary: "更新违规规则",
      config: {
        ...validSopConfig,
        violationRules: [
          {
            ...validSopConfig.violationRules[0],
            serviceFeeDeductionBps: undefined,
          },
        ],
      },
    });

    expect(await validate(fee)).not.toHaveLength(0);
    expect(await validate(sop)).not.toHaveLength(0);
    expect(await validate(incompleteRule)).not.toHaveLength(0);
  });

  it("费用 DTO 接受一千万分比提现手续费并拒绝一千零一", async () => {
    expect(await validate(feeDto(1000))).toHaveLength(0);
    expect(await validate(feeDto(1001))).not.toHaveLength(0);
  });

  it("使用访问令牌和权限点守卫，并为发布与恢复叠加发布权限", () => {
    const guards = Reflect.getMetadata(GUARDS_METADATA, AdminSystemSettingsController) as unknown[];
    const permissions = (method: keyof AdminSystemSettingsController) =>
      Reflect.getMetadata(
        PERMISSIONS_METADATA_KEY,
        AdminSystemSettingsController.prototype[method],
      );

    expect(guards).toEqual([AccessTokenGuard, PermissionGuard]);
    expect(permissions("getFeeCurrent")).toEqual(["system.view"]);
    expect(permissions("saveFeeDraft")).toEqual(["system.fee_config"]);
    expect(permissions("publishFeeDraft")).toEqual(["system.fee_config", "system.publish"]);
    expect(permissions("restoreFeeDraft")).toEqual(["system.fee_config", "system.publish"]);

    const readMethods: Array<keyof AdminSystemSettingsController> = [
      "getOverview",
      "getSopCurrent",
      "getSopDraft",
      "getSopDiff",
      "getSopHistory",
      "getSopVersion",
      "getRatingThresholdCurrent",
      "getRatingThresholdDraft",
      "getRatingThresholdDiff",
      "getRatingThresholdHistory",
      "getRatingThresholdVersion",
      "getFeeCurrent",
      "getFeeDraft",
      "getFeeDiff",
      "getFeeHistory",
      "getFeeVersion",
    ];

    expect(readMethods.map((method) => permissions(method))).toEqual(
      readMethods.map(() => ["system.view"]),
    );
    expect(permissions("saveSopDraft")).toEqual(["system.sop_config"]);
    expect(permissions("publishSopDraft")).toEqual(["system.sop_config", "system.publish"]);
    expect(permissions("restoreSopDraft")).toEqual(["system.sop_config", "system.publish"]);
    expect(permissions("saveRatingThresholdDraft")).toEqual(["system.threshold_config"]);
    expect(permissions("publishRatingThresholdDraft")).toEqual([
      "system.threshold_config",
      "system.publish",
    ]);
    expect(permissions("restoreRatingThresholdDraft")).toEqual([
      "system.threshold_config",
      "system.publish",
    ]);

    for (const method of [
      "publishSopDraft",
      "restoreSopDraft",
      "publishRatingThresholdDraft",
      "restoreRatingThresholdDraft",
      "publishFeeDraft",
      "restoreFeeDraft",
    ] satisfies Array<keyof AdminSystemSettingsController>) {
      expect(
        Reflect.getMetadata(HTTP_CODE_METADATA, AdminSystemSettingsController.prototype[method]),
      ).toBe(200);
    }
  });

  it("全部领域路由调用正确稳定配置键", async () => {
    const publishing = {
      getDraft: jest.fn().mockResolvedValue({ id: "draft-1" }),
      getDiff: jest.fn().mockResolvedValue([]),
      listHistory: jest.fn().mockResolvedValue({ list: [], total: 0, page: 1, pageSize: 20 }),
      getVersion: jest.fn().mockResolvedValue({ id: "version-1" }),
      saveDraft: jest.fn().mockResolvedValue({ id: "draft-1" }),
      publish: jest.fn().mockResolvedValue({ id: "version-1" }),
      restoreAsDraft: jest.fn().mockResolvedValue({ id: "draft-2" }),
    };
    const overview = {
      getCurrent: jest.fn().mockResolvedValue({ id: "version-1" }),
      getOverview: jest.fn().mockResolvedValue({}),
    };
    const controller = new AdminSystemSettingsController(publishing as never, overview as never);
    const request = { user: { sub: "admin-1" } } as never;
    const query = { page: 2, pageSize: 5 };
    const publish = { revision: 1, idempotencyKey: "publish-request-1" };
    const restore = { version: 1, revision: 0, changeSummary: "恢复历史版本" };

    await controller.getOverview();
    await controller.getSopCurrent("walking");
    await controller.getSopDraft("walking");
    await controller.getSopDiff("walking");
    await controller.getSopHistory("walking", query);
    await controller.getSopVersion("walking", "sop-walking-v1");
    await controller.saveSopDraft("walking", {} as never, request);
    await controller.publishSopDraft("walking", publish, request);
    await controller.restoreSopDraft("walking", restore, request);
    await controller.getRatingThresholdCurrent();
    await controller.getRatingThresholdDraft();
    await controller.getRatingThresholdDiff();
    await controller.getRatingThresholdHistory(query);
    await controller.getRatingThresholdVersion("rating-v1");
    await controller.saveRatingThresholdDraft({} as never, request);
    await controller.publishRatingThresholdDraft(publish, request);
    await controller.restoreRatingThresholdDraft(restore, request);
    await controller.getFeeCurrent();
    await controller.getFeeDraft();
    await controller.getFeeDiff();
    await controller.getFeeHistory(query);
    await controller.getFeeVersion("fee-v1");
    await controller.saveFeeDraft({} as never, request);
    await controller.publishFeeDraft(publish, request);
    await controller.restoreFeeDraft(restore, request);

    expect(overview.getOverview).toHaveBeenCalled();
    expect(overview.getCurrent.mock.calls.map(([domain]) => domain)).toEqual([
      "sop:walking",
      "rating_threshold",
      "fee",
    ]);
    expect(publishing.getDraft.mock.calls.map(([domain]) => domain)).toEqual([
      "sop:walking",
      "rating_threshold",
      "fee",
    ]);
    expect(publishing.getDiff.mock.calls.map(([domain]) => domain)).toEqual([
      "sop:walking",
      "rating_threshold",
      "fee",
    ]);
    expect(publishing.listHistory.mock.calls).toEqual([
      ["sop:walking", 2, 5],
      ["rating_threshold", 2, 5],
      ["fee", 2, 5],
    ]);
    expect(publishing.getVersion.mock.calls).toEqual([
      ["sop:walking", "sop-walking-v1"],
      ["rating_threshold", "rating-v1"],
      ["fee", "fee-v1"],
    ]);
    expect(publishing.saveDraft.mock.calls.map(([domain]) => domain)).toEqual([
      "sop:walking",
      "rating_threshold",
      "fee",
    ]);
    expect(publishing.publish.mock.calls).toEqual([
      ["sop:walking", { ...publish, actorId: "admin-1" }],
      ["rating_threshold", { ...publish, actorId: "admin-1" }],
      ["fee", { ...publish, actorId: "admin-1" }],
    ]);
    expect(publishing.restoreAsDraft.mock.calls.map(([domain]) => domain)).toEqual([
      "sop:walking",
      "rating_threshold",
      "fee",
    ]);
  });

  it("Swagger 生成全部路由、明确成功 DTO、标准错误和固定分页 schema", async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [AdminSystemSettingsController],
      providers: [
        { provide: ConfigPublishingService, useValue: {} },
        { provide: SystemSettingsOverviewService, useValue: {} },
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

    expect(Object.keys(document.paths)).toHaveLength(22);
    expect(Object.keys(document.paths)).toEqual(
      expect.arrayContaining([
        "/admin/system-settings/overview",
        "/admin/system-settings/sop/{serviceType}/current",
        "/admin/system-settings/sop/{serviceType}/draft",
        "/admin/system-settings/sop/{serviceType}/diff",
        "/admin/system-settings/sop/{serviceType}/history",
        "/admin/system-settings/sop/{serviceType}/history/{versionId}",
        "/admin/system-settings/sop/{serviceType}/publish",
        "/admin/system-settings/sop/{serviceType}/restore",
        "/admin/system-settings/rating-threshold/current",
        "/admin/system-settings/rating-threshold/history",
        "/admin/system-settings/rating-threshold/history/{versionId}",
        "/admin/system-settings/fee/current",
        "/admin/system-settings/fee/history",
        "/admin/system-settings/fee/history/{versionId}",
      ]),
    );

    const operations = Object.values(document.paths).flatMap((path) =>
      Object.values(path ?? {}).filter(
        (operation) => operation && typeof operation === "object" && "responses" in operation,
      ),
    );

    expect(operations).toHaveLength(25);

    for (const operation of operations) {
      expect(operation.responses).toHaveProperty("200");
      expect(operation.responses).toHaveProperty("401");
      expect(operation.responses).toHaveProperty("403");
      expect(operation.responses["200"]).toHaveProperty("content.application/json.schema");
    }

    expect(
      document.paths["/admin/system-settings/sop/{serviceType}/history/{versionId}"]?.get
        ?.responses?.["200"],
    ).toHaveProperty(
      "content.application/json.schema.allOf.1.properties.data.$ref",
      "#/components/schemas/SopConfigVersionResponseDto",
    );
    expect(
      document.paths["/admin/system-settings/rating-threshold/history/{versionId}"]?.get
        ?.responses?.["200"],
    ).toHaveProperty(
      "content.application/json.schema.allOf.1.properties.data.$ref",
      "#/components/schemas/RatingThresholdVersionResponseDto",
    );
    expect(
      document.paths["/admin/system-settings/fee/history/{versionId}"]?.get?.responses?.["200"],
    ).toHaveProperty(
      "content.application/json.schema.allOf.1.properties.data.$ref",
      "#/components/schemas/FeeConfigVersionResponseDto",
    );

    for (const path of [
      "/admin/system-settings/sop/{serviceType}/current",
      "/admin/system-settings/sop/{serviceType}/draft",
      "/admin/system-settings/sop/{serviceType}/diff",
      "/admin/system-settings/sop/{serviceType}/history",
      "/admin/system-settings/rating-threshold/history",
      "/admin/system-settings/fee/history",
    ]) {
      expect(document.paths[path]?.get?.responses).toHaveProperty("400");
    }

    for (const schemaName of [
      "SopConfigHistoryResponseDto",
      "RatingThresholdHistoryResponseDto",
      "FeeConfigHistoryResponseDto",
    ]) {
      expect(document.components?.schemas?.[schemaName]).toMatchObject({
        properties: {
          list: { type: "array" },
          total: { type: "number" },
          page: { type: "number" },
          pageSize: { type: "number" },
        },
      });
    }

    expect(document.components?.schemas?.FeeConfigDto).toMatchObject({
      properties: {
        withdrawalFeeBps: { minimum: 0, maximum: 1000 },
      },
    });

    await app.close();
  });
});
