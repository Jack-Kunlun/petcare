import { Button, Image, Swiper, SwiperItem, Text, View } from "@tarojs/components";
import type { HomeBanner } from "../home.data";

interface HeroCarouselProps {
  /** 按展示顺序排列的首页品牌轮播项。 */
  banners: readonly HomeBanner[];
  /** 处理轮播主行动对应的 Tab 路径。 */
  onAction: (path: string) => void;
}

export default function HeroCarousel({ banners, onAction }: HeroCarouselProps) {
  return (
    <Swiper
      className="h-home-banner overflow-hidden rounded-card"
      autoplay
      circular
      interval={5000}
      indicatorDots
      indicatorColor="#FFFFFF99"
      indicatorActiveColor="#FFFFFF"
    >
      {banners.map((banner) => (
        <SwiperItem key={banner.id} data-testid="home-banner">
          <View className="relative h-full w-full overflow-hidden rounded-card bg-brand">
            <Image
              className="h-full w-full object-cover"
              src={banner.image}
              mode="aspectFill"
              ariaLabel={banner.title}
            />
            <View className="absolute top-overlay right-overlay bottom-overlay left-overlay flex flex-col justify-end bg-ink px-compact py-compact">
              <Text className="block text-subtitle font-bold text-white">{banner.title}</Text>
              <Text className="mt-tab-label block text-base text-white">{banner.subtitle}</Text>
              <Button
                className="mt-note h-control self-start rounded-button border-none bg-white px-compact text-base font-semibold text-brand-strong"
                hoverClass="opacity-80"
                onClick={() => onAction(banner.actionPath)}
              >
                {banner.actionLabel}
              </Button>
            </View>
          </View>
        </SwiperItem>
      ))}
    </Swiper>
  );
}
