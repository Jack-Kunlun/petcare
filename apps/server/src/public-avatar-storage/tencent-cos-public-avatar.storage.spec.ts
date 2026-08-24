import { ConfigService } from "../config/config.service";
import { AppLogger } from "../logging/app-logger.service";
import { TencentCosPublicAvatarStorage } from "./tencent-cos-public-avatar.storage";

describe("TencentCosPublicAvatarStorage", () => {
  const pngBuffer = Buffer.from("png-avatar");
  const config = {
    tencentCosBucket: "petcare-avatar-1250000000",
    tencentCosRegion: "ap-guangzhou",
    tencentCosPublicBaseUrl: "",
  } as ConfigService;
  const cos = {
    putObject: jest.fn(),
    deleteObject: jest.fn(),
  };
  const logger = { write: jest.fn() } as unknown as AppLogger;
  let storage: TencentCosPublicAvatarStorage;

  beforeEach(() => {
    jest.resetAllMocks();
    cos.putObject.mockImplementation((_params, callback) => callback(null, {}));
    cos.deleteObject.mockImplementation((_params, callback) => callback(null, {}));
    storage = new TencentCosPublicAvatarStorage(cos as never, config, logger);
  });

  it.each(["admin-avatars", "user-avatars"] as const)(
    "uploads to the server-owned public %s key and returns the COS public URL",
    async (scope) => {
      const result = await storage.upload({
        scope,
        userId: "user-1",
        body: pngBuffer,
        contentType: "image/png",
        extension: "png",
      });

      expect(cos.putObject).toHaveBeenCalledWith(
        expect.objectContaining({
          Bucket: "petcare-avatar-1250000000",
          Region: "ap-guangzhou",
          Key: expect.stringMatching(new RegExp(`^public/${scope}/user-1/[0-9a-f-]+\\.png$`)),
          Body: pngBuffer,
          ContentType: "image/png",
        }),
        expect.any(Function),
      );
      expect(result.publicUrl).toBe(
        `https://petcare-avatar-1250000000.cos.ap-guangzhou.myqcloud.com/${result.objectKey}`,
      );
    },
  );

  it("uses a configured public base URL without duplicate slashes", async () => {
    const customConfig = {
      ...config,
      tencentCosPublicBaseUrl: "https://cdn.example.com/public-assets///",
    } as ConfigService;
    const customStorage = new TencentCosPublicAvatarStorage(cos as never, customConfig, logger);

    const result = await customStorage.upload({
      scope: "admin-avatars",
      userId: "user-1",
      body: pngBuffer,
      contentType: "image/png",
      extension: "png",
    });

    expect(result.publicUrl).toBe(`https://cdn.example.com/public-assets/${result.objectKey}`);
  });

  it("deletes a stored public avatar object", async () => {
    await storage.delete("public/admin-avatars/user-1/avatar.png");

    expect(cos.deleteObject).toHaveBeenCalledWith(
      {
        Bucket: "petcare-avatar-1250000000",
        Region: "ap-guangzhou",
        Key: "public/admin-avatars/user-1/avatar.png",
      },
      expect.any(Function),
    );
  });

  it("maps COS upload failures to a stable 503 and logs only the COS request ID", async () => {
    cos.putObject.mockImplementation((_params, callback) =>
      callback({ RequestId: "cos-request-id", message: "upstream detail" }),
    );

    await expect(
      storage.upload({
        scope: "admin-avatars",
        userId: "user-1",
        body: pngBuffer,
        contentType: "image/png",
        extension: "png",
      }),
    ).rejects.toMatchObject({ code: "STORAGE_UNAVAILABLE", status: 503 });
    expect(logger.write).toHaveBeenCalledWith("error", "public_avatar_storage.upload_failed", {
      cosRequestId: "cos-request-id",
    });
  });

  it("maps COS delete failures to a stable 503 and logs only the COS request ID", async () => {
    cos.deleteObject.mockImplementation((_params, callback) =>
      callback({ RequestId: "cos-request-id", message: "upstream detail" }),
    );

    await expect(storage.delete("public/admin-avatars/user-1/avatar.png")).rejects.toMatchObject({
      code: "STORAGE_UNAVAILABLE",
      status: 503,
    });
    expect(logger.write).toHaveBeenCalledWith("error", "public_avatar_storage.delete_failed", {
      cosRequestId: "cos-request-id",
    });
  });
});
