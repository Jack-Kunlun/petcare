export interface SessionPrincipal {
  userId: string;
  username: string | null;
  phone: string;
  roles: string[];
  sessionVersion: number;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface AccessTokenPayload {
  sub: string;
  sid: string;
  sessionVersion: number;
  username: string | null;
  phone: string;
  roles: string[];
  type: "access";
}

export interface RefreshTokenPayload {
  sub: string;
  sid: string;
  sessionVersion: number;
  type: "refresh";
}
