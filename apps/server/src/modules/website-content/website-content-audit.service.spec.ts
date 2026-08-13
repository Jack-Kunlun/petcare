import { WebsiteContentAuditService } from "./website-content-audit.service";

describe("WebsiteContentAuditService", () => {
  it("persists only allow-listed audit metadata", async () => {
    const prisma = { websiteContentAuditLog: { create: jest.fn() } };
    const service = new WebsiteContentAuditService(prisma as never);

    await service.record({
      websiteContentId: "content-home",
      contentVersionId: "draft-home-2",
      operatorId: "admin-1",
      action: "create_preview",
      targetType: "website_preview_token",
      targetId: "preview-row-1",
      revision: 2,
      businessVersion: null,
      requestId: "request-1",
      result: {
        status: "succeeded",
        previewExpiresAt: "2026-08-13T00:10:00.000Z",
      },
    });

    expect(prisma.websiteContentAuditLog.create).toHaveBeenCalledWith({
      data: {
        websiteContentId: "content-home",
        contentVersionId: "draft-home-2",
        mediaAssetId: null,
        operatorId: "admin-1",
        action: "create_preview",
        targetType: "website_preview_token",
        targetId: "preview-row-1",
        revision: 2,
        businessVersion: null,
        requestId: "request-1",
        result: {
          status: "succeeded",
          previewExpiresAt: "2026-08-13T00:10:00.000Z",
        },
      },
    });
  });

  it("rejects unknown actions and token-shaped audit payloads before persistence", async () => {
    const prisma = { websiteContentAuditLog: { create: jest.fn() } };
    const service = new WebsiteContentAuditService(prisma as never);

    await expect(
      service.record({
        operatorId: "admin-1",
        action: "execute_sql" as never,
        targetType: "website_preview_token",
        requestId: "request-1",
      }),
    ).rejects.toThrow("Website Content audit action is not allowed");

    await expect(
      service.record({
        operatorId: "admin-1",
        action: "create_preview",
        targetType: "website_preview_token",
        requestId: "request-1",
        result: { status: "succeeded", previewToken: "plaintext-preview-token" } as never,
      }),
    ).rejects.toThrow("Website Content audit result contains unsupported fields");
    expect(prisma.websiteContentAuditLog.create).not.toHaveBeenCalled();
  });
});
