import { MiniappUser, WechatLoginResult, WechatSession } from "@petcare/shared-types";
import Taro from "@tarojs/taro";
import {
  createContext,
  PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import * as authApi from "./auth.api";
import { clearStoredSession, restoreSession, saveStoredSession } from "./auth.session";

export type AuthStatus = "loading" | "guest" | "authenticated";

export interface AuthContextValue {
  status: AuthStatus;
  user: MiniappUser | null;
  login(): Promise<WechatLoginResult>;
  bindPhone(bindToken: string, phoneCode: string): Promise<void>;
  logout(): Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: PropsWithChildren) {
  const [status, setStatus] = useState<AuthStatus>("loading");
  const [session, setSession] = useState<WechatSession | null>(null);

  useEffect(() => {
    let mounted = true;

    void restoreSession().then((restoredSession) => {
      if (!mounted) {
        return;
      }

      setSession(restoredSession);
      setStatus(restoredSession ? "authenticated" : "guest");
    });

    return () => {
      mounted = false;
    };
  }, []);

  const login = useCallback(async (): Promise<WechatLoginResult> => {
    const result = await Taro.login();

    if (!result.code) {
      throw new Error("微信登录失败，请重试");
    }

    const loginResult = await authApi.loginWithWechat(result.code);

    if (loginResult.status === "authenticated") {
      const nextSession = toSession(loginResult);

      await saveStoredSession(nextSession);
      setSession(nextSession);
      setStatus("authenticated");
    }

    return loginResult;
  }, []);

  const bindPhone = useCallback(async (bindToken: string, phoneCode: string): Promise<void> => {
    const result = await authApi.bindWechatPhone(bindToken, phoneCode);
    const nextSession = toSession(result);

    await saveStoredSession(nextSession);
    setSession(nextSession);
    setStatus("authenticated");
  }, []);

  const logout = useCallback(async (): Promise<void> => {
    try {
      if (session) {
        await authApi.logoutWechatSession(session.refreshToken);
      }
    } finally {
      await clearStoredSession();
      setSession(null);
      setStatus("guest");
    }
  }, [session]);

  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      user: session?.user ?? null,
      login,
      bindPhone,
      logout,
    }),
    [bindPhone, login, logout, session?.user, status],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth 必须在 AuthProvider 内使用");
  }

  return context;
}

function toSession(result: WechatSession): WechatSession {
  return {
    accessToken: result.accessToken,
    refreshToken: result.refreshToken,
    user: result.user,
  };
}
