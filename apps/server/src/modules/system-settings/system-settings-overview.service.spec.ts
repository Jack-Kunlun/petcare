import { ConfigPublishingService } from "./publishing/config-publishing.service";
import { SystemSettingsOverviewService } from "./system-settings-overview.service";

describe("SystemSettingsOverviewService", () => {
  it("按当前指针加载发布版本并装配全部五个配置键", async () => {
    const publishedVersion = {
      id: "fee-v1",
      configKey: "fee",
      businessVersion: 1,
      status: "published",
      changeSummary: "初始化费用",
      publishedById: "admin-1",
      publishedAt: new Date("2026-08-01T00:00:00.000Z"),
    };
    const prisma = {
      systemConfigPointer: {
        findUnique: jest
          .fn()
          .mockImplementation(({ where: { configKey } }) =>
            configKey === "fee" ? { publishedVersionId: "fee-v1", publishedVersion } : null,
          ),
      },
    };
    const publishing = {
      getDraft: jest.fn().mockResolvedValue(null),
    };
    const feeAdapter = {
      domain: "fee",
      load: jest.fn().mockResolvedValue({
        platformCommissionBps: 1000,
        rewardServiceFeeCents: 200,
        withdrawalFeeBps: 100,
        minimumWithdrawalFeeCents: 100,
      }),
    };
    const service = new SystemSettingsOverviewService(
      prisma as never,
      publishing as unknown as ConfigPublishingService,
      [feeAdapter as never],
    );

    const overview = await service.getOverview();

    expect(publishing.getDraft.mock.calls.map(([domain]) => domain)).toEqual([
      "sop:feeding",
      "sop:walking",
      "sop:playing",
      "rating_threshold",
      "fee",
    ]);
    expect(overview.fee.current).toMatchObject({
      id: "fee-v1",
      domain: "fee",
      version: 1,
      publishedAt: "2026-08-01T00:00:00.000Z",
    });
    expect(overview.ratingThreshold.current).toBeNull();
  });
});
