import { BOUNTY_SOP_EVIDENCE_KIND } from "@petcare/shared-types";
import { validateBountySopEvidence } from "./bounty-sop-evidence";

const validPng = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9Zt9sAAAAASUVORK5CYII=",
  "base64",
);

validPng.writeUInt32BE(32, 16);
validPng.writeUInt32BE(32, 20);

describe("validateBountySopEvidence", () => {
  it("derives managed image and MP4 types from bytes", async () => {
    await expect(
      validateBountySopEvidence(
        { buffer: validPng, originalName: "evidence.bin", mimeType: "application/octet-stream" },
        BOUNTY_SOP_EVIDENCE_KIND.PHOTO,
      ),
    ).resolves.toMatchObject({ mimeType: "image/png", extension: "png", kind: "photo" });

    const mp4 = Buffer.concat([Buffer.alloc(4), Buffer.from("ftypisom", "ascii")]);

    await expect(
      validateBountySopEvidence(
        { buffer: mp4, originalName: "evidence.bin", mimeType: "application/octet-stream" },
        BOUNTY_SOP_EVIDENCE_KIND.VIDEO,
      ),
    ).resolves.toMatchObject({ mimeType: "video/mp4", extension: "mp4", kind: "video" });
  });

  it("rejects undecodable bytes through one stable error", async () => {
    await expect(
      validateBountySopEvidence(
        { buffer: Buffer.from("not-media"), originalName: "evidence.jpg", mimeType: "image/jpeg" },
        BOUNTY_SOP_EVIDENCE_KIND.PHOTO,
      ),
    ).rejects.toMatchObject({ code: "BOUNTY_SOP_EVIDENCE_INVALID", status: 400 });
  });
});
