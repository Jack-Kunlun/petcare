import { Button, Text, View } from "@tarojs/components";
import Taro from "@tarojs/taro";
import { useRef, useState } from "react";
import { MiniappApiError } from "../../api/request";
import { useAuth } from "../../auth/auth.context";
import BrandLogo from "../../components/brand/BrandLogo";
import StatusBarSpacer from "../../components/layout/StatusBarSpacer";

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
    <View className="box-border flex min-h-screen flex-col bg-linear-to-b from-surface-brand to-surface px-page-x pb-page-y">
      <StatusBarSpacer />
      <View className="flex h-auth-visual flex-col items-center justify-center animate-page-enter">
        <BrandLogo label="PetCare 宠伴品牌 Logo" />
        <Text className="mt-compact block text-welcome font-bold text-ink-strong">
          让每一次托付，都安心可见
        </Text>
        <Text className="mt-note block text-center text-base text-muted-brand">
          可信赖的宠物生活服务平台
        </Text>
      </View>

      <View
        className="box-border min-h-auth-card w-full rounded-panel bg-white px-section py-page shadow-panel animate-page-enter"
        data-testid="auth-card"
      >
        <Text className="block text-heading font-bold text-ink-strong">欢迎来到 PetCare 宠伴</Text>
        <Text className="mt-note block text-description text-muted-brand">微信手机号快捷登录</Text>

        <Button
          className="mt-section h-control rounded-button border-none bg-brand text-white"
          hoverClass="opacity-80"
          openType="getPhoneNumber"
          loading={pending}
          disabled={pending}
          onGetPhoneNumber={handleWechatLogin}
        >
          微信登录
        </Button>

        <View className="mt-note min-h-feedback">
          {error ? <Text className="block text-base text-danger">{error}</Text> : null}
        </View>
        <Text className="mt-compact block text-center text-base text-muted-brand">
          登录即代表你同意授权必要的微信账户与手机号信息
        </Text>
      </View>
    </View>
  );
}

async function completeLogin(): Promise<void> {
  await Taro.switchTab({ url: "/pages/index/index" });
}
