import { TencentCosWebsiteMediaStorage } from "./tencent-cos-website-media.storage";

describe("TencentCosWebsiteMediaStorage", () => {
  it("uploads with provider coordinates and server-generated website prefix", async () => {
    const cos = { putObject: jest.fn((_params, callback) => callback(null, { RequestId: "r1" })) };
    const storage = new TencentCosWebsiteMediaStorage(
      cos as never,
      {
        bucket: "petcare-1250000000",
        region: "ap-guangzhou",
        publicBaseUrl: "https://cdn.example.com",
      },
      {
        now: () => new Date("2026-08-13T00:00:00Z"),
        uuid: () => "00000000-0000-4000-8000-000000000000",
      },
    );

    await expect(
      storage.put({ body: Buffer.from("png"), mimeType: "image/png", extension: "png" }),
    ).resolves.toEqual({
      storageKey: "public/website-media/2026/08/00000000-0000-4000-8000-000000000000.png",
      publicUrl:
        "https://cdn.example.com/public/website-media/2026/08/00000000-0000-4000-8000-000000000000.png",
    });
    expect(cos.putObject).toHaveBeenCalledWith(
      expect.objectContaining({
        Bucket: "petcare-1250000000",
        Region: "ap-guangzhou",
        Key: expect.stringMatching(/^public\/website-media\/2026\/08\//u),
        ContentType: "image/png",
      }),
      expect.any(Function),
    );

    await expect(
      storage.put({
        body: Buffer.from("png"),
        mimeType: "image/png",
        extension: "png",
        area: "community-media",
      }),
    ).resolves.toMatchObject({
      storageKey: "public/community-media/2026/08/00000000-0000-4000-8000-000000000000.png",
    });
    expect(cos.putObject).toHaveBeenLastCalledWith(
      expect.objectContaining({
        Key: expect.stringMatching(/^public\/community-media\/2026\/08\//u),
      }),
      expect.any(Function),
    );

    await expect(
      storage.put({
        body: Buffer.from("png"),
        mimeType: "image/png",
        extension: "png",
        area: "pet-media",
      }),
    ).resolves.toMatchObject({
      storageKey: "public/pet-media/2026/08/00000000-0000-4000-8000-000000000000.png",
    });
    expect(cos.putObject).toHaveBeenLastCalledWith(
      expect.objectContaining({ Key: expect.stringMatching(/^public\/pet-media\/2026\/08\//u) }),
      expect.any(Function),
    );
  });

  it("maps callback failures to a stable storage error", async () => {
    const cos = { headObject: jest.fn((_params, callback) => callback({ RequestId: "r2" })) };
    const storage = new TencentCosWebsiteMediaStorage(cos as never, {
      bucket: "petcare-1250000000",
      region: "ap-guangzhou",
      publicBaseUrl: "",
    });

    await expect(storage.head("public/website-media/a.png")).rejects.toMatchObject({
      code: "WEBSITE_CONTENT_STORAGE_UNAVAILABLE",
    });
  });
});
