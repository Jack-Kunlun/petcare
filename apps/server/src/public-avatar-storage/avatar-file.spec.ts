import { detectAvatarFile } from "./avatar-file";

describe("detectAvatarFile", () => {
  it("detects a PNG avatar from its byte signature", () => {
    const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

    expect(detectAvatarFile(png, "image/png")).toEqual({
      body: png,
      contentType: "image/png",
      extension: "png",
    });
  });

  it.each([
    [Buffer.from([0xff, 0xd8, 0xff, 0xe0]), "image/jpeg", "image/jpeg", "jpg"],
    [Buffer.from("RIFF0000WEBP", "ascii"), "image/webp", "image/webp", "webp"],
  ])("detects %s with its matching MIME type", (body, declaredMime, contentType, extension) => {
    expect(detectAvatarFile(body, declaredMime)).toEqual({ body, contentType, extension });
  });

  it.each([
    [Buffer.from([0xff, 0xd8, 0xff, 0xe0]), "image/png"],
    [Buffer.from("not-an-image"), "image/png"],
    [Buffer.alloc(0), "image/png"],
  ])("rejects mismatched, unknown, and empty input", (body, declaredMime) => {
    expect(() => detectAvatarFile(body, declaredMime)).toThrow(
      expect.objectContaining({ code: "AVATAR_INVALID_TYPE" }),
    );
  });
});
