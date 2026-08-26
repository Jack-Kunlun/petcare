import { GUARDS_METADATA } from "@nestjs/common/constants";
import { AccessTokenGuard } from "../../auth/access-token.guard";
import { ProfileCompleteGuard } from "../../auth/profile-complete.guard";
import { CommunityMediaController } from "./community-media.controller";

describe("CommunityMediaController", () => {
  const media = { upload: jest.fn(), discard: jest.fn() };
  const controller = new CommunityMediaController(media as never);

  beforeEach(() => jest.clearAllMocks());

  it("requires an authenticated complete profile", () => {
    expect(Reflect.getMetadata("path", CommunityMediaController)).toBe("community/media-assets");
    expect(Reflect.getMetadata(GUARDS_METADATA, CommunityMediaController)).toEqual([
      AccessTokenGuard,
      ProfileCompleteGuard,
    ]);
  });

  it("uses the token subject as owner and rejects a missing multipart file", async () => {
    const file = {
      buffer: Buffer.from("image"),
      originalname: "pet.png",
      mimetype: "image/png",
    } as Express.Multer.File;
    const request = { user: { sub: "user-1" } } as never;

    media.upload.mockResolvedValue({ id: "asset-1" });

    await expect(controller.upload(file, request)).resolves.toMatchObject({ id: "asset-1" });
    expect(media.upload).toHaveBeenCalledWith("user-1", {
      buffer: file.buffer,
      originalName: "pet.png",
      mimeType: "image/png",
    });
    expect(() => controller.upload(undefined, request)).toThrow("请选择要上传的社区图片");
  });

  it("discards media only for the token subject", async () => {
    media.discard.mockResolvedValue(undefined);

    await expect(
      controller.discard("00000000-0000-4000-8000-000000000001", {
        user: { sub: "user-1" },
      } as never),
    ).resolves.toBeUndefined();
    expect(media.discard).toHaveBeenCalledWith("user-1", "00000000-0000-4000-8000-000000000001");
  });
});
