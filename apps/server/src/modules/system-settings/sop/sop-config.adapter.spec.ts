import { SopConfig } from "@petcare/shared-types";
import { SopConfigAdapter } from "./sop-config.adapter";

const validSop = {
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
} satisfies SopConfig;

describe("SopConfigAdapter", () => {
  const adapter = new SopConfigAdapter("feeding");

  it("拒绝任一服务类型不是恰好五个连续步骤的配置", () => {
    expect(() =>
      adapter.validate({
        ...validSop,
        steps: validSop.steps.slice(0, 4),
      }),
    ).toThrow("SOP 必须恰好包含 5 个步骤");
  });

  it.each([
    [
      {
        ...validSop,
        steps: validSop.steps.map((step, index) => ({
          ...step,
          stepNumber: index === 4 ? 4 : step.stepNumber,
        })),
      },
      "SOP 步骤序号必须从 1 至 5 唯一连续",
    ],
    [
      {
        ...validSop,
        steps: validSop.steps.map((step, index) => ({
          ...step,
          stepName: index === 0 ? "一" : step.stepName,
        })),
      },
      "SOP 步骤名称长度必须在 2 至 20 个字符之间",
    ],
    [
      {
        ...validSop,
        steps: validSop.steps.map((step, index) => ({
          ...step,
          instruction: index === 0 ? "过短" : step.instruction,
        })),
      },
      "SOP 步骤说明长度必须在 10 至 500 个字符之间",
    ],
    [
      {
        ...validSop,
        steps: validSop.steps.map((step, index) => ({
          ...step,
          expectedDurationMinutes: index === 0 ? 240.5 : step.expectedDurationMinutes,
        })),
      },
      "SOP 步骤时长必须在 1 至 240 分钟之间",
    ],
    [
      {
        ...validSop,
        steps: validSop.steps.map((step, index) => ({
          ...step,
          minimumPhotoCount: index === 0 ? 21 : step.minimumPhotoCount,
        })),
      },
      "SOP 最少照片数量必须在 0 至 20 之间",
    ],
    [
      {
        ...validSop,
        steps: validSop.steps.map((step, index) => ({
          ...step,
          instruction: index === 1 ? validSop.steps[0].instruction : step.instruction,
        })),
      },
      "SOP 步骤不得包含重复内容",
    ],
    [
      {
        ...validSop,
        steps: validSop.steps.map((step) => ({ ...step, expectedDurationMinutes: 100 })),
      },
      "SOP 总时长不得超过 480 分钟",
    ],
    [{ ...validSop, violationRules: [] }, "SOP 必须包含至少一条完整违规规则"],
  ] as const)("拒绝不完整 SOP 配置 %#", (config, message) => {
    expect(() => adapter.validate(config as SopConfig)).toThrow(message);
  });

  it("按 serviceType 完整持久化和加载，并声明显式数组稳定键", async () => {
    const storedSteps = validSop.steps.map((step, index) => ({
      id: `step-${index + 1}`,
      configVersionId: "version-1",
      serviceType: "feeding",
      ...step,
    }));
    const storedRules = validSop.violationRules.map((rule) => ({
      id: "rule-1",
      configVersionId: "version-1",
      ...rule,
    }));
    const tx = {
      sopConfigStep: {
        deleteMany: jest.fn().mockResolvedValue({ count: 5 }),
        createMany: jest.fn().mockResolvedValue({ count: 5 }),
        findMany: jest.fn().mockResolvedValue(storedSteps),
      },
      sopViolationRule: {
        deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
        createMany: jest.fn().mockResolvedValue({ count: 1 }),
        findMany: jest.fn().mockResolvedValue(storedRules),
      },
    };

    await adapter.persist("version-1", validSop, tx as never);

    expect(tx.sopConfigStep.createMany).toHaveBeenCalledWith({
      data: validSop.steps.map((step) => ({
        configVersionId: "version-1",
        serviceType: "feeding",
        ...step,
      })),
    });
    await expect(adapter.load("version-1", tx as never)).resolves.toEqual(validSop);
    expect(adapter.arrayKeyStrategies).toEqual([
      { arrayPath: "steps", keyPaths: ["stepNumber"] },
      { arrayPath: "violationRules", keyPaths: ["severity"] },
    ]);
    expect(adapter.summarize(validSop)).toEqual(validSop);
  });
});
