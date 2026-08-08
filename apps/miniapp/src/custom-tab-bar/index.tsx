import { Button, Image, Text, View } from "@tarojs/components";
import Taro from "@tarojs/taro";
import bountyActiveIcon from "../assets/navigation/bounty-active.svg";
import bountyIcon from "../assets/navigation/bounty-default.svg";
import communityActiveIcon from "../assets/navigation/community-active.svg";
import communityIcon from "../assets/navigation/community-default.svg";
import homeActiveIcon from "../assets/navigation/home-active.svg";
import homeIcon from "../assets/navigation/home-default.svg";
import messagesActiveIcon from "../assets/navigation/messages-active.svg";
import messagesIcon from "../assets/navigation/messages-default.svg";
import profileActiveIcon from "../assets/navigation/profile-active.svg";
import profileIcon from "../assets/navigation/profile-default.svg";

interface TabItem {
  path: string;
  label: string;
  icon: string;
  activeIcon: string;
  badge?: number;
}

const tabItems: TabItem[] = [
  { path: "/pages/index/index", label: "首页", icon: homeIcon, activeIcon: homeActiveIcon },
  {
    path: "/pages/bounty/index",
    label: "悬赏大厅",
    icon: bountyIcon,
    activeIcon: bountyActiveIcon,
  },
  {
    path: "/pages/community/index",
    label: "社区",
    icon: communityIcon,
    activeIcon: communityActiveIcon,
  },
  {
    path: "/pages/messages/index",
    label: "消息",
    icon: messagesIcon,
    activeIcon: messagesActiveIcon,
    badge: 3,
  },
  { path: "/pages/profile/index", label: "我的", icon: profileIcon, activeIcon: profileActiveIcon },
];

export default function CustomTabBar() {
  const currentPath = normalizePath(Taro.getCurrentInstance().router?.path);
  const windowInfo = Taro.getWindowInfo();
  const bottomSafeArea = Math.max(
    0,
    windowInfo.screenHeight - (windowInfo.safeArea?.bottom ?? windowInfo.screenHeight),
  );

  return (
    <View
      className="fixed bottom-overlay left-overlay right-overlay z-10 flex h-tab-height items-center border-t border-solid border-border bg-white px-note shadow-card"
      data-testid="custom-tab-bar"
      style={{ paddingBottom: `${bottomSafeArea}px` }}
    >
      {tabItems.map((item) => {
        const selected = item.path === currentPath;

        return (
          <Button
            key={item.path}
            className="flex min-h-control flex-1 flex-col items-center justify-center border-none bg-transparent p-none"
            aria-label={item.label}
            data-selected={selected}
            onClick={() => void Taro.switchTab({ url: item.path })}
          >
            <View className="relative h-logo-sm w-logo-sm">
              <Image
                className="h-logo-sm w-logo-sm"
                src={selected ? item.activeIcon : item.icon}
                mode="aspectFit"
              />
              {item.badge ? (
                <Text
                  className="absolute right-overlay top-overlay flex h-tab-badge w-tab-badge items-center justify-center rounded-pill bg-danger text-tab font-semibold text-white"
                  aria-label={`消息未读 ${item.badge} 条`}
                >
                  {item.badge}
                </Text>
              ) : null}
            </View>
            {selected ? (
              <Text className="mt-tab-label text-tab font-semibold text-brand">{item.label}</Text>
            ) : (
              <Text className="mt-tab-label text-tab font-normal text-muted-brand">
                {item.label}
              </Text>
            )}
          </Button>
        );
      })}
    </View>
  );
}

function normalizePath(path: string | undefined): string {
  if (!path) {
    return "/pages/index/index";
  }

  return path.startsWith("/") ? path : `/${path}`;
}
