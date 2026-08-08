import { Button, Icon, Image, Text, View } from "@tarojs/components";

interface HomeHeaderProps {
  /** 当前用户的展示昵称。 */
  nickname: string;
  /** 当前用户头像；缺失时显示昵称首字。 */
  avatar: string | null;
  /** 当前用户所在位置。 */
  location: string;
  /** 是否显示未读消息标记。 */
  hasUnread: boolean;
  /** 打开消息 Tab 的回调。 */
  onMessages: () => void;
}

export function getGreeting(now = new Date()): string {
  const hour = now.getHours();

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

export default function HomeHeader({
  nickname,
  avatar,
  location,
  hasUnread,
  onMessages,
}: HomeHeaderProps) {
  return (
    <View className="flex items-center justify-between">
      <View className="flex items-center">
        {avatar ? (
          <Image
            className="h-logo-md w-logo-md rounded-full object-cover"
            src={avatar}
            mode="aspectFill"
            ariaLabel={`${nickname}的头像`}
          />
        ) : (
          <View className="flex h-logo-md w-logo-md items-center justify-center rounded-full bg-surface-brand">
            <Text className="text-subtitle font-bold text-brand-strong">
              {nickname.slice(0, 1)}
            </Text>
          </View>
        )}
        <View className="ml-note flex flex-col">
          <Text className="text-base text-muted-brand">{getGreeting()}</Text>
          <Text className="mt-tab-label text-welcome font-bold text-ink-strong">{nickname}</Text>
          <Text className="mt-tab-label text-base text-muted-brand">{location}</Text>
        </View>
      </View>
      <View className="relative">
        <Button
          className="flex h-logo-md w-logo-md items-center justify-center rounded-full border border-solid border-border bg-white p-none"
          aria-label="打开消息"
          hoverClass="opacity-80"
          onClick={onMessages}
        >
          <Icon className="text-brand" type="info" size={22} ariaLabel="消息" />
        </Button>
        {hasUnread ? (
          <View className="absolute right-overlay top-overlay h-note w-note rounded-full bg-accent" />
        ) : null}
      </View>
    </View>
  );
}
