import { beforeEach, describe, expect, it, vi } from "vitest";
import { logoutWechatSession } from "./auth";
import { rawRequest } from "./request";

vi.mock("./request", () => ({ rawRequest: vi.fn() }));

const rawRequestMock = vi.mocked(rawRequest);

describe("miniapp auth API", () => {
  beforeEach(() => vi.clearAllMocks());

  it("posts the current refresh token to revoke this device session", async () => {
    rawRequestMock.mockResolvedValue(undefined);

    await logoutWechatSession("refresh-token");

    expect(rawRequestMock).toHaveBeenCalledWith("/auth/wechat/logout", {
      method: "POST",
      data: { refreshToken: "refresh-token" },
    });
  });
});
