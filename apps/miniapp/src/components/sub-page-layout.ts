interface WindowInfo {
  safeAreaInsets?: { bottom?: number };
}

export function getSubPageBottom(windowInfo: WindowInfo): number {
  return windowInfo.safeAreaInsets?.bottom ?? 0;
}
