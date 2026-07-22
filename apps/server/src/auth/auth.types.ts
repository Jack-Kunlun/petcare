export interface AdminPrincipal {
  userId: string;
  username: string | null;
  phone: string;
  roles: string[];
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface AccessTokenPayload {
  sub: string;
  username: string | null;
  phone: string;
  roles: string[];
  type: "access";
}

export interface RefreshTokenPayload {
  sub: string;
  sid: string;
  type: "refresh";
}
