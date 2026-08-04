import {
  Button,
  Icon,
  Image,
  ScrollView,
  Swiper,
  SwiperItem,
  Text,
  View,
} from "@tarojs/components";
import Taro from "@tarojs/taro";
import heroCommunity from "../../assets/brand/hero-community-companion-miniapp-v1.png";
import heroProfessional from "../../assets/brand/hero-professional-care-miniapp-v1.png";
import heroTrusted from "../../assets/brand/hero-trusted-care-miniapp-v1.png";
import { useAuth } from "../../auth/auth.context";
import BrandLogo from "../../components/brand/BrandLogo";

const heroSlides = [
  {
    image: heroTrusted,
    title: "每一次托付，都值得信赖",
    subtitle: "透明记录每一次照护，让你安心出发。",
    action: "发布照护需求",
  },
  {
    image: heroProfessional,
    title: "专业服务，安心可见",
    subtitle: "从到达到完成，服务进度清晰可追踪。",
    action: "了解服务流程",
  },
  {
    image: heroCommunity,
    title: "和同城宠友一起成长",
    subtitle: "分享养宠经验，也找到值得信赖的伙伴。",
    action: "探索宠物社区",
  },
] as const;

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

function getGreeting(): string {
  const hour = new Date().getHours();

  if (hour < 6) {
    return "夜深了";
  }

  if (hour < 12) {
    return "早上好";
  }

  if (hour < 18) {
    return "下午好";
  }

  return "晚上好";
}

export default function Index() {
  const { status, user, logout } = useAuth();
  const nickname = user?.nickname ?? "宠伴朋友";

  return (
    <View className="box-border min-h-screen bg-surface p-page pb-safe-bottom">
      <View className="flex items-center justify-between">
        <View className="flex items-center">
          <BrandLogo variant="symbol" label="PetCare 宠伴" />
          <View className="ml-note flex flex-col">
            <Text className="text-base text-muted-brand">{getGreeting()}</Text>
            <Text className="text-welcome font-bold text-ink-strong">{nickname}</Text>
          </View>
        </View>
        <Button
          className="flex h-logo-md w-logo-md items-center justify-center rounded-full border border-solid border-border bg-white p-none"
          aria-label="打开消息"
          onClick={() => void Taro.navigateTo({ url: "/pages/messages/index" })}
        >
          <Icon type="info" size={22} color="#4A6CF7" ariaLabel="消息" />
        </Button>
      </View>

      <Text className="mt-section block text-subtitle font-semibold text-ink-strong">
        PetCare宠伴
      </Text>
      <Text className="mt-note block text-base text-muted-brand">可信赖的宠物生活服务平台</Text>

      <Swiper
        className="mt-section h-hero-height overflow-hidden rounded-card"
        autoplay
        circular
        interval={5000}
        indicatorDots
        indicatorColor="#FFFFFF99"
        indicatorActiveColor="#FFFFFF"
      >
        {heroSlides.map((slide) => (
          <SwiperItem key={slide.title}>
            <View className="relative h-full w-full overflow-hidden rounded-card bg-brand">
              <Image
                className="h-full w-full object-cover"
                src={slide.image}
                mode="aspectFill"
                ariaLabel={slide.title}
              />
              <View className="absolute top-overlay right-overlay bottom-overlay left-overlay flex flex-col justify-end bg-ink px-section py-compact">
                <Text className="block text-subtitle font-bold text-white">{slide.title}</Text>
                <Text className="mt-note block text-base text-white">{slide.subtitle}</Text>
                <Button
                  className="mt-note self-start rounded-button border-none bg-white px-compact text-base font-semibold text-brand-strong"
                  onClick={() => void Taro.navigateTo({ url: "/pages/bounty/index" })}
                >
                  {slide.action}
                </Button>
              </View>
            </View>
          </SwiperItem>
        ))}
      </Swiper>

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
