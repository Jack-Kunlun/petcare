import { ConfigDiffService } from "./config-diff.service";

describe("ConfigDiffService", () => {
  const service = new ConfigDiffService();

  it("输出固定字段并区分新增、修改和删除", () => {
    expect(
      service.compare({
        before: { enabled: true, limit: 3, retired: "旧值" },
        after: { enabled: true, limit: 5, created: "新值" },
        arrayKeyStrategies: [],
      }),
    ).toEqual([
      {
        path: "created",
        label: "created",
        before: undefined,
        after: "新值",
        changeType: "added",
      },
      {
        path: "limit",
        label: "limit",
        before: 3,
        after: 5,
        changeType: "modified",
      },
      {
        path: "retired",
        label: "retired",
        before: "旧值",
        after: undefined,
        changeType: "removed",
      },
    ]);
  });

  it("数组按稳定业务键比较，重排不产生差异", () => {
    const before = {
      rules: [
        { key: "basic", label: "基础规则", value: 1 },
        { key: "strict", label: "严格规则", value: 2 },
      ],
    };
    const after = {
      rules: [
        { key: "strict", label: "严格规则", value: 2 },
        { key: "basic", label: "基础规则", value: 1 },
      ],
    };

    expect(
      service.compare({
        before,
        after,
        arrayKeyStrategies: [{ arrayPath: "rules", keyPaths: ["key"] }],
      }),
    ).toEqual([]);
  });

  it("数组重排时只报告稳定业务键对应的真实字段变化", () => {
    const before = {
      rules: [
        { key: "basic", label: "基础规则", value: 1 },
        { key: "strict", label: "严格规则", value: 2 },
      ],
    };
    const after = {
      rules: [
        { key: "strict", label: "严格规则", value: 2 },
        { key: "basic", label: "基础规则", value: 3 },
      ],
    };

    expect(
      service.compare({
        before,
        after,
        arrayKeyStrategies: [{ arrayPath: "rules", keyPaths: ["key"] }],
      }),
    ).toEqual([
      {
        path: "rules[key=basic].value",
        label: "key=basic · value",
        before: 1,
        after: 3,
        changeType: "modified",
      },
    ]);
  });

  it("使用显式复合路径匹配数组项", () => {
    const before = {
      steps: [
        { scope: { type: "walking" }, stepNumber: 1, value: "旧值" },
        { scope: { type: "feeding" }, stepNumber: 1, value: "保持" },
      ],
    };
    const after = {
      steps: [
        { scope: { type: "feeding" }, stepNumber: 1, value: "保持" },
        { scope: { type: "walking" }, stepNumber: 1, value: "新值" },
      ],
    };

    expect(
      service.compare({
        before,
        after,
        arrayKeyStrategies: [{ arrayPath: "steps", keyPaths: ["scope.type", "stepNumber"] }],
      }),
    ).toEqual([
      {
        path: "steps[scope.type=walking,stepNumber=1].value",
        label: "scope.type=walking，stepNumber=1 · value",
        before: "旧值",
        after: "新值",
        changeType: "modified",
      },
    ]);
  });

  it("转义数组业务键中的路径特殊字符并保留可读条目标签", () => {
    expect(
      service.compare({
        before: { rules: [{ key: "vip],level=1\\beta", value: "旧值" }] },
        after: { rules: [{ key: "vip],level=1\\beta", value: "新值" }] },
        arrayKeyStrategies: [{ arrayPath: "rules", keyPaths: ["key"] }],
      }),
    ).toEqual([
      {
        path: String.raw`rules[key=vip\u005d\u002clevel\u003d1\\beta].value`,
        label: String.raw`key=vip\u005d\u002clevel\u003d1\\beta · value`,
        before: "旧值",
        after: "新值",
        changeType: "modified",
      },
    ]);
  });

  it("没有显式策略时不猜测数组业务键", () => {
    const before = { rules: [{ key: "basic", value: 1 }] };
    const after = { rules: [{ key: "basic", value: 2 }] };

    expect(service.compare({ before, after, arrayKeyStrategies: [] })).toEqual([
      {
        path: "rules",
        label: "rules",
        before: before.rules,
        after: after.rules,
        changeType: "modified",
      },
    ]);
  });
});
