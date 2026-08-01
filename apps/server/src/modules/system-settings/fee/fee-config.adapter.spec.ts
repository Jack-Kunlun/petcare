import { FeeConfig, SYSTEM_CONFIG_ERROR_CODE } from "@petcare/shared-types";
import { FeeConfigAdapter } from "./fee-config.adapter";

const validFee: FeeConfig = {
  platformCommissionBps: 1000,
  rewardServiceFeeCents: 200,
  withdrawalFeeBps: 100,
  minimumWithdrawalFeeCents: 100,
};

describe("FeeConfigAdapter", () => {
  const adapter = new FeeConfigAdapter();

  it("拒绝平台抽成超过五千万分比的配置", () => {
    expect(() => adapter.validate({ ...validFee, platformCommissionBps: 5001 })).toThrow(
      "平台抽成必须在 0 至 5000 万分比之间",
    );
  });

  it.each([
    [{ ...validFee, platformCommissionBps: 10.5 }, "平台抽成必须在 0 至 5000 万分比之间"],
    [{ ...validFee, withdrawalFeeBps: 5001 }, "提现手续费必须在 0 至 5000 万分比之间"],
    [{ ...validFee, rewardServiceFeeCents: -1 }, "悬赏服务费必须为非负整数分"],
    [{ ...validFee, minimumWithdrawalFeeCents: 1.5 }, "最低提现手续费必须为非负整数分"],
  ] as const)("拒绝非法比例或金额 %#", (config, message) => {
    expect(() => adapter.validate(config)).toThrow(message);
  });

  it("完整持久化、加载并递归摘要费用配置", async () => {
    const tx = {
      feeConfig: {
        upsert: jest.fn().mockResolvedValue({}),
        findUnique: jest
          .fn()
          .mockResolvedValue({ id: "fee-1", configVersionId: "version-1", ...validFee }),
      },
    };

    await adapter.persist("version-1", validFee, tx as never);

    expect(tx.feeConfig.upsert).toHaveBeenCalledWith({
      where: { configVersionId: "version-1" },
      update: validFee,
      create: { configVersionId: "version-1", ...validFee },
    });
    await expect(adapter.load("version-1", tx as never)).resolves.toEqual(validFee);
    expect(adapter.summarize(validFee)).toEqual(validFee);
  });

  it("数据库异常只返回稳定系统配置错误码且不泄漏底层信息", async () => {
    const tx = {
      feeConfig: {
        findUnique: jest.fn().mockRejectedValue(new Error("Prisma sensitive detail")),
      },
    };

    await expect(adapter.load("version-1", tx as never)).rejects.toMatchObject({
      code: SYSTEM_CONFIG_ERROR_CODE.PERSISTENCE_FAILED,
      clientMessage: "系统配置持久化失败",
    });
  });
});
