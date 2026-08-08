import { Button, Image, Text, View } from "@tarojs/components";
import type { HomeArticle } from "../home.data";

export interface ClassroomSectionProps {
  items: readonly HomeArticle[];
  onViewAll(): void;
  onSelect(id: string): void;
}

export default function ClassroomSection({ items, onViewAll, onSelect }: ClassroomSectionProps) {
  return (
    <View>
      <View className="flex items-center justify-between">
        <Text className="text-welcome font-bold text-ink-strong">养宠小课堂</Text>
        <Button
          className="border-none bg-transparent px-none text-base text-brand-strong"
          onClick={onViewAll}
        >
          查看全部课堂
        </Button>
      </View>
      <View className="mt-compact rounded-card bg-white px-section py-note shadow-card">
        {items.map((item) => (
          <View
            key={item.id}
            className="flex border-b border-solid border-border py-compact"
            data-testid="classroom-card"
            onClick={() => onSelect(item.id)}
          >
            <Image
              className="h-article-image w-article-image shrink-0 rounded-card object-cover"
              src={item.image}
              mode="aspectFill"
              ariaLabel={`${item.title}缩略图`}
            />
            <View className="ml-compact flex flex-1 flex-col justify-center">
              <Text className="text-base text-brand-strong">{item.category}</Text>
              <Text className="mt-note text-description font-semibold text-ink-strong">
                {item.title}
              </Text>
              <Text className="mt-note text-base text-muted-brand">
                {item.views} 人阅读 · {item.publishDate}
              </Text>
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}
