import { createHash } from "node:crypto";
import { validateWebsiteMediaFile } from "./website-media-file";

const PNG_1X1 = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
  "base64",
);

describe("validateWebsiteMediaFile", () => {
  it("detects decoded image metadata and checksum from bytes", async () => {
    await expect(
      validateWebsiteMediaFile(PNG_1X1, "spoof.jpg", "image/jpeg", { minDimension: 1 }),
    ).resolves.toMatchObject({
      mimeType: "image/png",
      extension: "png",
      width: 1,
      height: 1,
      checksum: createHash("sha256").update(PNG_1X1).digest("hex"),
    });
  });

  it("rejects corrupt and over-limit content", async () => {
    await expect(
      validateWebsiteMediaFile(Buffer.from("not-image"), "bad.png", "image/png"),
    ).rejects.toMatchObject({ code: "WEBSITE_CONTENT_INVALID_MEDIA" });
    await expect(
      validateWebsiteMediaFile(Buffer.alloc(10 * 1024 * 1024 + 1), "large.png", "image/png"),
    ).rejects.toMatchObject({ code: "WEBSITE_CONTENT_INVALID_MEDIA" });
  });

  it("supports a domain-specific subject and stable error factory", async () => {
    const errorFactory = jest.fn((message: string) => new Error(message));

    await expect(
      validateWebsiteMediaFile(Buffer.from("bad"), "bad.png", "image/png", {
        subject: "社区图片",
        errorFactory,
      }),
    ).rejects.toThrow("社区图片字节无法解码");
    expect(errorFactory).toHaveBeenCalledWith("社区图片字节无法解码");
  });
});
