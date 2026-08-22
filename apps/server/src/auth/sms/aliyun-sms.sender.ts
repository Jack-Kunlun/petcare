import Dypnsapi20170525, * as $Dypnsapi20170525 from "@alicloud/dypnsapi20170525";
import { HttpStatus, Injectable } from "@nestjs/common";
import { ApiException } from "../../common/http/api-exception";
import { SmsSender } from "./sms-sender";

type AliyunSmsClient = Pick<Dypnsapi20170525, "sendSmsVerifyCode">;

@Injectable()
export class AliyunSmsSender implements SmsSender {
  constructor(
    private readonly client: AliyunSmsClient,
    private readonly signName: string,
    private readonly templateCode: string,
    private readonly codeTtlSeconds: number,
  ) {}

  async sendCode(phone: string, code: string): Promise<void> {
    try {
      const response = await this.client.sendSmsVerifyCode(
        new $Dypnsapi20170525.SendSmsVerifyCodeRequest({
          autoRetry: 0,
          phoneNumber: phone,
          signName: this.signName,
          templateCode: this.templateCode,
          templateParam: JSON.stringify({
            code,
            min: String(Math.ceil(this.codeTtlSeconds / 60)),
          }),
          validTime: this.codeTtlSeconds,
        }),
      );

      if (response.body?.code !== "OK") {
        throw new Error("Aliyun SMS rejected the request");
      }
    } catch {
      throw new ApiException(
        "SMS_DELIVERY_FAILED",
        "短信发送失败，请稍后重试",
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
  }
}
