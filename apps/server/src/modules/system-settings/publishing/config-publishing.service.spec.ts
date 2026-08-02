import { SYSTEM_CONFIG_ERROR_CODE } from "@petcare/shared-types";
import { ConfigDiffService } from "./config-diff.service";
import { ConfigDomainAdapter } from "./config-domain.adapter";
import { ConfigPublishingService } from "./config-publishing.service";

interface TestConfig {
  enabled: boolean;
  limit: number;
}

const config: TestConfig = { enabled: true, limit: 10 };

const draftVersion = {
  id: "draft-fee",
  configKey: "fee",
  status: "draft",
  businessVersion: 2,
  revision: 3,
  draftSlot: "active",
  createdById: "admin-0",
  updatedById: "admin-1",
  publishedById: null,
  publishedAt: null,
  sourceVersionId: null,
  idempotencyKey: null,
  changeSummary: "调整配置",
  createdAt: new Date("2026-08-01T00:00:00.000Z"),
  updatedAt: new Date("2026-08-01T01:00:00.000Z"),
};

const publishedVersion = {
  ...draftVersion,
  id: "published-fee-2",
  status: "published",
  draftSlot: null,
  revision: 4,
  publishedById: "admin-1",
  publishedAt: new Date("2026-08-01T02:00:00.000Z"),
  idempotencyKey: "publish-fee-001",
};

