import { Injectable } from "@nestjs/common";
import { SmsSender } from "./sms-sender";

@Injectable()
export class DevelopmentSmsSender implements SmsSender {
  async sendCode(_phone: string, _code: string): Promise<void> {
    return Promise.resolve();
  }
}
