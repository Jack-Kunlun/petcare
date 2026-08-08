import { Button, Image, ScrollView, Text, View } from "@tarojs/components";
import type { HomeBounty } from "../home.data";

export interface BountySectionProps {
  items: readonly HomeBounty[];
  onViewAll(): void;
  onSelect(id: string): void;
}

export default function BountySection({ items, onViewAll, onSelect }: BountySectionProps) {
  return (
    <View>
      <View className="flex items-center justify-between">
        <Text className="text-welcome font-bold text-ink-strong">热门悬赏</Text>
        <Button
          className="border-none bg-transparent px-none text-base text-brand-strong"
          onClick={onViewAll}
        >
          查看全部悬赏
        </Button>
      </View>
      <ScrollView className="mt-compact w-full" scrollX enableFlex>
        <View className="flex gap-note">
          {items.map((item) => (
            <View
              key={item.id}
              className="box-border w-bounty-card shrink-0 rounded-card bg-white p-compact shadow-card"
              data-testid="bounty-card"
              onClick={() => onSelect(item.id)}
            >
              <View className="flex items-center">
                <Image
                  className="h-bounty-image w-bounty-image rounded-card object-cover"
                  src={item.image}
                  mode="aspectFill"
                  ariaLabel={`${item.petType}悬赏图片`}
                />
                <View className="ml-note flex flex-col">
                  <Text className="text-base font-semibold text-ink-strong">
                    {item.serviceType}
                  </Text>
                  <Text className="mt-tab-label text-base text-muted-brand">{item.petType}</Text>
                </View>
              </View>
              <Text className="mt-compact block text-base text-ink">{item.description}</Text>
              <View className="mt-compact flex items-center justify-between">
                <Text className="text-subtitle font-bold text-accent">{item.price}</Text>
                <Text className="text-base text-muted-brand">{item.distance}</Text>
              </View>
              <Text className="mt-note block text-base text-muted-brand">
                服务时长 {item.duration}
              </Text>
              {item.urgent ? (
                <Text className="mt-note block text-base font-semibold text-accent">紧急悬赏</Text>
              ) : null}
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}
