import { Button, Icon, Text, View } from "@tarojs/components";
import Taro from "@tarojs/taro";

type TabIcon = "success_no_circle" | "search" | "info" | "waiting" | "circle";

interface TabItem {
  path: string;
  label: string;
  icon: TabIcon;
}

const tabItems: TabItem[] = [
  { path: "/pages/index/index", label: "首页", icon: "success_no_circle" },
  { path: "/pages/bounty/index", label: "悬赏大厅", icon: "search" },
  { path: "/pages/community/index", label: "社区", icon: "info" },
  { path: "/pages/messages/index", label: "消息", icon: "waiting" },
  { path: "/pages/profile/index", label: "我的", icon: "circle" },
];

export default function CustomTabBar() {
  const currentPath = normalizePath(Taro.getCurrentInstance().router?.path);

  return (
    <View className="fixed bottom-overlay left-overlay right-overlay z-10 box-border flex h-tab-height items-center border-t border-solid border-border bg-white px-note pb-note shadow-card">
      {tabItems.map((item) => {
        const selected = item.path === currentPath;
        const color = selected ? "#4A6CF7" : "#667085";

        return (
          <Button
            key={item.path}
            className="flex h-tab-height flex-1 flex-col items-center justify-center border-none bg-transparent p-none"
            aria-label={item.label}
            onClick={() => void Taro.switchTab({ url: item.path })}
          >
            <Icon type={item.icon} size={24} color={color} ariaLabel={item.label} />
            <Text className="mt-tab-label text-tab font-semibold" style={{ color }}>
              {item.label}
            </Text>
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
