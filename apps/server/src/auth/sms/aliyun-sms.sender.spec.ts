import { AliyunSmsSender } from "./aliyun-sms.sender";

describe("AliyunSmsSender", () => {
  const phone = "13800138000";
  const code = "246810";

  it("maps the verification code to Aliyun SMS Authentication", async () => {
    const client = {
      sendSmsVerifyCode: jest.fn().mockResolvedValue({ body: { code: "OK" } }),
    };
    const sender = new AliyunSmsSender(client as never, "系统赠送签名", "100001", 300);

    await sender.sendCode(phone, code);

    expect(client.sendSmsVerifyCode).toHaveBeenCalledTimes(1);
    expect(client.sendSmsVerifyCode).toHaveBeenCalledWith(
      expect.objectContaining({
        phoneNumber: phone,
        signName: "系统赠送签名",
        templateCode: "100001",
        templateParam: JSON.stringify({ code, min: "5" }),
        validTime: 300,
        autoRetry: 0,
      }),
    );
  });

  it.each([
    [{ body: { code: "BUSINESS_LIMIT_CONTROL" } }, undefined],
    [undefined, new Error(`provider request contained ${phone} and ${code}`)],
  ])("returns one sanitized 503 without retrying", async (response, rejection) => {
    const client = {
      sendSmsVerifyCode: rejection
        ? jest.fn().mockRejectedValue(rejection)
        : jest.fn().mockResolvedValue(response),
    };
    const sender = new AliyunSmsSender(client as never, "系统赠送签名", "100001", 300);

    await expect(sender.sendCode(phone, code)).rejects.toMatchObject({
      code: "SMS_DELIVERY_FAILED",
      clientMessage: "短信发送失败，请稍后重试",
      status: 503,
    });
    expect(client.sendSmsVerifyCode).toHaveBeenCalledTimes(1);
  });
});
