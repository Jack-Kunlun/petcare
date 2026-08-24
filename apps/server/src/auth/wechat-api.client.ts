import { HttpStatus, Injectable } from "@nestjs/common";
import { ApiException } from "../common/http/api-exception";
import { ConfigService } from "../config/config.service";

interface WechatLoginResponse {
  errcode?: number;
  openid?: string;
  session_key?: string;
}

const REQUEST_TIMEOUT_MS = 5_000;

@Injectable()
export class WechatApiClient {
  constructor(private readonly configService: ConfigService) {}

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

  private assertConfigured(): void {
    if (!this.configService.wechatAppId || !this.configService.wechatAppSecret) {
      throw this.upstreamUnavailable();
    }
  }

  private async requestJson<T>(url: URL): Promise<T> {
    let response: Response;

    try {
      response = await fetch(url.toString(), {
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
