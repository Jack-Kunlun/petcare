export interface AdminUser {
  id: string;
  username: string | null;
  phone: string;
  nickname: string;
  roles: string[];
}

export type AuthStatus = "loading" | "authenticated" | "anonymous";

export interface LoginResponse {
  accessToken: string;
  user: AdminUser;
}

export interface RefreshResponse {
  accessToken: string;
}

export interface CaptchaChallenge {
  captchaId: string;
  image: string;
  expiresIn: number;
}
