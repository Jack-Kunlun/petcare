export function isMainlandChinaMobile(value: string): boolean {
  return /^1[3-9]\d{9}$/.test(value);
}
