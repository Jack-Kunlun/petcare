import type { ConfigService } from "../config/config.service";

export const REFRESH_COOKIE = "petcare_refresh_token";

export function refreshCookieOptions(config: ConfigService) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: config.nodeEnv === "production",
    path: "/api/auth",
  };
}
