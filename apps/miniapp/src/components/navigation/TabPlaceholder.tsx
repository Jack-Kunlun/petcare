import { Icon, Text, View } from "@tarojs/components";

type PlaceholderIcon = "info" | "info_circle" | "waiting" | "search";

interface TabPlaceholderProps {
  title: string;
  description: string;
  icon?: PlaceholderIcon;
}

export default function TabPlaceholder({
  title,
  description,
  icon = "info_circle",
}: TabPlaceholderProps) {
  return (
    <View className="box-border flex min-h-screen flex-col items-center justify-center bg-surface px-section pb-safe-bottom">
      <View className="flex w-full flex-col items-center rounded-card bg-white px-section py-page shadow-card">
        <Icon type={icon} size={48} color="#4A6CF7" ariaLabel={title} />
        <Text className="mt-compact text-heading font-bold text-ink-strong">{title}</Text>
        <Text className="mt-note text-center text-description text-muted-brand">{description}</Text>
      </View>
    </View>
  );
}
