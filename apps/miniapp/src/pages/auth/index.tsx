import { Button, Text, View } from "@tarojs/components";
import Taro from "@tarojs/taro";
import { useRef, useState } from "react";
import { MiniappApiError } from "../../api/request";
import { useAuth } from "../../auth/auth.context";
import BrandLogo from "../../components/brand/BrandLogo";

interface PhoneNumberEvent {
  detail: {
    code?: string;
    errMsg?: string;
  };
}

export default function AuthPage() {
  const { login, bindPhone } = useAuth();
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

  const handleWechatLogin = async (event: PhoneNumberEvent): Promise<void> => {
    const phoneCode = event.detail.code;

    if (!phoneCode) {
      setError("需要授权手机号才能完成登录，请重试");

      return;
    }

    if (!beginRequest()) {
      return;
    }

    try {
      const result = await login();

      if (result.status === "phone_required") {
        await bindPhone(result.bindToken, phoneCode);
      }

      await completeLogin();
    } catch (requestError) {
      if (
        requestError instanceof MiniappApiError &&
        requestError.code === "AUTH_BIND_TOKEN_EXPIRED"
      ) {
        setError("登录状态已过期，请重新微信登录");
      } else if (requestError instanceof MiniappApiError) {
        setError(requestError.message);
      } else {
        setError("微信登录失败，请稍后重试");
      }
    } finally {
      endRequest();
    }
  };

  return (
    <View className="box-border flex min-h-screen flex-col items-center justify-center bg-surface-muted px-section py-page-y">
      <View className="flex w-full flex-col items-center">
        <BrandLogo label="PetCare 宠伴品牌 Logo" />
        <Text className="mt-compact text-subtitle font-semibold text-brand-strong">
          Trusted Pet Companion Platform
        </Text>
      </View>

      <View className="box-border mt-section w-full rounded-card bg-white px-section py-page shadow-card">
        <Text className="block text-heading font-bold text-ink-strong">登录 PetCare 宠伴</Text>
        <Text className="mt-note block text-description text-muted-brand">
          登录后可发布需求、接单并管理你的宠物服务。
        </Text>

        <Button
          className="mt-section rounded-button border-none bg-brand text-white"
          openType="getPhoneNumber"
          loading={pending}
          disabled={pending}
          onGetPhoneNumber={handleWechatLogin}
        >
          微信登录
        </Button>

        <Text className="mt-compact block text-center text-base text-muted-brand">
          我们会保护你的账号与宠物信息
        </Text>
        {error ? <Text className="mt-compact block text-base text-danger">{error}</Text> : null}
      </View>
    </View>
  );
}

async function completeLogin(): Promise<void> {
  await Taro.switchTab({ url: "/pages/index/index" });
}
