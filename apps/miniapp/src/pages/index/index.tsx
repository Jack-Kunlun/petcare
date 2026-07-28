import { Button, Text, View } from "@tarojs/components";
import Taro from "@tarojs/taro";
import { useAuth } from "../../auth/auth.context";

export default function Index() {
  const { status, user, logout } = useAuth();

  return (
    <View className="box-border flex min-h-screen flex-col items-center justify-center p-page">
      <Text className="mb-compact text-hero font-bold text-ink">PetCare宠伴</Text>
      <Text className="text-subtitle text-muted">双模式O2O宠物服务平台</Text>

      {status === "loading" ? (
        <Text className="mt-section text-muted-brand">正在恢复登录状态…</Text>
      ) : null}

      {status === "guest" ? (
        <Button
          className="mt-section w-action rounded-button border-none bg-brand text-white"
          onClick={() => void Taro.navigateTo({ url: "/pages/auth/index" })}
        >
          微信登录
        </Button>
      ) : null}

      {status === "authenticated" && user ? (
        <View className="mt-section flex flex-col items-center">
          <Text className="text-welcome font-semibold text-ink-strong">你好，{user.nickname}</Text>
          <Button
            className="mt-section w-action rounded-button border border-solid border-brand bg-white text-brand-strong"
            onClick={() => void logout().catch(() => undefined)}
          >
            退出登录
          </Button>
        </View>
      ) : null}
    </View>
  );
}
