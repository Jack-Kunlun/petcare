import { createContext, useContext } from "react";
import { AdminUser, AuthStatus, CaptchaChallenge } from "./auth.types";

export interface AuthContextValue {
  status: AuthStatus;
  user: AdminUser | null;
  loginWithPassword(identifier: string, password: string): Promise<void>;
  loginWithSms(phone: string, code: string): Promise<void>;
  getCaptcha(): Promise<CaptchaChallenge>;
  sendSmsCode(phone: string, captchaId: string, captchaCode: string): Promise<void>;
  logout(): Promise<void>;
}

export const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }

  return context;
}
