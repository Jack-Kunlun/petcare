/** 将字段路径转换为可供错误摘要稳定定位的 DOM id。 */
export function settingsFieldId(path: string): string {
  return `settings-field-${path.replace(/\./gu, "-")}`;
}
