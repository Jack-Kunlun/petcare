import { View } from "@tarojs/components";
import Taro from "@tarojs/taro";

interface StatusBarSpacerProps {
  /** 是否同时预留微信右上角胶囊及其上下对称间距。 */
  includeNavigationArea?: boolean;
}

/** 为自定义导航页面预留微信状态栏或完整顶部导航安全区。 */
export default function StatusBarSpacer({ includeNavigationArea = false }: StatusBarSpacerProps) {
  const statusBarHeight = Taro.getWindowInfo().statusBarHeight ?? 0;
  let safeTopHeight = statusBarHeight;

  if (includeNavigationArea) {
    const menuButton = Taro.getMenuButtonBoundingClientRect();
    const capsuleTopGap = Math.max(0, menuButton.top - statusBarHeight);

    safeTopHeight = Math.max(statusBarHeight, menuButton.bottom + capsuleTopGap);
  }

  return (
    <View
      className="w-full shrink-0"
      style={{ height: `${safeTopHeight}px` }}
      data-testid="status-bar-spacer"
    />
  );
}
