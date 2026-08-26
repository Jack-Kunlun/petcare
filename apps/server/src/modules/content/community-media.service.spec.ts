import { COMMUNITY_MEDIA_ERROR_CODE, COMMUNITY_MEDIA_STATUS } from "@petcare/shared-types";
import { CommunityMediaService } from "./community-media.service";

const PNG_32X32 = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
  "base64",
);

PNG_32X32.writeUInt32BE(32, 16);
PNG_32X32.writeUInt32BE(32, 20);

describe("CommunityMediaService", () => {
  const prisma = {
    communityMediaAsset: {
      create: jest.fn(),
      findUnique: jest.fn(),
      updateMany: jest.fn(),
    },
  };
  const storage = {
    put: jest.fn(),
    delete: jest.fn(),
  };
  const service = new CommunityMediaService(prisma as never, storage as never);
  const file = {
    buffer: PNG_32X32,
    originalName: "pet.png",
    mimeType: "image/jpeg",
  };

  beforeEach(() => {
    jest.clearAllMocks();
    storage.put.mockResolvedValue({
      storageKey: "public/community-media/2026/08/asset.png",
      publicUrl: "https://cdn.example/community/asset.png",
    });
    storage.delete.mockResolvedValue(undefined);
    prisma.communityMediaAsset.create.mockResolvedValue({ id: "asset-1" });
    prisma.communityMediaAsset.updateMany.mockResolvedValue({ count: 1 });
  });

  it("stores validated bytes under the community area and records the owner", async () => {
    await expect(service.upload("user-1", file)).resolves.toEqual({
      id: "asset-1",
      url: "https://cdn.example/community/asset.png",
      mimeType: "image/png",
      width: 32,
      height: 32,
      sizeBytes: file.buffer.length,
    });
    expect(storage.put).toHaveBeenCalledWith({
      body: file.buffer,
      mimeType: "image/png",
      extension: "png",
      area: "community-media",
    });
    expect(prisma.communityMediaAsset.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        ownerId: "user-1",
        storageKey: "public/community-media/2026/08/asset.png",
        status: COMMUNITY_MEDIA_STATUS.ACTIVE,
      }),
    });
  });

  it("rejects corrupt and oversized bytes with the community error contract", async () => {
    await expect(
      service.upload("user-1", { ...file, buffer: Buffer.from("not-image") }),
    ).rejects.toMatchObject({ code: COMMUNITY_MEDIA_ERROR_CODE.INVALID_MEDIA });
    await expect(
      service.upload("user-1", { ...file, buffer: Buffer.alloc(10 * 1024 * 1024 + 1) }),
    ).rejects.toMatchObject({ code: COMMUNITY_MEDIA_ERROR_CODE.INVALID_MEDIA });
    expect(storage.put).not.toHaveBeenCalled();
  });

  it("returns a retryable error without creating a record when storage is unavailable", async () => {
    storage.put.mockRejectedValue(new Error("offline"));

    await expect(service.upload("user-1", file)).rejects.toMatchObject({
      code: COMMUNITY_MEDIA_ERROR_CODE.STORAGE_UNAVAILABLE,
      status: 503,
    });
    expect(prisma.communityMediaAsset.create).not.toHaveBeenCalled();
  });

  it("compensates object storage when media registration fails", async () => {
    prisma.communityMediaAsset.create.mockRejectedValue(new Error("db"));

    await expect(service.upload("user-1", file)).rejects.toThrow("db");
    expect(storage.delete).toHaveBeenCalledWith("public/community-media/2026/08/asset.png");
  });

  it("invalidates and removes only an owned unbound upload", async () => {
    prisma.communityMediaAsset.findUnique.mockResolvedValue({
      ownerId: "user-1",
      postId: null,
      status: COMMUNITY_MEDIA_STATUS.ACTIVE,
      storageKey: "public/community-media/2026/08/asset.png",
    });

    await expect(service.discard("user-1", "asset-1")).resolves.toBeUndefined();
    expect(prisma.communityMediaAsset.updateMany).toHaveBeenCalledWith({
      where: {
        id: "asset-1",
        ownerId: "user-1",
        status: COMMUNITY_MEDIA_STATUS.ACTIVE,
        postId: null,
      },
      data: { status: COMMUNITY_MEDIA_STATUS.DISCARDED },
    });
    expect(storage.delete).toHaveBeenCalledWith("public/community-media/2026/08/asset.png");
  });
});
