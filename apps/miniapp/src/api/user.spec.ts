import { beforeEach, describe, expect, it, vi } from "vitest";
import { authorizedRequest, authorizedUpload } from "../state/session";
import { bindPhone, getProfile, sendPhoneCode, updateProfile, uploadAvatar } from "./user";

vi.mock("../state/session", () => ({
  authorizedRequest: vi.fn(),
  authorizedUpload: vi.fn(),
}));

const authorizedRequestMock = vi.mocked(authorizedRequest);
const authorizedUploadMock = vi.mocked(authorizedUpload);

describe("miniapp user API", () => {
  beforeEach(() => vi.clearAllMocks());

  it("uses the authenticated current-user endpoints", async () => {
    authorizedRequestMock.mockResolvedValue({ id: "user-1" });
    authorizedUploadMock.mockResolvedValue({ id: "user-1" });
    const profile = { nickname: "宠友123456", region: "上海", bio: null };

    await getProfile();
    await updateProfile(profile);
    await uploadAvatar("wxfile://avatar.png");
    await sendPhoneCode("13800138000");
    await bindPhone("13800138000", "123456");

    expect(authorizedRequestMock.mock.calls).toEqual([
      ["/users/me"],
      ["/users/me", { method: "PATCH", data: profile }],
      ["/users/me/phone/code", { method: "POST", data: { phone: "13800138000" } }],
      ["/users/me/phone", { method: "PUT", data: { phone: "13800138000", code: "123456" } }],
    ]);
    expect(authorizedUploadMock).toHaveBeenCalledWith(
      "/users/me/avatar",
      "wxfile://avatar.png",
      "file",
    );
  });
});
