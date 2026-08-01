import { PrismaClient } from "../generated/prisma/client";
import { seedSystemSettings } from "./seed-system-settings";

interface StoredVersion extends Record<string, unknown> {
  id: string;
  configKey: string;
  status: string;
  businessVersion: number;
  revision: number;
  draftSlot?: string | null;
  idempotencyKey?: string | null;
  changeSummary: string;
  publishedById?: string | null;
  publishedAt?: Date | null;
}

function createFakePrisma() {
  const versions: StoredVersion[] = [];
  const pointers: Array<{ configKey: string; publishedVersionId: string }> = [];
  const sopSteps: Array<Record<string, unknown>> = [];
  const violationRules: Array<Record<string, unknown>> = [];
  const ratingConfigs: Array<Record<string, unknown>> = [];
  const feeConfigs: Array<Record<string, unknown>> = [];
  const auditEvents: Array<Record<string, unknown>> = [];

  const upsertBy = <T extends Record<string, unknown>>(
    values: T[],
    uniqueField: string,
    idPrefix: string,
  ) =>
    jest.fn(async ({ where, update, create }) => {
      const expected = where[uniqueField];
      const existing = values.find((value) => value[uniqueField] === expected);

      if (existing) {
        Object.assign(existing, update);

        return existing;
      }

      const created = { id: `${idPrefix}-${values.length + 1}`, ...create } as T;

      values.push(created);

      return created;
    });

  const prisma = {
    $transaction: jest.fn(async (callback) => callback(prisma)),
    systemConfigVersion: {
      upsert: upsertBy(versions, "idempotencyKey", "version"),
    },
    systemConfigPointer: {
      upsert: upsertBy(pointers as Array<Record<string, unknown>>, "configKey", "pointer"),
    },
    sopConfigStep: {
      upsert: jest.fn(async ({ where, create }) => {
        const key = where.configVersionId_serviceType_stepNumber;
        const existing = sopSteps.find(
          (step) =>
            step.configVersionId === key.configVersionId &&
            step.serviceType === key.serviceType &&
            step.stepNumber === key.stepNumber,
        );

        if (existing) {
          return existing;
        }

        const created = { id: `sop-step-${sopSteps.length + 1}`, ...create };

        sopSteps.push(created);

        return created;
      }),
    },
    sopViolationRule: {
      upsert: jest.fn(async ({ where, create }) => {
        const key = where.configVersionId_severity;
        const existing = violationRules.find(
          (rule) => rule.configVersionId === key.configVersionId && rule.severity === key.severity,
        );

        if (existing) {
          return existing;
        }

        const created = { id: `violation-rule-${violationRules.length + 1}`, ...create };

        violationRules.push(created);

        return created;
      }),
    },
    ratingThresholdConfig: {
      upsert: upsertBy(ratingConfigs, "configVersionId", "rating-config"),
    },
    feeConfig: {
      upsert: upsertBy(feeConfigs, "configVersionId", "fee-config"),
    },
    systemConfigAuditEvent: {
      upsert: jest.fn(async ({ where, create }) => {
        const key = where.configKey_idempotencyKey;
        const existing = auditEvents.find(
          (event) =>
            event.configKey === key.configKey && event.idempotencyKey === key.idempotencyKey,
        );

        if (existing) {
          return existing;
        }

        const created = { id: `audit-event-${auditEvents.length + 1}`, ...create };

        auditEvents.push(created);

        return created;
      }),
    },
  };

  return {
    prisma: prisma as unknown as PrismaClient,
    versions,
    pointers,
    sopSteps,
    violationRules,
    ratingConfigs,
    feeConfigs,
    auditEvents,
  };
}

describe("seedSystemSettings", () => {
  it("创建三个服务类型的五步 SOP、评分阈值和默认费率发布配置", async () => {
    const state = createFakePrisma();

    await seedSystemSettings(state.prisma, "admin-1");

    expect(state.versions).toHaveLength(3);
    expect(state.versions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ configKey: "sop", status: "published", businessVersion: 1 }),
        expect.objectContaining({
          configKey: "rating_threshold",
          status: "published",
          businessVersion: 1,
        }),
        expect.objectContaining({ configKey: "fee", status: "published", businessVersion: 1 }),
      ]),
    );
    expect(state.pointers).toHaveLength(3);
    expect(state.sopSteps).toHaveLength(15);
    expect(state.violationRules).toHaveLength(3);
    expect(state.ratingConfigs).toEqual([
      expect.objectContaining({
        evaluationWindow: 30,
        minimumSampleSize: 5,
        warningScore: 350,
        suspensionScore: 300,
      }),
    ]);
    expect(state.feeConfigs).toEqual([
      expect.objectContaining({
        platformCommissionBps: 1000,
        rewardServiceFeeCents: 200,
        withdrawalFeeBps: 100,
        minimumWithdrawalFeeCents: 100,
      }),
    ]);
    expect(state.auditEvents).toHaveLength(3);
  });

  it("重复执行不会增加配置版本或领域数据", async () => {
    const state = createFakePrisma();

    await seedSystemSettings(state.prisma, "admin-1");
    await seedSystemSettings(state.prisma, "admin-1");

    expect(state.versions).toHaveLength(3);
    expect(state.pointers).toHaveLength(3);
    expect(state.sopSteps).toHaveLength(15);
    expect(state.violationRules).toHaveLength(3);
    expect(state.ratingConfigs).toHaveLength(1);
    expect(state.feeConfigs).toHaveLength(1);
    expect(state.auditEvents).toHaveLength(3);
  });

  it("已有后续发布版本及指针时不会回退到初始版本", async () => {
    const state = createFakePrisma();

    state.versions.push({
      id: "sop-version-2",
      configKey: "sop",
      status: "published",
      businessVersion: 2,
      revision: 1,
      idempotencyKey: "publish:sop:v2",
      changeSummary: "发布后续 SOP 配置",
      publishedById: "admin-2",
      publishedAt: new Date("2026-08-02T00:00:00.000Z"),
    });
    state.pointers.push({ configKey: "sop", publishedVersionId: "sop-version-2" });

    await seedSystemSettings(state.prisma, "admin-1");

    expect(state.pointers).toContainEqual({
      configKey: "sop",
      publishedVersionId: "sop-version-2",
    });
  });
});
