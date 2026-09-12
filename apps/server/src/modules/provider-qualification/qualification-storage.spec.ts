import type { Writable } from "node:stream";
import COS from "cos-nodejs-sdk-v5";
import { ConfigService } from "../../config/config.service";
import { QualificationStorage, QUALIFICATION_MATERIAL_MAX_BYTES } from "./qualification-storage";

jest.mock("cos-nodejs-sdk-v5");

describe("QualificationStorage", () => {
  const key = "private/provider-qualifications/09b54f89-7085-4415-84cf-07b842a1ccff";
  const coordinates = {
    bucket: "existing-private-1234567890",
    region: "ap-guangzhou",
    secretId: "private-test-id",
    secretKey: "private-test-secret",
  };
  let storage: QualificationStorage;
  const client = { putObject: jest.fn(), getObject: jest.fn(), deleteObject: jest.fn() };

  beforeEach(() => {
    jest.resetAllMocks();
    jest.mocked(COS).mockImplementation(() => client as unknown as COS);
    storage = new QualificationStorage({ qualificationStorage: coordinates } as ConfigService);
  });

  it("uses the shared bucket with COS-encrypted, private, non-cacheable objects", async () => {
    await storage.put(key, Buffer.from("validated-image"), "image/png");
    expect(client.putObject).toHaveBeenCalledWith(
      expect.objectContaining({
        Bucket: coordinates.bucket,
        Key: key,
        ACL: "private",
        ServerSideEncryption: "AES256",
        CacheControl: "no-store",
      }),
    );
    expect(client.putObject.mock.calls[0]?.[0]).not.toHaveProperty("SSEKMSKeyId");
    expect(storage.createKey()).toMatch(/^private\/provider-qualifications\/[a-f0-9-]{36}$/);
  });

  it.each(["postgresql/backup.dump", "public/pet-media/a", `${key}/../backup`, `${key}?x=1`])(
    "rejects out-of-domain key %s for every operation",
    async (invalid) => {
      await expect(storage.put(invalid, Buffer.from("x"), "image/png")).rejects.toMatchObject({
        status: 400,
      });
      await expect(storage.read(invalid)).rejects.toMatchObject({ status: 400 });
      await expect(storage.delete(invalid)).rejects.toMatchObject({ status: 400 });
      expect(client.putObject).not.toHaveBeenCalled();
      expect(client.getObject).not.toHaveBeenCalled();
      expect(client.deleteObject).not.toHaveBeenCalled();
    },
  );

  it("fails closed without private configuration even if public COS exists", async () => {
    const disabled = new QualificationStorage({ qualificationStorage: null } as ConfigService);

    await expect(disabled.put(key, Buffer.from("x"), "image/png")).rejects.toMatchObject({
      status: 503,
    });
    await expect(disabled.read(key)).rejects.toMatchObject({ status: 503 });
    await expect(disabled.delete(key)).rejects.toMatchObject({ status: 503 });
  });

  it("returns bytes without SDK metadata", async () => {
    client.getObject.mockImplementation(({ Output }: { Output: Writable }, callback) => {
      Output.end(Buffer.from("material"));
      callback(null, { Location: "private-address" });
    });
    expect(await storage.read(key)).toEqual(Buffer.from("material"));
  });

  it("bounds reads even if the provider sends an oversized object", async () => {
    client.getObject.mockImplementation(({ Output }: { Output: Writable }) => {
      Output.end(Buffer.alloc(QUALIFICATION_MATERIAL_MAX_BYTES + 1));
    });
    await expect(storage.read(key)).rejects.toMatchObject({ status: 503 });
  });

  it("sanitizes synchronous and asynchronous SDK errors", async () => {
    client.putObject.mockRejectedValue(new Error("private-test-secret"));
    client.getObject.mockImplementation(() => {
      throw new Error("private-test-secret");
    });
    client.deleteObject.mockRejectedValue(new Error("private-test-secret"));

    await Promise.all(
      [
        () => storage.put(key, Buffer.from("x"), "image/png"),
        () => storage.read(key),
        () => storage.delete(key),
      ].map((operation) =>
        expect(operation()).rejects.toMatchObject({ message: "资格材料存储暂不可用" }),
      ),
    );
  });
});
