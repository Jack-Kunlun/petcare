import { RedisService } from "./redis.service";

function createService(result: number) {
  const evalMock = jest.fn().mockResolvedValue(result);
  const service = Object.create(RedisService.prototype) as RedisService;

  Object.assign(service, { client: { eval: evalMock } });

  return { service, evalMock };
}

describe("RedisService one-time digest consumption", () => {
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
