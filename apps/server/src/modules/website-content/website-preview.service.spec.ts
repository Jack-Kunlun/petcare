import { createHash } from "node:crypto";
import {
  WEBSITE_CONTENT_ERROR_CODE,
  WEBSITE_CONTENT_KEY,
  WEBSITE_CONTENT_STATUS,
  type WebsiteContentVersion,
} from "@petcare/shared-types";
import { WebsitePreviewService } from "./website-preview.service";

const PLAINTEXT_TOKEN = Buffer.alloc(32, 7).toString("base64url");
const TOKEN_HASH = createHash("sha256").update(PLAINTEXT_TOKEN).digest("hex");
const NOW = new Date("2026-08-13T00:00:00.000Z");

function createVersion(id: string, revision: number): WebsiteContentVersion {
  return {
    id,
    contentKey: WEBSITE_CONTENT_KEY.HOME,
    revision,
    businessVersion: null,
    status: WEBSITE_CONTENT_STATUS.SUPERSEDED,
    changeSummary: "Saved draft",
    seo: { title: "Home", description: "Home", canonicalPath: "/", image: null },
    sections: [],
    sourceVersionId: null,
    createdBy: { id: "admin-1", displayName: "Admin" },
    createdAt: NOW.toISOString(),
    publishedBy: null,
    publishedAt: null,
  };
}

function createSubject() {
  const prisma = {
    $transaction: jest.fn(),
    websiteContent: { findUnique: jest.fn() },
    websitePreviewToken: {
      create: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
  };

  prisma.$transaction.mockImplementation((work: (tx: typeof prisma) => unknown) => work(prisma));

  const audit = { record: jest.fn(async () => undefined) };
  const repository = {
    getVersionForPreview: jest.fn(async () => createVersion("draft-home-2", 2)),
  };
  const config = {
    websitePublicUrl: "https://www.petcare.example/",
    websitePreviewTtlSeconds: 600,
  };
  const service = new WebsitePreviewService(
    prisma as never,
    config as never,
    audit as never,
    repository as never,
    () => PLAINTEXT_TOKEN,
    () => NOW,
  );

  return { audit, config, prisma, repository, service };
}

describe("WebsitePreviewService", () => {
  it("creates a 256-bit fragment token while persisting only its SHA-256 hash", async () => {
    const { audit, prisma, service } = createSubject();

    prisma.websiteContent.findUnique.mockResolvedValue({
      id: "content-home",
      currentDraftVersion: {
        id: "draft-home-2",
        revision: 2,
        status: WEBSITE_CONTENT_STATUS.DRAFT,
      },
    });
    prisma.websitePreviewToken.create.mockResolvedValue({ id: "preview-row-1" });

    const result = await service.createPreview({
      contentKey: WEBSITE_CONTENT_KEY.HOME,
      revision: 2,
      operatorId: "admin-1",
      requestId: "request-1",
    });
    const url = new URL(result.previewUrl);

    expect(PLAINTEXT_TOKEN).toMatch(/^[A-Za-z0-9_-]{43}$/u);
    expect(url.pathname).toBe("/preview");
    expect(url.searchParams.get("contentKey")).toBe(WEBSITE_CONTENT_KEY.HOME);
    expect(url.search).not.toContain(PLAINTEXT_TOKEN);
    expect(url.hash).toBe(`#token=${PLAINTEXT_TOKEN}`);
    expect(result).toEqual({
      previewUrl: `https://www.petcare.example/preview?contentKey=home#token=${PLAINTEXT_TOKEN}`,
      expiresAt: "2026-08-13T00:10:00.000Z",
      revision: 2,
    });
    expect(prisma.websitePreviewToken.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        tokenHash: TOKEN_HASH,
        websiteContentId: "content-home",
        contentVersionId: "draft-home-2",
        revision: 2,
        createdById: "admin-1",
        expiresAt: new Date("2026-08-13T00:10:00.000Z"),
      }),
    });
    expect(JSON.stringify(prisma.websitePreviewToken.create.mock.calls)).not.toContain(
      PLAINTEXT_TOKEN,
    );
    expect(JSON.stringify(audit.record.mock.calls)).not.toContain(PLAINTEXT_TOKEN);
  });

  it("reads the token's fixed historical revision rather than the current draft pointer", async () => {
    const { audit, prisma, repository, service } = createSubject();

    prisma.websitePreviewToken.findUnique.mockResolvedValue({
      id: "preview-row-1",
      tokenHash: TOKEN_HASH,
      websiteContentId: "content-home",
      contentVersionId: "draft-home-2",
      revision: 2,
      createdById: "admin-1",
      expiresAt: new Date("2026-08-13T00:10:00.000Z"),
      revokedAt: null,
      websiteContent: { contentKey: WEBSITE_CONTENT_KEY.HOME },
    });

    await expect(
      service.readPreview(WEBSITE_CONTENT_KEY.HOME, PLAINTEXT_TOKEN, "request-2"),
    ).resolves.toMatchObject({ id: "draft-home-2", revision: 2 });
    expect(repository.getVersionForPreview).toHaveBeenCalledWith(
      WEBSITE_CONTENT_KEY.HOME,
      "draft-home-2",
      2,
    );
    expect(prisma.websiteContent.findUnique).not.toHaveBeenCalled();
    expect(prisma.websitePreviewToken.update).toHaveBeenCalledWith({
      where: { id: "preview-row-1" },
      data: { lastUsedAt: NOW },
    });
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: "read_preview", contentVersionId: "draft-home-2" }),
    );
  });

  it.each([
    [
      "expired",
      { expiresAt: new Date("2026-08-12T23:59:59.999Z"), revokedAt: null },
      WEBSITE_CONTENT_ERROR_CODE.PREVIEW_TOKEN_EXPIRED,
    ],
    [
      "revoked",
      { expiresAt: new Date("2026-08-13T00:10:00.000Z"), revokedAt: NOW },
      WEBSITE_CONTENT_ERROR_CODE.PREVIEW_TOKEN_INVALID,
    ],
  ])("rejects %s preview capabilities with the stable error code", async (_label, state, code) => {
    const { prisma, repository, service } = createSubject();

    prisma.websitePreviewToken.findUnique.mockResolvedValue({
      id: "preview-row-1",
      tokenHash: TOKEN_HASH,
      websiteContentId: "content-home",
      contentVersionId: "draft-home-2",
      revision: 2,
      createdById: "admin-1",
      websiteContent: { contentKey: WEBSITE_CONTENT_KEY.HOME },
      ...state,
    });

    await expect(
      service.readPreview(WEBSITE_CONTENT_KEY.HOME, PLAINTEXT_TOKEN, "request-3"),
    ).rejects.toMatchObject({ code });
    expect(repository.getVersionForPreview).not.toHaveBeenCalled();
  });

  it("revokes every active preview for a published version and writes no plaintext token", async () => {
    const { audit, prisma, service } = createSubject();

    prisma.websitePreviewToken.updateMany.mockResolvedValue({ count: 2 });

    await expect(service.revokeForVersion("draft-home-2", "admin-1", "request-4")).resolves.toBe(2);
    expect(prisma.websitePreviewToken.updateMany).toHaveBeenCalledWith({
      where: { contentVersionId: "draft-home-2", revokedAt: null },
      data: { revokedAt: NOW },
    });
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "revoke_preview",
        contentVersionId: "draft-home-2",
        result: { status: "revoked", revokedCount: 2 },
      }),
    );
    expect(JSON.stringify(audit.record.mock.calls)).not.toContain(PLAINTEXT_TOKEN);
  });
});
