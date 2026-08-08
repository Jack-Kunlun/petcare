import { Button, Image, Text, View } from "@tarojs/components";
import type { HomePost } from "../home.data";

export interface CommunitySectionProps {
  items: readonly HomePost[];
  onViewAll(): void;
  onSelect(id: string): void;
}

export default function CommunitySection({ items, onViewAll, onSelect }: CommunitySectionProps) {
  return (
    <View>
      <View className="flex items-center justify-between">
        <Text className="text-welcome font-bold text-ink-strong">社区精选</Text>
        <Button
          className="border-none bg-transparent px-none text-base text-brand-strong"
          onClick={onViewAll}
        >
          查看全部社区
        </Button>
      </View>
      <View className="mt-compact flex flex-col gap-compact">
        {items.map((item) => (
          <View
            key={item.id}
            className="rounded-card bg-white p-compact shadow-card"
            data-testid="community-card"
            onClick={() => onSelect(item.id)}
          >
            <View className="flex items-center">
              <Image
                className="h-avatar w-avatar rounded-full object-cover"
                src={item.authorAvatar}
                mode="aspectFill"
                ariaLabel={`${item.authorName}的头像`}
              />
              <View className="ml-note flex flex-col">
                <Text className="text-base font-semibold text-ink-strong">{item.authorName}</Text>
                <Text className="mt-tab-label text-base text-muted-brand">
                  {item.publishedAt} · {item.location}
                </Text>
              </View>
            </View>
            <Text className="mt-compact block text-description text-ink">{item.content}</Text>
            {item.image ? (
              <Image
                className="mt-compact h-community-media w-full rounded-card object-cover"
                src={item.image}
                mode="aspectFill"
                ariaLabel={`${item.authorName}分享的图片`}
              />
            ) : null}
            <Text className="mt-compact block text-base text-muted-brand">
              赞 {item.likes} · 评论 {item.comments}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}
