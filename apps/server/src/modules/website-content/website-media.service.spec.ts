import { WebsiteMediaService } from "./website-media.service";

describe("WebsiteMediaService", () => {
  it("returns a complete managed asset after upload", async () => {
    const record = {
      id: "asset-1",
      storageKey: "public/website-media/a.png",
      originalName: "a.png",
      mimeType: "image/png",
      sizeBytes: 4,
      width: 32,
      height: 32,
      checksum: "hash",
      status: "active",
      createdAt: new Date("2026-08-24T00:00:00.000Z"),
      createdBy: { id: "admin-1", nickname: "管理员", username: "admin" },
    };
    const prisma = {
      websiteMediaAsset: { create: jest.fn().mockResolvedValue(record) },
    };
    const storage = {
      put: jest.fn().mockResolvedValue({ storageKey: "public/website-media/a.png" }),
      delete: jest.fn(),
      resolvePublicUrl: jest.fn(() => "https://cdn/a.png"),
    };
    const service = new WebsiteMediaService(prisma as never, storage as never);

    await expect(
      service.upload(
        {
          buffer: Buffer.from("file"),
          originalName: "a.png",
          mimeType: "image/png",
          operatorId: "admin-1",
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
    ).resolves.toEqual({
      id: "asset-1",
      originalName: "a.png",
      mimeType: "image/png",
      sizeBytes: 4,
      width: 32,
      height: 32,
      checksum: "hash",
      status: "active",
      publicAsset: {
        id: "asset-1",
        url: "https://cdn/a.png",
        width: 32,
        height: 32,
        mimeType: "image/png",
      },
      createdBy: { id: "admin-1", displayName: "管理员" },
      createdAt: "2026-08-24T00:00:00.000Z",
      references: [],
    });
    expect(prisma.websiteMediaAsset.create).toHaveBeenCalledWith(
      expect.objectContaining({
        include: { createdBy: { select: { id: true, nickname: true, username: true } } },
      }),
    );
  });

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

  it.each(["cover", "body"])(
    "refuses to archive an asset referenced by a classroom article %s",
    async (reference) => {
      const storage = { resolvePublicUrl: jest.fn(() => "https://cdn/a.png") };
      const prisma = {
        websiteMediaAsset: {
          findUnique: jest.fn().mockResolvedValue({ storageKey: "public/website-media/a.png" }),
          update: jest.fn(),
        },
        websiteContentSection: { findMany: jest.fn().mockResolvedValue([]) },
        classroomArticle: {
          findMany: jest.fn().mockImplementation(async ({ where }) => {
            const matchesCover = where.OR[0].coverUrl === "https://cdn/a.png";
            const matchesBody = where.OR[1].content.contains === 'data-asset-id="asset-1"';

            return (reference === "cover" ? matchesCover : matchesBody)
              ? [{ id: "article-1" }]
              : [];
          }),
        },
      };
      const service = new WebsiteMediaService(prisma as never, storage as never);

      await expect(service.archive("asset-1")).rejects.toMatchObject({
        code: "WEBSITE_CONTENT_INVALID_MEDIA",
        message: "仍被内容引用的素材不能归档",
      });
      expect(prisma.classroomArticle.findMany).toHaveBeenCalledWith({
        where: {
          OR: [
            { coverUrl: "https://cdn/a.png" },
            { content: { contains: 'data-asset-id="asset-1"' } },
          ],
        },
        select: { id: true },
      });
      expect(prisma.websiteMediaAsset.update).not.toHaveBeenCalled();
    },
  );
});
