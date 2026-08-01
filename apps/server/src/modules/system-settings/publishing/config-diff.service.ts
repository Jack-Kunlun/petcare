import { Injectable } from "@nestjs/common";
import {
  SystemConfigArrayKeyStrategy,
  SystemConfigDiff,
  SystemConfigDiffChangeType,
  SystemConfigDiffRequest,
  SystemConfigDiffResponse,
  SystemConfigSummaryObject,
  SystemConfigSummaryValue,
} from "@petcare/shared-types";

function isSummaryObject(value: unknown): value is SystemConfigSummaryObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function canonical(value: SystemConfigSummaryValue | undefined): string {
  if (value === undefined) {
    return "undefined";
  }

  if (Array.isArray(value)) {
    return `[${value.map(canonical).join(",")}]`;
  }

  if (isSummaryObject(value)) {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`)
      .join(",")}}`;
  }

  return JSON.stringify(value);
}

function valueAtPath(
  value: SystemConfigSummaryValue,
  path: string,
): SystemConfigSummaryValue | undefined {
  return path.split(".").reduce<SystemConfigSummaryValue | undefined>((current, segment) => {
    return isSummaryObject(current) ? current[segment] : undefined;
  }, value);
}

function isStableKeyPart(
  value: SystemConfigSummaryValue | undefined,
): value is string | number | boolean {
  return ["string", "number", "boolean"].includes(typeof value);
}

interface IndexedSummaryItem {
  /** 业务键的路径和值描述。 */
  descriptor: string;
  /** 参与比较的完整数组项。 */
  item: SystemConfigSummaryValue;
}

function indexByStrategy(
  items: SystemConfigSummaryValue[],
  strategy: SystemConfigArrayKeyStrategy,
): Map<string, IndexedSummaryItem> | undefined {
  const indexed = new Map<string, IndexedSummaryItem>();

  for (const item of items) {
    const parts = strategy.keyPaths.map((path) => ({ path, value: valueAtPath(item, path) }));

    if (parts.length === 0 || parts.some((part) => !isStableKeyPart(part.value))) {
      return undefined;
    }

    const identity = canonical(parts.map((part) => part.value as string | number | boolean));

    if (indexed.has(identity)) {
      return undefined;
    }

    indexed.set(identity, {
      descriptor: parts.map((part) => `${part.path}=${String(part.value)}`).join(","),
      item,
    });
  }

  return indexed;
}

function labelFor(path: string): string {
  const segments = path.split(".");
  const segment = segments[segments.length - 1] ?? path;

  return segment.replace(/\[[^\]]+\]$/u, "");
}

/** 生成领域无关、按显式策略匹配数组项的稳定配置差异。 */
@Injectable()
export class ConfigDiffService {
  /**
   * 比较两份递归摘要，只按请求声明的稳定业务键策略匹配数组项。
   *
   * @param request 摘要与数组稳定键策略。
   */
  compare(request: SystemConfigDiffRequest): SystemConfigDiffResponse {
    const differences: SystemConfigDiff[] = [];

    this.walk(
      request.before,
      request.after,
      "",
      new Map(request.arrayKeyStrategies.map((strategy) => [strategy.arrayPath, strategy])),
      differences,
    );

    return differences.sort((left, right) => left.path.localeCompare(right.path));
  }

  private walk(
    before: SystemConfigSummaryValue | undefined,
    after: SystemConfigSummaryValue | undefined,
    path: string,
    strategies: Map<string, SystemConfigArrayKeyStrategy>,
    output: SystemConfigDiff[],
  ): void {
    if (canonical(before) === canonical(after)) {
      return;
    }

    if (Array.isArray(before) && Array.isArray(after)) {
      const strategy = strategies.get(path);

      if (!strategy) {
        this.push(path, before, after, output);

        return;
      }

      const beforeByKey = indexByStrategy(before, strategy);
      const afterByKey = indexByStrategy(after, strategy);

      if (!beforeByKey || !afterByKey) {
        this.push(path, before, after, output);

        return;
      }

      const keys = [...new Set([...beforeByKey.keys(), ...afterByKey.keys()])].sort();

      for (const key of keys) {
        const beforeItem = beforeByKey.get(key);
        const afterItem = afterByKey.get(key);
        const descriptor = beforeItem?.descriptor ?? afterItem?.descriptor ?? key;

        this.walk(
          beforeItem?.item,
          afterItem?.item,
          `${path}[${descriptor}]`,
          strategies,
          output,
        );
      }

      return;
    }

    if (isSummaryObject(before) && isSummaryObject(after)) {
      const keys = [...new Set([...Object.keys(before), ...Object.keys(after)])].sort();

      for (const key of keys) {
        this.walk(
          before[key],
          after[key],
          path ? `${path}.${key}` : key,
          strategies,
          output,
        );
      }

      return;
    }

    this.push(path, before, after, output);
  }

  private push(
    path: string,
    before: SystemConfigSummaryValue | undefined,
    after: SystemConfigSummaryValue | undefined,
    output: SystemConfigDiff[],
  ): void {
    let changeType: SystemConfigDiffChangeType = "modified";

    if (before === undefined) {
      changeType = "added";
    } else if (after === undefined) {
      changeType = "removed";
    }

    output.push({ path, label: labelFor(path), before, after, changeType });
  }
}
