import { View } from "@tarojs/components";
import Taro from "@tarojs/taro";

/** 为自定义导航页面预留微信状态栏高度。 */
export default function StatusBarSpacer() {
  const statusBarHeight = Taro.getWindowInfo().statusBarHeight ?? 0;

  return (
    <View
      className="w-full shrink-0"
      style={{ height: `${statusBarHeight}px` }}
      data-testid="status-bar-spacer"
    />
  );
}
