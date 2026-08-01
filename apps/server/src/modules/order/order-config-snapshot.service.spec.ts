import { FeeConfig, SopConfig, SYSTEM_CONFIG_ERROR_CODE } from "@petcare/shared-types";
import { SystemSettingsOverviewService } from "../system-settings/system-settings-overview.service";
import { OrderConfigSnapshotService } from "./order-config-snapshot.service";

const sopConfig: SopConfig = {
  steps: [
    {
      stepNumber: 1,
      stepName: "进门消毒",
      instruction: "进门后完成手部和鞋底消毒",
      expectedDurationMinutes: 5,
      minimumPhotoCount: 1,
      videoRequired: false,
    },
  ],
  violationRules: [
    {
      severity: "severe",
      description: "未按要求完成服务",
      serviceFeeDeductionBps: 5000,
      ratingDeductionScore: 100,
      suspensionDays: 7,
      retrainingRequired: true,
      sortOrder: 1,
    },
  ],
};

const feeConfig: FeeConfig = {
  platformCommissionBps: 1250,
  rewardServiceFeeCents: 200,
  withdrawalFeeBps: 100,
  minimumWithdrawalFeeCents: 100,
};

describe("OrderConfigSnapshotService", () => {
  it("准备当前已发布 SOP 和整数费率计算结果", async () => {
    const transaction = {};
    const overview = {
      getCurrent: jest.fn().mockImplementation((domain: string) => {
        if (domain === "sop:feeding") {
          return { id: "sop-v2", config: sopConfig };
        }

        if (domain === "fee") {
          return { id: "fee-v2", config: feeConfig };
        }

        return null;
      }),
    };
    const service = new OrderConfigSnapshotService(
      overview as unknown as SystemSettingsOverviewService,
    );

    const snapshot = await service.createForOrder("feeding", 12501, transaction as never);

    expect(overview.getCurrent).toHaveBeenCalledWith("sop:feeding", transaction);
    expect(overview.getCurrent).toHaveBeenCalledWith("fee", transaction);
    expect(snapshot).toEqual({
      sopConfigVersionId: "sop-v2",
      feeConfigVersionId: "fee-v2",
      sops: [
        {
          stepNumber: 1,
          stepName: "进门消毒",
          instruction: "进门后完成手部和鞋底消毒",
          expectedDurationMinutes: 5,
          minimumPhotoCount: 1,
          videoRequired: false,
          violationGuidance: JSON.stringify(sopConfig.violationRules),
          photos: [],
          videos: [],
        },
      ],
      fee: {
        feeConfigVersionId: "fee-v2",
        inputAmountCents: 12501,
        platformCommissionBps: 1250,
        commissionAmountCents: 1563,
        rewardServiceFeeCents: 200,
        withdrawalFeeBps: 100,
        minimumWithdrawalFeeCents: 100,
        providerSettlementCents: 10738,
      },
    });
  });

  it("缺少任一当前发布配置时返回稳定不存在错误", async () => {
    const overview = {
      getCurrent: jest
        .fn()
        .mockResolvedValueOnce({ id: "sop-v2", config: sopConfig })
        .mockResolvedValueOnce(null),
    };
    const service = new OrderConfigSnapshotService(
      overview as unknown as SystemSettingsOverviewService,
    );

    await expect(service.createForOrder("feeding", 12501, {} as never)).rejects.toMatchObject({
      code: SYSTEM_CONFIG_ERROR_CODE.NOT_FOUND,
      clientMessage: "系统配置不存在",
    });
  });
});
