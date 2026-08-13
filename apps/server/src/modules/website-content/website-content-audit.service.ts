import { Injectable } from "@nestjs/common";
import type { Prisma } from "../../generated/prisma/client";
import { PrismaService } from "../../prisma/prisma.service";

const AUDIT_ACTIONS = new Set([
  "save_draft",
  "restore_as_draft",
  "publish",
  "create_preview",
  "read_preview",
  "revoke_preview",
  "upload_media",
  "archive_media",
  "permission_denied",
]);

const RESULT_KEYS = new Set([
  "status",
  "previewExpiresAt",
  "sourceVersionId",
  "draftVersionId",
  "revokedCount",
  "idempotencyKey",
  "permissionCode",
  "occurredAt",
]);

type AuditClient = Pick<Prisma.TransactionClient, "websiteContentAuditLog">;

/** Safe allow-listed Website Content audit metadata. */
export interface WebsiteContentAuditCommand {
  websiteContentId?: string | null;
  contentVersionId?: string | null;
  mediaAssetId?: string | null;
  operatorId: string;
  action:
    | "save_draft"
    | "restore_as_draft"
    | "publish"
    | "create_preview"
    | "read_preview"
    | "revoke_preview"
    | "upload_media"
    | "archive_media"
    | "permission_denied";
  targetType: string;
  targetId?: string | null;
  revision?: number | null;
  businessVersion?: number | null;
  requestId: string;
  result?: Record<string, string | number | boolean | null> | null;
}

/** Persists redacted, schema-bounded Website Content audit events. */
@Injectable()
export class WebsiteContentAuditService {
  constructor(private readonly prisma: PrismaService) {}

  /** Records only known actions and explicitly allow-listed result metadata. */
  async record(command: WebsiteContentAuditCommand, client?: AuditClient): Promise<void> {
    if (!AUDIT_ACTIONS.has(command.action)) {
      throw new Error("Website Content audit action is not allowed");
    }

    if (command.result && Object.keys(command.result).some((key) => !RESULT_KEYS.has(key))) {
      throw new Error("Website Content audit result contains unsupported fields");
    }

    const database = client ?? this.prisma;

    await database.websiteContentAuditLog.create({
      data: {
        websiteContentId: command.websiteContentId ?? null,
        contentVersionId: command.contentVersionId ?? null,
        mediaAssetId: command.mediaAssetId ?? null,
        operatorId: command.operatorId,
        action: command.action,
        targetType: command.targetType,
        targetId: command.targetId ?? null,
        revision: command.revision ?? null,
        businessVersion: command.businessVersion ?? null,
        requestId: command.requestId,
        result: (command.result ?? null) as Prisma.InputJsonValue,
      },
    });
  }
}
