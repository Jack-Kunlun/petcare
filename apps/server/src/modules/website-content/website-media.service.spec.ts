import { WebsiteMediaService } from "./website-media.service";

describe("WebsiteMediaService", () => {
  it("compensates object storage when database registration fails", async () => {
    const storage = {
      put: jest.fn(async () => ({
        storageKey: "public/website-media/a.png",
        publicUrl: "https://cdn/a.png",
      })),
      delete: jest.fn(async () => undefined),
      head: jest.fn(),
      resolvePublicUrl: jest.fn(() => "https://cdn/a.png"),
    };
    const prisma = {
      websiteMediaAsset: {
        create: jest.fn(async () => {
          throw new Error("db");
        }),
      },
    };
    const service = new WebsiteMediaService(prisma as never, storage as never);

    await expect(
      service.upload(
        {
          buffer: Buffer.from("file"),
          originalName: "a.png",
          mimeType: "image/png",
          operatorId: "admin",
        },
        {
          mimeType: "image/png",
          extension: "png",
          sizeBytes: 4,
          width: 32,
          height: 32,
          checksum: "hash",
        },
      ),
    ).rejects.toThrow("db");
    expect(storage.delete).toHaveBeenCalledWith("public/website-media/a.png");
  });

  it("preflights every active referenced object before publish", async () => {
    const storage = {
      put: jest.fn(),
      delete: jest.fn(),
      head: jest.fn(async () => undefined),
      resolvePublicUrl: jest.fn(() => "https://cdn/1.png"),
    };
    const prisma = {
      websiteMediaAsset: {
        findMany: jest.fn(async () => [
          {
            id: "asset-1",
            storageKey: "public/website-media/1.png",
            status: "active",
            width: 640,
            height: 480,
            mimeType: "image/png",
          },
        ]),
      },
    };
    const service = new WebsiteMediaService(prisma as never, storage as never);

    await expect(service.verify({} as never, ["asset-1"])).resolves.toEqual(
      new Map([
        [
          "asset-1",
          {
            id: "asset-1",
            url: "https://cdn/1.png",
            width: 640,
            height: 480,
            mimeType: "image/png",
          },
        ],
      ]),
    );
    expect(storage.head).toHaveBeenCalledWith("public/website-media/1.png");
  });

  it("batch resolves active managed assets without exposing storage keys", async () => {
    const storage = {
      resolvePublicUrl: jest.fn(() => "https://cdn/1.png"),
    };
    const prisma = {
      websiteMediaAsset: {
        findMany: jest.fn(async () => [
          {
            id: "asset-1",
            storageKey: "public/website-media/1.png",
            width: 640,
            height: 480,
            mimeType: "image/png",
          },
        ]),
      },
    };
    const service = new WebsiteMediaService(prisma as never, storage as never);

    await expect(service.resolvePublicAssets(["asset-1", "missing"])).resolves.toEqual(
      new Map([
        [
          "asset-1",
          {
            id: "asset-1",
            url: "https://cdn/1.png",
            width: 640,
            height: 480,
            mimeType: "image/png",
          },
        ],
      ]),
    );
  });
});
