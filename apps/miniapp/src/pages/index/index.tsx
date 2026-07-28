import { Button, Text, View } from "@tarojs/components";
import Taro from "@tarojs/taro";
import { useAuth } from "../../auth/auth.context";
import "./index.css";

export default function Index() {
  const { status, user, logout } = useAuth();

  return (
    <View className="container">
      <Text className="title">PetCare宠伴</Text>
      <Text className="subtitle">双模式O2O宠物服务平台</Text>

      {status === "loading" ? <Text className="session-message">正在恢复登录状态…</Text> : null}

      {status === "guest" ? (
        <Button
          className="primary-button"
          onClick={() => void Taro.navigateTo({ url: "/pages/auth/index" })}
        >
          微信登录
        </Button>
      ) : null}

      {status === "authenticated" && user ? (
        <View className="user-card">
          <Text className="welcome">你好，{user.nickname}</Text>
          <Button className="secondary-button" onClick={() => void logout().catch(() => undefined)}>
            退出登录
          </Button>
        </View>
      ) : null}
    </View>
  );
}