function createPrismaMock() {
  const prisma = {
    $transaction: jest.fn(),
    systemConfigVersion: {
      findUnique: jest.fn(),
      findUniqueOrThrow: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    systemConfigPointer: {
      findUnique: jest.fn(),
      upsert: jest.fn(),
    },
    systemConfigAuditEvent: {
      create: jest.fn(),
    },
    orderSop: {
      updateMany: jest.fn(),
    },
    orderFeeSnapshot: {
      updateMany: jest.fn(),
    },
  };

  prisma.$transaction.mockImplementation((work: (tx: typeof prisma) => unknown) => work(prisma));

  return prisma;
}

function createAdapter(): jest.Mocked<ConfigDomainAdapter<TestConfig>> {
  return {
    domain: "fee",
    arrayKeyStrategies: [],
    load: jest.fn().mockResolvedValue(config),
    persist: jest.fn().mockResolvedValue(undefined),
    validate: jest.fn(),
    summarize: jest.fn((value) => ({ enabled: value.enabled, limit: value.limit })),
  };
}

function createSubject() {
  const prisma = createPrismaMock();
  const adapter = createAdapter();
  const service = new ConfigPublishingService(
    prisma as never,
    [adapter as ConfigDomainAdapter<unknown>],
    new ConfigDiffService(),
  );

  return { prisma, adapter, service };
}

describe("ConfigPublishingService", () => {
  it("在一个事务中归档旧版本并发布草稿", async () => {
    const { prisma, adapter, service } = createSubject();

    prisma.systemConfigVersion.findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(publishedVersion);
    prisma.systemConfigVersion.findFirst.mockResolvedValue(draftVersion);
    prisma.systemConfigVersion.findUniqueOrThrow.mockResolvedValue(publishedVersion);
    prisma.systemConfigVersion.updateMany.mockResolvedValue({ count: 1 });
    prisma.systemConfigPointer.findUnique.mockResolvedValue({
      configKey: "fee",
      publishedVersionId: "published-fee-1",
    });

    await service.publish("fee", {
      revision: 3,
      idempotencyKey: "publish-fee-001",
      actorId: "admin-1",
    });

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(adapter.validate).toHaveBeenCalledWith(config);
    expect(prisma.systemConfigVersion.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: "superseded" }) }),
    );
    expect(prisma.systemConfigVersion.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: "draft-fee", revision: 3 }),
        data: expect.objectContaining({ status: "published", draftSlot: null }),
      }),
    );
    expect(prisma.systemConfigPointer.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ update: { publishedVersionId: "draft-fee" } }),
    );
    expect(prisma.systemConfigAuditEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ action: "publish" }) }),
    );
    expect(prisma.orderSop.updateMany).not.toHaveBeenCalled();
    expect(prisma.orderFeeSnapshot.updateMany).not.toHaveBeenCalled();
  });

  it("拒绝陈旧 revision", async () => {
    const { prisma, service } = createSubject();

    prisma.systemConfigVersion.findFirst.mockResolvedValue(draftVersion);
    prisma.systemConfigVersion.updateMany.mockResolvedValue({ count: 0 });

    await expect(
      service.saveDraft("fee", { revision: 2, config, changeSummary: "调整配置" }, "admin-1"),
    ).rejects.toMatchObject({
      code: SYSTEM_CONFIG_ERROR_CODE.VERSION_CONFLICT,
      status: 409,
    });
  });

  it("重复幂等键返回首次发布结果", async () => {
    const { prisma, adapter, service } = createSubject();

    prisma.systemConfigVersion.findUnique.mockResolvedValue(publishedVersion);

    await expect(
      service.publish("fee", {
        revision: 3,
        idempotencyKey: "publish-fee-001",
        actorId: "admin-1",
      }),
    ).resolves.toMatchObject({ id: "published-fee-2", version: 2, config });
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(adapter.persist).not.toHaveBeenCalled();
    expect(prisma.systemConfigAuditEvent.create).not.toHaveBeenCalled();
  });

  it("保存现有草稿时使用 revision 条件递增并写入审计", async () => {
    const { prisma, adapter, service } = createSubject();

    prisma.systemConfigVersion.findFirst.mockResolvedValue(draftVersion);
    prisma.systemConfigVersion.updateMany.mockResolvedValue({ count: 1 });
    prisma.systemConfigVersion.findUniqueOrThrow.mockResolvedValue({
      ...draftVersion,
      revision: 4,
    });

    await expect(
      service.saveDraft("fee", { revision: 3, config, changeSummary: "调整配置" }, "admin-1"),
    ).resolves.toMatchObject({ id: "draft-fee", revision: 4, config });
    expect(prisma.systemConfigVersion.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: "draft-fee", revision: 3 }),
        data: expect.objectContaining({ revision: { increment: 1 } }),
      }),
    );
    expect(adapter.persist).toHaveBeenCalledWith("draft-fee", config, prisma);
    expect(prisma.systemConfigAuditEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ action: "save_draft" }) }),
    );
  });

  it("没有草稿时只创建一个 active 草稿", async () => {
    const { prisma, adapter, service } = createSubject();

    prisma.systemConfigVersion.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ ...publishedVersion, businessVersion: 4 });
    const created = {
      ...draftVersion,
      id: "draft-fee-new",
      businessVersion: 5,
      revision: 1,
    };

    prisma.systemConfigVersion.create.mockResolvedValue(created);

    await service.saveDraft("fee", { revision: 0, config, changeSummary: "建立草稿" }, "admin-1");

    expect(prisma.systemConfigVersion.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          configKey: "fee",
          draftSlot: "active",
          businessVersion: 5,
        }),
      }),
    );
    expect(adapter.persist).toHaveBeenCalledTimes(1);
  });

  it("发布事务失败后只在事务外记录脱敏失败审计", async () => {
    const { prisma, service } = createSubject();

    prisma.systemConfigVersion.findUnique.mockResolvedValue(null);
    prisma.$transaction.mockRejectedValue(new Error("database rejected sensitive-value"));

    await expect(
      service.publish("fee", {
        revision: 3,
        idempotencyKey: "publish-fee-failed",
        actorId: "admin-1",
      }),
    ).rejects.toThrow("database rejected sensitive-value");

    expect(prisma.systemConfigPointer.upsert).not.toHaveBeenCalled();
    expect(prisma.systemConfigAuditEvent.create).toHaveBeenCalledWith({
      data: {
        configKey: "fee",
        operatorId: "admin-1",
        action: "publish_failed",
        idempotencyKey: "publish-fee-failed:failed",
        changeSummary: "配置发布失败",
      },
    });
    expect(JSON.stringify(prisma.systemConfigAuditEvent.create.mock.calls)).not.toContain(
      "sensitive-value",
    );
  });

  it("已有活动草稿时拒绝历史恢复", async () => {
    const { prisma, adapter, service } = createSubject();

    prisma.systemConfigVersion.findFirst.mockResolvedValue(draftVersion);

    await expect(
      service.restoreAsDraft(
        "fee",
        { version: 1, revision: 0, changeSummary: "恢复历史版本" },
        "admin-1",
      ),
    ).rejects.toMatchObject({ code: SYSTEM_CONFIG_ERROR_CODE.VERSION_CONFLICT });
    expect(prisma.systemConfigVersion.create).not.toHaveBeenCalled();
    expect(adapter.persist).not.toHaveBeenCalled();
  });

  it("历史恢复会完整加载来源并复制为新草稿", async () => {
    const { prisma, adapter, service } = createSubject();
    const source = { ...publishedVersion, id: "published-fee-1", businessVersion: 1 };
    const restored = {
      ...draftVersion,
      id: "draft-restored",
      businessVersion: 3,
      revision: 1,
      sourceVersionId: source.id,
    };

    prisma.systemConfigVersion.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(source)
      .mockResolvedValueOnce(publishedVersion);
    prisma.systemConfigVersion.create.mockResolvedValue(restored);

    await expect(
      service.restoreAsDraft(
        "fee",
        { version: 1, revision: 0, changeSummary: "恢复历史版本" },
        "admin-1",
      ),
    ).resolves.toMatchObject({ id: "draft-restored", config });
    expect(adapter.load).toHaveBeenCalledWith(source.id, prisma);
    expect(adapter.persist).toHaveBeenCalledWith(restored.id, config, prisma);
    expect(prisma.systemConfigVersion.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ sourceVersionId: source.id, draftSlot: "active" }),
      }),
    );
  });

  it("差异只比较适配器提供的领域摘要", async () => {
    const { prisma, adapter, service } = createSubject();

    prisma.systemConfigVersion.findFirst.mockResolvedValue(draftVersion);
    prisma.systemConfigPointer.findUnique.mockResolvedValue({
      configKey: "fee",
      publishedVersionId: "published-fee-1",
    });
    adapter.load
      .mockResolvedValueOnce({ enabled: true, limit: 8 })
      .mockResolvedValueOnce({ enabled: true, limit: 10 });

    await expect(service.getDiff("fee")).resolves.toEqual([
      {
        path: "limit",
        label: "limit",
        before: 8,
        after: 10,
        changeType: "modified",
      },
    ]);
    expect(adapter.summarize).toHaveBeenCalledTimes(2);
  });

  it("读取草稿时组合版本元数据和适配器配置", async () => {
    const { prisma, service } = createSubject();

    prisma.systemConfigVersion.findFirst.mockResolvedValue(draftVersion);

    await expect(service.getDraft("fee")).resolves.toEqual({
      id: "draft-fee",
      domain: "fee",
      revision: 3,
      config,
      changeSummary: "调整配置",
      updatedBy: "admin-1",
      updatedAt: "2026-08-01T01:00:00.000Z",
    });
  });

  it("历史列表仅返回发布版本并保持固定分页结果", async () => {
    const { prisma, service } = createSubject();
    const superseded = {
      ...publishedVersion,
      id: "published-fee-1",
      status: "superseded",
      businessVersion: 1,
    };

    prisma.systemConfigVersion.findMany.mockResolvedValue([publishedVersion, superseded]);
    prisma.systemConfigVersion.count.mockResolvedValue(2);

    await expect(service.listHistory("fee", 2, 5)).resolves.toMatchObject({
      total: 2,
      page: 2,
      pageSize: 5,
      list: [
        { id: "published-fee-2", version: 2, status: "published", config },
        { id: "published-fee-1", version: 1, status: "superseded", config },
      ],
    });
    expect(prisma.systemConfigVersion.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 5, take: 5, orderBy: { businessVersion: "desc" } }),
    );
  });

  it("按版本 ID 读取属于指定领域的已发布历史版本", async () => {
    const { prisma, adapter, service } = createSubject();

    prisma.systemConfigVersion.findFirst.mockResolvedValue(publishedVersion);

    await expect(service.getVersion("fee", "published-fee-2")).resolves.toEqual({
      id: "published-fee-2",
      domain: "fee",
      version: 2,
      status: "published",
      config,
      changeSummary: "调整配置",
      publishedBy: "admin-1",
      publishedAt: "2026-08-01T02:00:00.000Z",
    });
    expect(prisma.systemConfigVersion.findFirst).toHaveBeenCalledWith({
      where: {
        id: "published-fee-2",
        configKey: "fee",
        status: { in: ["published", "superseded"] },
      },
    });
    expect(adapter.load).toHaveBeenCalledWith("published-fee-2", prisma);
  });

  it("版本不属于指定领域或不存在时返回稳定的不存在错误", async () => {
    const { prisma, adapter, service } = createSubject();

    prisma.systemConfigVersion.findFirst.mockResolvedValue(null);

    await expect(service.getVersion("fee", "sop-feeding-v1")).rejects.toMatchObject({
      code: SYSTEM_CONFIG_ERROR_CODE.NOT_FOUND,
      status: 404,
    });
    expect(adapter.load).not.toHaveBeenCalled();
  });

  it("旧发布版本被归档后仍可用首次幂等键重放", async () => {
    const { prisma, service } = createSubject();
    const firstResultNowSuperseded = { ...publishedVersion, status: "superseded" };

    prisma.systemConfigVersion.findUnique.mockResolvedValue(firstResultNowSuperseded);

    await expect(
      service.publish("fee", {
        revision: 3,
        idempotencyKey: "publish-fee-001",
        actorId: "admin-1",
      }),
    ).resolves.toMatchObject({ id: "published-fee-2", version: 2, config });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("并发创建唯一草稿失败时返回稳定版本冲突", async () => {
    const { prisma, service } = createSubject();

    prisma.$transaction.mockRejectedValue({
      code: "P2002",
      modelName: "SystemConfigVersion",
      meta: {
        target: ["configKey", "draftSlot"],
      },
    });

    await expect(
      service.saveDraft("fee", { revision: 0, config, changeSummary: "并发建立草稿" }, "admin-1"),
    ).rejects.toMatchObject({
      code: SYSTEM_CONFIG_ERROR_CODE.VERSION_CONFLICT,
      status: 409,
    });
  });

  it("适配器持久化的其他 P2002 原样传播", async () => {
    const { prisma, adapter, service } = createSubject();
    const persistError = {
      code: "P2002",
      meta: {
        modelName: "FeeConfig",
        target: ["config_version_id"],
      },
    };

    prisma.systemConfigVersion.findFirst.mockResolvedValue(draftVersion);
    prisma.systemConfigVersion.updateMany.mockResolvedValue({ count: 1 });
    adapter.persist.mockRejectedValue(persistError);

    await expect(
      service.saveDraft("fee", { revision: 3, config, changeSummary: "保存配置" }, "admin-1"),
    ).rejects.toBe(persistError);
  });

  it("并发恢复创建活动草稿时返回稳定版本冲突", async () => {
    const { prisma, service } = createSubject();

    prisma.$transaction.mockRejectedValue({
      code: "P2002",
      meta: {
        modelName: "SystemConfigVersion",
        target: ["config_key", "draft_slot"],
      },
    });

    await expect(
      service.restoreAsDraft(
        "fee",
        { version: 1, revision: 0, changeSummary: "并发恢复" },
        "admin-1",
      ),
    ).rejects.toMatchObject({
      code: SYSTEM_CONFIG_ERROR_CODE.VERSION_CONFLICT,
      status: 409,
    });
  });

  it("并发发布命中幂等唯一键时重查并返回首次结果", async () => {
    const { prisma, service } = createSubject();

    prisma.systemConfigVersion.findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(publishedVersion);
    prisma.$transaction.mockRejectedValue({ code: "P2002" });

    await expect(
      service.publish("fee", {
        revision: 3,
        idempotencyKey: "publish-fee-001",
        actorId: "admin-1",
      }),
    ).resolves.toMatchObject({ id: "published-fee-2", version: 2, config });
    expect(prisma.systemConfigAuditEvent.create).not.toHaveBeenCalled();
  });

  it("初始幂等键属于其他领域时记录脱敏失败审计", async () => {
    const { prisma, service } = createSubject();

    prisma.systemConfigVersion.findUnique.mockResolvedValue({
      ...publishedVersion,
      configKey: "sop",
      changeSummary: "敏感跨领域正文",
    });

    await expect(
      service.publish("fee", {
        revision: 3,
        idempotencyKey: "cross-domain-key",
        actorId: "admin-1",
      }),
    ).rejects.toMatchObject({ code: SYSTEM_CONFIG_ERROR_CODE.VERSION_CONFLICT });
    expect(prisma.systemConfigAuditEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ action: "publish_failed" }) }),
    );
    expect(JSON.stringify(prisma.systemConfigAuditEvent.create.mock.calls)).not.toContain(
      "敏感跨领域正文",
    );
  });

  it("初始幂等结果加载失败时记录脱敏失败审计", async () => {
    const { prisma, adapter, service } = createSubject();
    const loadError = new Error("敏感重放正文");

    prisma.systemConfigVersion.findUnique.mockResolvedValue(publishedVersion);
    adapter.load.mockRejectedValue(loadError);

    await expect(
      service.publish("fee", {
        revision: 3,
        idempotencyKey: "replay-load-failed",
        actorId: "admin-1",
      }),
    ).rejects.toBe(loadError);
    expect(prisma.systemConfigAuditEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ action: "publish_failed" }) }),
    );
    expect(JSON.stringify(prisma.systemConfigAuditEvent.create.mock.calls)).not.toContain(
      "敏感重放正文",
    );
  });

  it("并发重查得到非法状态时记录脱敏失败审计", async () => {
    const { prisma, service } = createSubject();

    prisma.systemConfigVersion.findUnique.mockResolvedValueOnce(null).mockResolvedValueOnce({
      ...publishedVersion,
      status: "draft",
      changeSummary: "敏感非法状态正文",
    });
    prisma.$transaction.mockRejectedValue({ code: "P2002" });

    await expect(
      service.publish("fee", {
        revision: 3,
        idempotencyKey: "invalid-concurrent-result",
        actorId: "admin-1",
      }),
    ).rejects.toMatchObject({ code: SYSTEM_CONFIG_ERROR_CODE.VERSION_CONFLICT });
    expect(prisma.systemConfigAuditEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ action: "publish_failed" }) }),
    );
    expect(JSON.stringify(prisma.systemConfigAuditEvent.create.mock.calls)).not.toContain(
      "敏感非法状态正文",
    );
  });

  it("pointer 更新后审计失败会回滚整个事务状态", async () => {
    const { prisma, adapter, service } = createSubject();
    const committed = {
      pointerVersionId: "published-fee-1",
      oldStatus: "published",
      draftStatus: "draft",
    };
    let pointerUpdateReached = false;

    prisma.systemConfigVersion.findUnique.mockResolvedValue(null);
    prisma.$transaction.mockImplementation(async (work: (tx: unknown) => Promise<unknown>) => {
      const working = { ...committed };
      const tx = {
        systemConfigVersion: {
          findUnique: jest.fn().mockResolvedValue(null),
          findFirst: jest.fn().mockResolvedValue(draftVersion),
          update: jest.fn().mockImplementation(async () => {
            working.oldStatus = "superseded";

            return publishedVersion;
          }),
          updateMany: jest.fn().mockImplementation(async () => {
            working.draftStatus = "published";

            return { count: 1 };
          }),
          findUniqueOrThrow: jest.fn().mockResolvedValue(publishedVersion),
        },
        systemConfigPointer: {
          findUnique: jest.fn().mockResolvedValue({
            configKey: "fee",
            publishedVersionId: committed.pointerVersionId,
          }),
          upsert: jest.fn().mockImplementation(async () => {
            pointerUpdateReached = true;
            working.pointerVersionId = draftVersion.id;
          }),
        },
        systemConfigAuditEvent: {
          create: jest.fn().mockRejectedValue(new Error("transaction audit failed")),
        },
      };

      const result = await work(tx);

      Object.assign(committed, working);

      return result;
    });

    await expect(
      service.publish("fee", {
        revision: 3,
        idempotencyKey: "publish-fee-rollback",
        actorId: "admin-1",
      }),
    ).rejects.toThrow("transaction audit failed");
    expect(pointerUpdateReached).toBe(true);
    expect(committed).toEqual({
      pointerVersionId: "published-fee-1",
      oldStatus: "published",
      draftStatus: "draft",
    });
    expect(prisma.systemConfigAuditEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ action: "publish_failed" }) }),
    );
    expect(adapter.validate).toHaveBeenCalledWith(config);
  });
});
