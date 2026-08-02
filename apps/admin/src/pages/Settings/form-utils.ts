function formatScaledInteger(value: number): string {
  return (value / 100).toFixed(2);
}

function parseScaledInteger(value: string): number | null {
  const normalized = value.trim();

  if (!/^\d+(?:\.\d{1,2})?$/.test(normalized)) {
    return null;
  }

  const [whole, fraction = ""] = normalized.split(".");
  const parsed = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));

  return Number.isSafeInteger(parsed) ? parsed : null;
}

/** 将 API 的整数评分百分值格式化为星级输入值。 */
export function formatScoreAsStars(value: number): string {
  return formatScaledInteger(value);
}

/** 将星级输入精确转换为 API 整数评分百分值。 */
export function parseStarsAsScore(value: string): number | null {
  return parseScaledInteger(value);
}

/** 将 API 整数万分比格式化为百分比输入值。 */
export function formatBasisPointsAsPercent(value: number): string {
  return formatScaledInteger(value);
}

/** 将百分比输入精确转换为 API 整数万分比。 */
export function parsePercentAsBasisPoints(value: string): number | null {
  return parseScaledInteger(value);
}

/** 将 API 整数分格式化为人民币元输入值。 */
export function formatCentsAsYuan(value: number): string {
  return formatScaledInteger(value);
}

/** 将人民币元输入精确转换为 API 整数分。 */
export function parseYuanAsCents(value: string): number | null {
  return parseScaledInteger(value);
}
