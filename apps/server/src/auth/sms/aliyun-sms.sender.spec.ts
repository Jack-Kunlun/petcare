import { AliyunSmsSender } from "./aliyun-sms.sender";

describe("AliyunSmsSender", () => {
  const phone = "13800138000";
  const code = "246810";

  it("maps the approved code parameter and accepts only an OK response", async () => {
    const client = { sendSms: jest.fn().mockResolvedValue({ body: { code: "OK" } }) };
    const sender = new AliyunSmsSender(client as never, "宠伴", "SMS_123456789");

    await sender.sendCode(phone, code);

    expect(client.sendSms).toHaveBeenCalledTimes(1);
    expect(client.sendSms).toHaveBeenCalledWith(
      expect.objectContaining({
        phoneNumbers: phone,
        signName: "宠伴",
        templateCode: "SMS_123456789",
        templateParam: JSON.stringify({ code }),
      }),
    );
  });

  it.each([
    [{ body: { code: "isv.BUSINESS_LIMIT_CONTROL" } }, undefined],
    [undefined, new Error(`provider request contained ${phone} and ${code}`)],
  ])("returns one sanitized 503 without retrying", async (response, rejection) => {
    const client = {
      sendSms: rejection
        ? jest.fn().mockRejectedValue(rejection)
        : jest.fn().mockResolvedValue(response),
    };
    const sender = new AliyunSmsSender(client as never, "宠伴", "SMS_123456789");

    await expect(sender.sendCode(phone, code)).rejects.toMatchObject({
      code: "SMS_DELIVERY_FAILED",
      clientMessage: "短信发送失败，请稍后重试",
      status: 503,
    });
    expect(client.sendSms).toHaveBeenCalledTimes(1);
  });
});
