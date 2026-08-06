import { Button, ScrollView, Text, View } from "@tarojs/components";
import Taro from "@tarojs/taro";
import { useAuth } from "../../auth/auth.context";
import StatusBarSpacer from "../../components/layout/StatusBarSpacer";
import HeroCarousel from "./components/HeroCarousel";
import HomeHeader from "./components/HomeHeader";
import { HOME_BANNERS } from "./home.data";

const bountyItems = [
  { service: "上门喂猫", location: "滨江 · 江南大道", schedule: "明天 18:00", price: "¥80/次" },
  { service: "陪玩遛狗", location: "西湖 · 文三路", schedule: "周六 09:30", price: "¥60/次" },
  { service: "换粮清洁", location: "拱墅 · 万达附近", schedule: "周日 14:00", price: "¥50/次" },
] as const;

const classroomItems = [
  { category: "日常照护", title: "第一次请宠托上门，准备这 5 件事" },
  { category: "健康护理", title: "换季时如何观察宠物的状态变化" },
  { category: "安全指南", title: "把家庭环境交给服务者前的检查清单" },
] as const;

const communityItems = [
  { author: "杭州宠友小组", title: "分享一份我的安心托付清单", meta: "26 人正在讨论" },
  { author: "毛球日记", title: "今天也要好好吃饭、好好散步", meta: "128 次互动" },
] as const;

export default function Index() {
  const { status, user, logout } = useAuth();
  const nickname = user?.nickname ?? "宠伴朋友";

  return (
    <View className="box-border min-h-screen bg-surface p-page pb-safe-bottom">
      <StatusBarSpacer />
      <View data-testid="home-section-header">
        <HomeHeader
          nickname={nickname}
          avatar={user?.avatar ?? null}
          location="上海市 · 静安区"
          hasUnread
          onMessages={() => void Taro.switchTab({ url: "/pages/messages/index" })}
        />
      </View>
      <View className="mt-compact" data-testid="home-section-hero">
        <HeroCarousel banners={HOME_BANNERS} onAction={(url) => void Taro.switchTab({ url })} />
      </View>

      {status === "loading" ? (
        <View className="mt-section rounded-card bg-white px-section py-compact shadow-card">
          <Text className="text-base text-muted-brand">正在恢复登录状态…</Text>
        </View>
      ) : null}

      {status === "guest" ? (
        <View className="mt-section flex items-center justify-between rounded-card bg-white px-section py-compact shadow-card">
          <View className="flex flex-col">
            <Text className="text-welcome font-semibold text-ink-strong">
              登录后管理你的照护计划
            </Text>
            <Text className="mt-note text-base text-muted-brand">发布需求、查看记录和收藏内容</Text>
          </View>
          <Button
            className="w-action rounded-button border-none bg-brand text-white"
            onClick={() => void Taro.navigateTo({ url: "/pages/auth/index" })}
          >
            微信登录
          </Button>
        </View>
      ) : null}

      {status === "authenticated" && user ? (
        <View className="mt-section flex items-center justify-between rounded-card bg-white px-section py-compact shadow-card">
          <View className="flex flex-col">
            <Text className="text-welcome font-semibold text-ink-strong">你的照护计划</Text>
            <Text className="mt-note text-base text-muted-brand">当前没有进行中的服务</Text>
          </View>
          <Button
            className="rounded-button border-none bg-surface-muted px-compact text-brand-strong"
            onClick={() => void Taro.navigateTo({ url: "/pages/bounty/index" })}
          >
            发布需求
          </Button>
        </View>
      ) : null}

      <View className="mt-section flex items-center justify-between">
        <Text className="text-welcome font-bold text-ink-strong">热门悬赏</Text>
        <Button
          className="border-none bg-transparent px-none text-base text-brand-strong"
          onClick={() => void Taro.navigateTo({ url: "/pages/bounty/index" })}
        >
          查看全部悬赏
        </Button>
      </View>
      <ScrollView className="mt-compact w-full" scrollX enableFlex>
        <View className="flex gap-note">
          {bountyItems.map((item) => (
            <View
              key={`${item.service}-${item.location}`}
              className="box-border w-action shrink-0 rounded-card bg-white p-compact shadow-card"
            >
              <Text className="block text-subtitle font-semibold text-ink-strong">
                {item.service}
              </Text>
              <Text className="mt-note block text-base text-muted-brand">{item.location}</Text>
              <View className="mt-compact flex items-center justify-between">
                <Text className="text-base text-muted-brand">{item.schedule}</Text>
                <Text className="text-base font-semibold text-brand-strong">{item.price}</Text>
              </View>
            </View>
          ))}
        </View>
      </ScrollView>

      <View className="mt-section flex items-center justify-between">
        <Text className="text-welcome font-bold text-ink-strong">养宠小课堂</Text>
        <Text className="text-base text-muted-brand">持续更新</Text>
      </View>
      <View className="mt-compact rounded-card bg-white px-section py-note shadow-card">
        {classroomItems.map((item, index) => (
          <View key={item.title} className="flex border-b border-solid border-border py-compact">
            <View className="mr-compact flex h-logo-sm w-logo-sm shrink-0 items-center justify-center rounded-button bg-surface-muted">
              <Text className="text-base font-semibold text-brand-strong">0{index + 1}</Text>
            </View>
            <View className="flex flex-col">
              <Text className="text-base text-brand-strong">{item.category}</Text>
              <Text className="mt-note text-description text-ink-strong">{item.title}</Text>
            </View>
          </View>
        ))}
      </View>

      <View className="mt-section flex items-center justify-between">
        <Text className="text-welcome font-bold text-ink-strong">社区精选</Text>
        <Text className="text-base text-muted-brand">同城宠友</Text>
      </View>
      <View className="mt-compact rounded-card bg-white px-section py-note shadow-card">
        {communityItems.map((item) => (
          <View key={item.title} className="border-b border-solid border-border py-compact">
            <Text className="block text-base text-brand-strong">{item.author}</Text>
            <Text className="mt-note block text-description text-ink-strong">{item.title}</Text>
            <Text className="mt-note block text-base text-muted-brand">{item.meta}</Text>
          </View>
        ))}
      </View>

      {status === "authenticated" && user ? (
        <Button
          className="mt-section w-action self-center rounded-button border border-solid border-brand bg-white text-brand-strong"
          onClick={() => void logout().catch(() => undefined)}
        >
          退出登录
        </Button>
      ) : null}
    </View>
  );
}
