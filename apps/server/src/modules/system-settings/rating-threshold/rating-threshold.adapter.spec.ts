import { RatingThresholdConfig } from "@petcare/shared-types";
import { RatingThresholdAdapter } from "./rating-threshold.adapter";

const validRating: RatingThresholdConfig = {
  evaluationWindow: 30,
  minimumSampleSize: 5,
  warningScore: 350,
  suspensionScore: 300,
  retrainingRequirement: "完成平台重新培训并通过管理员审核",
};

describe("RatingThresholdAdapter", () => {
  const adapter = new RatingThresholdAdapter();

  it("拒绝暂停阈值不低于警告阈值的配置", () => {
    expect(() =>
      adapter.validate({ ...validRating, suspensionScore: 350, warningScore: 350 }),
    ).toThrow("暂停阈值必须严格低于警告阈值");
  });

  it.each([
    [{ ...validRating, evaluationWindow: 4 }, "评分窗口必须在最近 5 至 100 条评价之间"],
    [{ ...validRating, evaluationWindow: 30.5 }, "评分窗口必须在最近 5 至 100 条评价之间"],
    [{ ...validRating, minimumSampleSize: 31 }, "最小样本数不得超过评分窗口"],
    [{ ...validRating, warningScore: 501 }, "警告阈值必须在 100 至 500 之间"],
    [{ ...validRating, suspensionScore: 99 }, "暂停阈值必须在 100 至 500 之间"],
    [{ ...validRating, retrainingRequirement: "   " }, "再培训要求不能为空"],
  ] as const)("拒绝不完整评分配置 %#", (config, message) => {
    expect(() => adapter.validate(config)).toThrow(message);
  });

  it("完整持久化、加载并递归摘要评分配置", async () => {
    const tx = {
      ratingThresholdConfig: {
        upsert: jest.fn().mockResolvedValue({}),
        findUnique: jest
          .fn()
          .mockResolvedValue({ id: "rating-1", configVersionId: "version-1", ...validRating }),
      },
    };

    await adapter.persist("version-1", validRating, tx as never);

    expect(tx.ratingThresholdConfig.upsert).toHaveBeenCalledWith({
      where: { configVersionId: "version-1" },
      update: validRating,
      create: { configVersionId: "version-1", ...validRating },
    });
    await expect(adapter.load("version-1", tx as never)).resolves.toEqual(validRating);
    expect(adapter.summarize(validRating)).toEqual(validRating);
  });
});
