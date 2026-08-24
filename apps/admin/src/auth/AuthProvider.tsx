import { ReactNode, useCallback, useEffect, useMemo, useState } from "react";
import * as authApi from "../api/auth";
import { showApiError, showGlobalError } from "../lib/global-error";
import { AuthContext, AuthContextValue } from "./auth.context";
import { AdminUser, AuthStatus } from "./auth.types";
import { onSessionExpired } from "./session-expired";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>("loading");
  const [user, setUser] = useState<AdminUser | null>(null);

  const invalidateLocalSession = useCallback(() => {
    authApi.clearAccessToken();
    setUser(null);
    setStatus("anonymous");
  }, []);

  useEffect(() => {
    let active = true;

    async function restoreSession() {
      try {
        const session = await authApi.refreshSession();

        authApi.setAccessToken(session.accessToken);
        const currentUser = await authApi.getCurrentUser();

        if (active) {
          setUser(currentUser);
          setStatus("authenticated");
        }
      } catch {
        authApi.clearAccessToken();

        if (active) {
          setUser(null);
          setStatus("anonymous");
        }
      }
    }

    void restoreSession();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (status !== "authenticated") {
      return;
    }

    return onSessionExpired((message) => {
      invalidateLocalSession();
      showGlobalError(message, "session");
    });
  }, [invalidateLocalSession, status]);

  const loginWithPassword = useCallback(async (identifier: string, password: string) => {
    const result = await authApi.loginWithPassword(identifier, password);

    setUser(result.user);
    setStatus("authenticated");
  }, []);

  const loginWithSms = useCallback(async (phone: string, code: string) => {
    const result = await authApi.loginWithSms(phone, code);

    setUser(result.user);
    setStatus("authenticated");
  }, []);

  const getCaptcha = useCallback(() => authApi.getCaptcha(), []);

  const sendSmsCode = useCallback(
    (phone: string, captchaId: string, captchaCode: string) =>
      authApi.sendSmsCode(phone, captchaId, captchaCode),
    [],
  );

  const logout = useCallback(async () => {
    try {
      await authApi.logout();
    } catch (error) {
      showApiError(error);
    } finally {
      invalidateLocalSession();
    }
  }, [invalidateLocalSession]);

  const updateUserSummary = useCallback((patch: Pick<AdminUser, "nickname" | "avatar">) => {
    setUser((current) => (current ? { ...current, ...patch } : current));
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      user,
      loginWithPassword,
      loginWithSms,
      getCaptcha,
      sendSmsCode,
      logout,
      updateUserSummary,
      invalidateLocalSession,
    }),
    [
      status,
      user,
      loginWithPassword,
      loginWithSms,
      getCaptcha,
      sendSmsCode,
      logout,
      updateUserSummary,
      invalidateLocalSession,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
