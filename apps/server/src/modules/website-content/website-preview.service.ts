import { createHash, randomBytes } from "node:crypto";
import { Inject, Injectable } from "@nestjs/common";
import {
  type CreateWebsitePreviewResponse,
  type WebsiteContentKey,
  type WebsiteContentVersion,
} from "@petcare/shared-types";
import { PrismaService } from "../../prisma/prisma.service";
import { WebsiteContentAuditService } from "./website-content-audit.service";
import {
  websiteContentPreviewTokenExpired,
  websiteContentPreviewTokenInvalid,
  websiteContentRevisionConflict,
} from "./website-content.errors";
import { WebsiteContentRepository } from "./website-content.repository";

/** Configuration seam implemented by the central ConfigService. */
export interface WebsitePreviewConfig {
  websitePublicUrl: string;
  websitePreviewTtlSeconds: number;
}

/** Injection token for central Website Content preview runtime configuration. */
export const WEBSITE_PREVIEW_CONFIG = Symbol("WEBSITE_PREVIEW_CONFIG");

/** Command for minting a preview capability for an exact saved revision. */
export interface CreateWebsitePreviewCommand {
  contentKey: WebsiteContentKey;
  revision: number;
  operatorId: string;
  requestId: string;
}

type TokenFactory = () => string;
type Clock = () => Date;

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/** Mints, consumes, and revokes hash-only fixed-revision preview capabilities. */
@Injectable()
export class WebsitePreviewService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(WEBSITE_PREVIEW_CONFIG) private readonly config: WebsitePreviewConfig,
    private readonly audit: WebsiteContentAuditService,
    private readonly repository: WebsiteContentRepository,
    private readonly tokenFactory: TokenFactory = () => randomBytes(32).toString("base64url"),
    private readonly clock: Clock = () => new Date(),
  ) {}

  /** Creates a ten-minute fragment-only plaintext capability and stores only its digest. */
  async createPreview(
    command: CreateWebsitePreviewCommand,
  ): Promise<CreateWebsitePreviewResponse> {
    const content = await this.prisma.websiteContent.findUnique({
      where: { contentKey: command.contentKey },
      include: { currentDraftVersion: { select: { id: true, revision: true, status: true } } },
    });

    if (!content?.currentDraftVersion || content.currentDraftVersion.revision !== command.revision) {
      throw websiteContentRevisionConflict();
    }

    const plaintext = this.tokenFactory();
    const expiresAt = new Date(this.clock().getTime() + this.config.websitePreviewTtlSeconds * 1000);
    const row = await this.prisma.websitePreviewToken.create({
      data: {
        tokenHash: hashToken(plaintext),
        websiteContentId: content.id,
        contentVersionId: content.currentDraftVersion.id,
        revision: content.currentDraftVersion.revision,
        createdById: command.operatorId,
        expiresAt,
      },
    });

    await this.audit.record({
      websiteContentId: content.id,
      contentVersionId: content.currentDraftVersion.id,
      operatorId: command.operatorId,
      action: "create_preview",
      targetType: "website_preview_token",
      targetId: row.id,
      revision: command.revision,
      businessVersion: null,
      requestId: command.requestId,
      result: { status: "succeeded", previewExpiresAt: expiresAt.toISOString() },
    });

    const url = new URL("/preview", this.config.websitePublicUrl);

    url.searchParams.set("contentKey", command.contentKey);
    url.hash = `token=${plaintext}`;

    return { previewUrl: url.toString(), expiresAt: expiresAt.toISOString(), revision: command.revision };
  }

  /** Reads the exact immutable version selected when the capability was minted. */
  async readPreview(
    contentKey: WebsiteContentKey,
    plaintextToken: string,
    requestId: string,
  ): Promise<WebsiteContentVersion> {
    const token = await this.prisma.websitePreviewToken.findUnique({
      where: { tokenHash: hashToken(plaintextToken) },
      include: { websiteContent: { select: { contentKey: true } } },
    });

    if (!token || token.websiteContent.contentKey !== contentKey || token.revokedAt) {
      throw websiteContentPreviewTokenInvalid();
    }

    const now = this.clock();

    if (token.expiresAt.getTime() <= now.getTime()) {
      throw websiteContentPreviewTokenExpired();
    }

    const version = await this.repository.getVersionForPreview(
      contentKey,
      token.contentVersionId,
      token.revision,
    );

    await this.prisma.websitePreviewToken.update({
      where: { id: token.id },
      data: { lastUsedAt: now },
    });
    await this.audit.record({
      websiteContentId: token.websiteContentId,
      contentVersionId: token.contentVersionId,
      operatorId: token.createdById,
      action: "read_preview",
      targetType: "website_preview_token",
      targetId: token.id,
      revision: token.revision,
      businessVersion: null,
      requestId,
      result: { status: "succeeded" },
    });

    return version;
  }

  /** Revokes all active capabilities scoped to the version being published. */
  async revokeForVersion(
    contentVersionId: string,
    operatorId: string,
    requestId: string,
  ): Promise<number> {
    const now = this.clock();
    const result = await this.prisma.websitePreviewToken.updateMany({
      where: { contentVersionId, revokedAt: null },
      data: { revokedAt: now },
    });

    await this.audit.record({
      contentVersionId,
      operatorId,
      action: "revoke_preview",
      targetType: "website_content_version",
      targetId: contentVersionId,
      requestId,
      result: { status: "revoked", revokedCount: result.count },
    });

    return result.count;
  }
}
