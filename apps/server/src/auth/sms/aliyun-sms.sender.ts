import Dysmsapi20170525, * as $Dysmsapi20170525 from "@alicloud/dysmsapi20170525";
import { HttpStatus, Injectable } from "@nestjs/common";
import { ApiException } from "../../common/http/api-exception";
import { SmsSender } from "./sms-sender";

type AliyunSmsClient = Pick<Dysmsapi20170525, "sendSms">;

@Injectable()
export class AliyunSmsSender implements SmsSender {
  constructor(
    private readonly client: AliyunSmsClient,
    private readonly signName: string,
    private readonly templateCode: string,
  ) {}

  async sendCode(phone: string, code: string): Promise<void> {
    try {
      const response = await this.client.sendSms(
        new $Dysmsapi20170525.SendSmsRequest({
          phoneNumbers: phone,
          signName: this.signName,
          templateCode: this.templateCode,
          templateParam: JSON.stringify({ code }),
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
