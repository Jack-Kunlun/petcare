import { Button, Text, View } from "@tarojs/components";
import Taro from "@tarojs/taro";
import { useRef, useState } from "react";
import { MiniappApiError } from "../../api/request";
import { useAuth } from "../../auth/auth.context";
import "./index.css";

interface PhoneNumberEvent {
  detail: {
    code?: string;
    errMsg?: string;
  };
}

export default function AuthPage() {
  const { login, bindPhone } = useAuth();
  const [bindToken, setBindToken] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const pendingRef = useRef(false);

  const beginRequest = (): boolean => {
    if (pendingRef.current) {
      return false;
    }

    pendingRef.current = true;
    setPending(true);
    setError("");

    return true;
  };

  const endRequest = (): void => {
    pendingRef.current = false;
    setPending(false);
  };

  const handleLogin = async (): Promise<void> => {
    if (!beginRequest()) {
      return;
    }

    try {
      const result = await login();

      if (result.status === "phone_required") {
        setBindToken(result.bindToken);
      } else {
        await completeLogin();
      }
    } catch {
      setError("微信登录失败，请稍后重试");
    } finally {
      endRequest();
    }
  };

  const handleGetPhoneNumber = async (event: PhoneNumberEvent): Promise<void> => {
    const phoneCode = event.detail.code;

    if (!phoneCode) {
      setError("需要授权手机号才能完成登录，请重试");

      return;
    }

    if (!bindToken || !beginRequest()) {
      return;
    }

    try {
      await bindPhone(bindToken, phoneCode);
      await completeLogin();
    } catch (requestError) {
      if (
        requestError instanceof MiniappApiError &&
        requestError.code === "AUTH_BIND_TOKEN_EXPIRED"
      ) {
        setBindToken(null);
        setError("登录状态已过期，请重新微信登录");
      } else {
        setError("手机号授权失败，请稍后重试");
      }
    } finally {
      endRequest();
    }
  };

  return (
    <View className="auth-page min-h-screen">
      <View className="auth-card">
        <Text className="auth-title">登录 PetCare 宠伴</Text>
        <Text className="auth-description">登录后可发布需求、接单并管理你的宠物服务。</Text>

        {bindToken ? (
          <Button
            className="auth-primary-button"
            openType="getPhoneNumber"
            loading={pending}
            disabled={pending}
            onGetPhoneNumber={handleGetPhoneNumber}
          >
            授权手机号并登录
          </Button>
        ) : (
          <Button
            className="auth-primary-button"
            loading={pending}
            disabled={pending}
            onClick={() => void handleLogin()}
          >
            微信登录
          </Button>
        )}

        {error ? <Text className="auth-error">{error}</Text> : null}
      </View>
    </View>
  );
}

async function completeLogin(): Promise<void> {
  if (Taro.getCurrentPages().length > 1) {
    await Taro.navigateBack();
  } else {
    await Taro.redirectTo({ url: "/pages/index/index" });
  }
}
