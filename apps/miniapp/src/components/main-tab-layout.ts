export function getMainLayoutTop(
  windowInfo: {
    statusBarHeight?: number;
    safeAreaInsets?: { top?: number };
  },
  menuButton: { bottom: number } | undefined,
) {
  const statusBarHeight = windowInfo.statusBarHeight ?? 0;
  const safeAreaTop = Math.max(statusBarHeight, windowInfo.safeAreaInsets?.top ?? 0);

  return menuButton ? Math.max(safeAreaTop, menuButton.bottom) : safeAreaTop;
}
