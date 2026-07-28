import { RedisService } from "./redis.service";

function createService(result: number) {
  const evalMock = jest.fn().mockResolvedValue(result);
  const service = Object.create(RedisService.prototype) as RedisService;

  Object.assign(service, { client: { eval: evalMock } });

  return { service, evalMock };
}

describe("RedisService one-time digest consumption", () => {
  it("gets and deletes a short-lived value atomically", async () => {
    const getDelMock = jest.fn().mockResolvedValue("openid-1");
    const service = Object.create(RedisService.prototype) as RedisService;

    Object.assign(service, { client: { getDel: getDelMock } });

    await expect(service.getAndDelete("auth:wechat-bind:digest")).resolves.toBe("openid-1");
    expect(getDelMock).toHaveBeenCalledWith("auth:wechat-bind:digest");
  });

  it("passes keys and digest limits to the atomic Redis script", async () => {
    const { service, evalMock } = createService(1);

    await expect(
      service.verifyAndConsumeDigest("captcha:value", "captcha:attempts", "digest", 5),
    ).resolves.toBe(true);
    expect(evalMock).toHaveBeenCalledWith(expect.any(String), {
      keys: ["captcha:value", "captcha:attempts"],
      arguments: ["digest", "5"],
    });
  });

  it("returns false when Redis rejects the supplied digest", async () => {
    const { service } = createService(0);

    await expect(
      service.verifyAndConsumeDigest("captcha:value", "captcha:attempts", "wrong", 5),
    ).resolves.toBe(false);
  });
});
