import { View } from "@tarojs/components";
import Taro from "@tarojs/taro";
import { useAuth } from "../../auth/auth.context";
import StatusBarSpacer from "../../components/layout/StatusBarSpacer";
import BountySection from "./components/BountySection";
import ClassroomSection from "./components/ClassroomSection";
import CommunitySection from "./components/CommunitySection";
import HeroCarousel from "./components/HeroCarousel";
import HomeHeader from "./components/HomeHeader";
import ServiceOverview from "./components/ServiceOverview";
import {
  HOME_ARTICLES,
  HOME_BANNERS,
  HOME_BOUNTIES,
  HOME_ONGOING_SERVICE,
  HOME_POSTS,
} from "./home.data";

function switchTab(url: string): void {
  void Taro.switchTab({ url });
}

export default function Index() {
  const { status, user } = useAuth();
  const nickname = user?.nickname ?? "宠伴朋友";

  return (
    <View
      className="box-border min-h-screen bg-surface px-page-x pb-safe-bottom"
      data-testid="home-page"
    >
      <StatusBarSpacer />
      <View data-testid="home-section-header">
        <HomeHeader
          nickname={nickname}
          avatar={user?.avatar ?? null}
          location="上海市 · 静安区"
          hasUnread
          onMessages={() => switchTab("/pages/messages/index")}
        />
      </View>
      <View className="mt-compact" data-testid="home-section-hero">
        <HeroCarousel banners={HOME_BANNERS} onAction={switchTab} />
      </View>
      <View className="mt-section" data-testid="home-section-service">
        <ServiceOverview
          status={status}
          service={status === "authenticated" ? HOME_ONGOING_SERVICE : null}
          onLogin={() => void Taro.navigateTo({ url: "/pages/auth/index" })}
          onPublish={() => switchTab("/pages/bounty/index")}
          onViewService={() => undefined}
          onContact={() => undefined}
        />
      </View>
      <View className="mt-section" data-testid="home-section-bounty">
        <BountySection
          items={HOME_BOUNTIES}
          onViewAll={() => switchTab("/pages/bounty/index")}
          onSelect={() => undefined}
        />
      </View>
      <View className="mt-section" data-testid="home-section-classroom">
        <ClassroomSection
          items={HOME_ARTICLES}
          onViewAll={() => undefined}
          onSelect={() => undefined}
        />
      </View>
      <View className="mt-section" data-testid="home-section-community">
        <CommunitySection
          items={HOME_POSTS}
          onViewAll={() => switchTab("/pages/community/index")}
          onSelect={() => undefined}
        />
      </View>
    </View>
  );
}
