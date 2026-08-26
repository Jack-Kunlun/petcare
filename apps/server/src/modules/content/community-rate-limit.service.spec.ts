import { COMMUNITY_RATE_LIMIT_ERROR_CODE } from "@petcare/shared-types";
import { CommunityRateLimitService } from "./community-rate-limit.service";

describe("CommunityRateLimitService", () => {
  const redis = { consumeFixedWindow: jest.fn() };
  const config = {
    communityPostMaxAttempts: 10,
    communityPostWindowSeconds: 3600,
    communityMediaMaxAttempts: 5,
    communityMediaWindowSeconds: 60,
  };
  const service = new CommunityRateLimitService(redis as never, config as never);

  beforeEach(() => jest.clearAllMocks());

  it("uses independent fixed windows for post and media writes", async () => {
    redis.consumeFixedWindow.mockResolvedValue(true);

    await service.assertPostCreateAllowed("user-1");
    await service.assertMediaUploadAllowed("user-1");

    expect(redis.consumeFixedWindow.mock.calls).toEqual([
      ["community:post:create:user-1", 10, 3600],
      ["community:media:upload:user-1", 5, 60],
    ]);
  });

  it.each([
    ["post", () => service.assertPostCreateAllowed("user-1"), "COMMUNITY_POST_RATE_LIMITED"],
    ["media", () => service.assertMediaUploadAllowed("user-1"), "COMMUNITY_MEDIA_RATE_LIMITED"],
  ])("returns a stable 429 when the %s window is exhausted", async (_label, operation, code) => {
    redis.consumeFixedWindow.mockResolvedValue(false);

    await expect(operation()).rejects.toMatchObject({ code, status: 429 });
  });

  it("fails closed with a stable 503 when Redis is unavailable", async () => {
    redis.consumeFixedWindow.mockRejectedValue(new Error("redis offline"));

    await expect(service.assertPostCreateAllowed("user-1")).rejects.toMatchObject({
      code: COMMUNITY_RATE_LIMIT_ERROR_CODE.UNAVAILABLE,
      status: 503,
    });
  });
});
