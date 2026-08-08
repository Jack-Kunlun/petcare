interface BottomSafeAreaWindowInfo {
  screenHeight?: number;
  safeArea?: {
    bottom?: number;
  };
}

/** 自定义 TabBar 的语义高度，与 app.css 的 tab-height token 保持一致。 */
export const CUSTOM_TAB_BAR_HEIGHT_PX = 64;

/** 计算设备底部安全区高度。 */
export function getBottomSafeArea(windowInfo: BottomSafeAreaWindowInfo): number {
  const screenHeight = windowInfo.screenHeight ?? 0;

  return Math.max(0, screenHeight - (windowInfo.safeArea?.bottom ?? screenHeight));
}
