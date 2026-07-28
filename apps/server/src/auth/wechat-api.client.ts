import { HttpStatus, Injectable } from "@nestjs/common";
import { ApiException } from "../common/http/api-exception";
import { ConfigService } from "../config/config.service";
import { RedisService } from "../config/redis.service";

interface WechatLoginResponse {
  errcode?: number;
  openid?: string;
  session_key?: string;
}

interface WechatAccessTokenResponse {
  errcode?: number;
  access_token?: string;
  expires_in?: number;
}

interface WechatPhoneResponse {
  errcode?: number;
  phone_info?: {
    purePhoneNumber?: string;
  };
}

const ACCESS_TOKEN_CACHE_KEY = "auth:wechat:access-token";
const REQUEST_TIMEOUT_MS = 5_000;

@Injectable()
export class WechatApiClient {
  constructor(
    private readonly configService: ConfigService,
    private readonly redisService: RedisService,
  ) {}

  async exchangeLoginCode(loginCode: string): Promise<{ openid: string; sessionKey: string }> {
    this.assertConfigured();

    const url = new URL("https://api.weixin.qq.com/sns/jscode2session");

    url.searchParams.set("appid", this.configService.wechatAppId);
    url.searchParams.set("secret", this.configService.wechatAppSecret);
    url.searchParams.set("js_code", loginCode);
    url.searchParams.set("grant_type", "authorization_code");

    const response = await this.requestJson<WechatLoginResponse>(url);

    if (response.errcode || !response.openid || !response.session_key) {
      throw new ApiException(
        "AUTH_WECHAT_LOGIN_FAILED",
        "微信登录凭证无效，请重试",
        HttpStatus.UNAUTHORIZED,
      );
    }

    return {
      openid: response.openid,
      sessionKey: response.session_key,
    };
  }

  async getPhoneNumber(phoneCode: string): Promise<string> {
    const accessToken = await this.getAccessToken();
    const url = new URL("https://api.weixin.qq.com/wxa/business/getuserphonenumber");

    url.searchParams.set("access_token", accessToken);

    const response = await this.requestJson<WechatPhoneResponse>(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ code: phoneCode }),
    });
    const phone = response.phone_info?.purePhoneNumber;

    if (response.errcode || !phone) {
      throw new ApiException(
        "AUTH_PHONE_AUTH_FAILED",
        "手机号授权失败，请重试",
        HttpStatus.BAD_REQUEST,
      );
    }

    return phone;
  }

  private async getAccessToken(): Promise<string> {
    this.assertConfigured();

    const cachedToken = await this.redisService.get(ACCESS_TOKEN_CACHE_KEY);

    if (cachedToken) {
      return cachedToken;
    }

    const url = new URL("https://api.weixin.qq.com/cgi-bin/token");

    url.searchParams.set("grant_type", "client_credential");
    url.searchParams.set("appid", this.configService.wechatAppId);
    url.searchParams.set("secret", this.configService.wechatAppSecret);

    const response = await this.requestJson<WechatAccessTokenResponse>(url);

    if (
      response.errcode ||
      !response.access_token ||
      !response.expires_in ||
      response.expires_in <= 0
    ) {
      throw this.upstreamUnavailable();
    }

    await this.redisService.set(
      ACCESS_TOKEN_CACHE_KEY,
      response.access_token,
      Math.max(response.expires_in - 60, 1),
    );

    return response.access_token;
  }

  private assertConfigured(): void {
    if (!this.configService.wechatAppId || !this.configService.wechatAppSecret) {
      throw this.upstreamUnavailable();
    }
  }

  private async requestJson<T>(url: URL, init?: RequestInit): Promise<T> {
    let response: Response;

    try {
      response = await fetch(url.toString(), {
        ...init,
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
    } catch {
      throw this.upstreamUnavailable();
    }

    if (!response.ok) {
      throw this.upstreamUnavailable();
    }

    try {
      return (await response.json()) as T;
    } catch {
      throw this.upstreamUnavailable();
    }
  }

  private upstreamUnavailable(): ApiException {
    return new ApiException(
      "WECHAT_SERVICE_UNAVAILABLE",
      "微信服务暂时不可用，请稍后重试",
      HttpStatus.SERVICE_UNAVAILABLE,
    );
  }
}
