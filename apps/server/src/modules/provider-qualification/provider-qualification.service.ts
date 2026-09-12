import { HttpStatus, Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import {
  PROVIDER_QUALIFICATION_CONSENT_VERSION,
  PROVIDER_QUALIFICATION_MATERIAL_KIND,
  type AdminProviderQualificationDetail,
  type ProviderQualificationMaterialKind,
  type ProviderQualificationStatus,
  type ProviderQualificationSummary,
} from "@petcare/shared-types";
import { ApiException } from "../../common/http/api-exception";
import { ConfigService } from "../../config/config.service";
import type { ProviderQualificationApplication } from "../../generated/prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { validateWebsiteMediaFile } from "../website-content/media/website-media-file";
import { QualificationStorage } from "./qualification-storage";

const KINDS = Object.values(PROVIDER_QUALIFICATION_MATERIAL_KIND);
const APPEAL_DAYS = 30;
const DRAFT_DAYS = 7;

function failure(code: string, message: string, status: HttpStatus): ApiException {
  return new ApiException(code, message, status);
}

function purgeDate(): Date {
  return new Date(Date.now() + APPEAL_DAYS * 24 * 60 * 60 * 1000);
}

function materialFields(kind: ProviderQualificationMaterialKind) {
  switch (kind) {
    case PROVIDER_QUALIFICATION_MATERIAL_KIND.ID_FRONT:
      return { key: "idCardFrontKey", mime: "idCardFrontMime" } as const;
    case PROVIDER_QUALIFICATION_MATERIAL_KIND.ID_BACK:
      return { key: "idCardBackKey", mime: "idCardBackMime" } as const;
    case PROVIDER_QUALIFICATION_MATERIAL_KIND.TRAINING:
      return { key: "trainingKey", mime: "trainingMime" } as const;
  }
}

/** Owns qualification transitions and the three-field eligibility projection. */
@Injectable()
export class ProviderQualificationService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ProviderQualificationService.name);
  private cleanupTimer?: ReturnType<typeof setInterval>;

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: QualificationStorage,
    private readonly config: ConfigService,
  ) {}

  onModuleInit(): void {
    if (!this.config.qualificationStorage) {
      return;
    }

    void this.purgeExpired().catch(() =>
      this.logger.error("Qualification material cleanup will retry"),
    );
    this.cleanupTimer = setInterval(
      () => {
        void this.purgeExpired().catch(() =>
          this.logger.error("Qualification material cleanup will retry"),
        );
      },
      60 * 60 * 1000,
    );
    this.cleanupTimer.unref();
  }

  onModuleDestroy(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
    }
  }

  /** An idempotent draft cannot certify a provider or expose private materials. */
  async createDraft(
    applicantId: string,
    idempotencyKey: string,
  ): Promise<ProviderQualificationSummary> {
    return this.prisma.$transaction(async (tx) => {
      const rows = await tx.$queryRaw<Array<{ id: string }>>`
        SELECT "id" FROM "users" WHERE "id" = ${applicantId}
          AND "status" = 'active' AND "phone" IS NOT NULL AND BTRIM("phone") <> ''
        FOR UPDATE
      `;

      if (rows.length === 0) {
        throw failure(
          "QUALIFICATION_ACCOUNT_INCOMPLETE",
          "请先完成有效账号和手机号",
          HttpStatus.FORBIDDEN,
        );
      }

      const replay = await tx.providerQualificationApplication.findUnique({
        where: { applicantId_idempotencyKey: { applicantId, idempotencyKey } },
      });

      if (replay) {
        return this.summary(replay);
      }

      const active = await tx.providerQualificationApplication.findFirst({
        where: {
          applicantId,
          OR: [
            { status: "draft", purgeAfter: { gt: new Date() } },
            { status: { in: ["pending", "approved"] } },
          ],
        },
        orderBy: { createdAt: "desc" },
      });

      if (active) {
        throw failure("QUALIFICATION_ALREADY_ACTIVE", "已有进行中的资格申请", HttpStatus.CONFLICT);
      }

      const application = await tx.providerQualificationApplication.create({
        data: {
          applicantId,
          idempotencyKey,
          purgeAfter: new Date(Date.now() + DRAFT_DAYS * 24 * 60 * 60 * 1000),
        },
      });

      await tx.providerQualificationEvent.create({
        data: {
          applicationId: application.id,
          applicantId,
          actorId: applicantId,
          action: "created",
          toStatus: "draft",
        },
      });

      return this.summary(application);
    });
  }

  async mine(applicantId: string): Promise<ProviderQualificationSummary[]> {
    const rows = await this.prisma.providerQualificationApplication.findMany({
      where: {
        applicantId,
        OR: [{ status: { not: "draft" } }, { purgeAfter: { gt: new Date() } }],
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: 30,
    });

    return rows.map((row) => this.summary(row));
  }

  /** Uploads once per kind; a losing concurrent upload is removed from COS. */
  async upload(
    applicantId: string,
    id: string,
    kind: ProviderQualificationMaterialKind,
    file: Express.Multer.File,
  ): Promise<ProviderQualificationSummary> {
    const fields = materialFields(kind);
    const existing = await this.prisma.providerQualificationApplication.findFirst({
      where: { id, applicantId },
    });

    if (!existing) {
      throw failure("QUALIFICATION_NOT_FOUND", "资格申请不存在", HttpStatus.NOT_FOUND);
    }

    if (existing.status !== "draft" || !existing.purgeAfter || existing.purgeAfter <= new Date()) {
      throw failure("QUALIFICATION_STATE_CONFLICT", "当前状态不能上传材料", HttpStatus.CONFLICT);
    }

    if (existing[fields.key]) {
      return this.summary(existing);
    }

    const validated = await validateWebsiteMediaFile(
      file.buffer,
      file.originalname,
      file.mimetype,
      {
        subject: "资格材料",
        errorFactory: (message) =>
          failure("QUALIFICATION_INVALID_MATERIAL", message, HttpStatus.BAD_REQUEST),
      },
    );
    const key = this.storage.createKey();

    try {
      await this.storage.put(key, file.buffer, validated.mimeType);
      const result = await this.prisma.$transaction(async (tx) => {
        const updated = await tx.providerQualificationApplication.updateMany({
          where: {
            id,
            applicantId,
            status: "draft",
            purgeAfter: { gt: new Date() },
            [fields.key]: null,
          },
          data: { [fields.key]: key, [fields.mime]: validated.mimeType },
        });

        if (!updated.count) {
          throw failure(
            "QUALIFICATION_STATE_CONFLICT",
            "材料已上传或申请状态已改变",
            HttpStatus.CONFLICT,
          );
        }

        await tx.providerQualificationEvent.create({
          data: {
            applicationId: id,
            applicantId,
            actorId: applicantId,
            action: `uploaded_${kind}`,
            fromStatus: "draft",
            toStatus: "draft",
          },
        });

        return tx.providerQualificationApplication.findUniqueOrThrow({ where: { id } });
      });

      return this.summary(result);
    } catch (error) {
      await this.storage.delete(key).catch(() => undefined);
      throw error;
    }
  }

  /** Submission records affirmative consent and makes the application reviewable. */
  async submit(
    applicantId: string,
    id: string,
    consentVersion: string,
    accepted: boolean,
  ): Promise<ProviderQualificationSummary> {
    if (!accepted || consentVersion !== PROVIDER_QUALIFICATION_CONSENT_VERSION) {
      throw failure(
        "QUALIFICATION_CONSENT_REQUIRED",
        "请先同意当前版本的资格材料处理说明",
        HttpStatus.BAD_REQUEST,
      );
    }

    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "provider_qualification_applications" WHERE "id" = ${id} FOR UPDATE`;
      const application = await tx.providerQualificationApplication.findFirst({
        where: { id, applicantId },
      });

      if (!application) {
        throw failure("QUALIFICATION_NOT_FOUND", "资格申请不存在", HttpStatus.NOT_FOUND);
      }

      if (application.status === "pending" && application.consentVersion === consentVersion) {
        return this.summary(application);
      }

      if (
        application.status !== "draft" ||
        !application.purgeAfter ||
        application.purgeAfter <= new Date()
      ) {
        throw failure("QUALIFICATION_STATE_CONFLICT", "当前状态不能提交", HttpStatus.CONFLICT);
      }

      if (!application.idCardFrontKey || !application.idCardBackKey || !application.trainingKey) {
        throw failure(
          "QUALIFICATION_MATERIAL_INCOMPLETE",
          "请上传身份证正反面及培训证明",
          HttpStatus.BAD_REQUEST,
        );
      }

      const user = await tx.user.findFirst({
        where: { id: applicantId, status: "active", phone: { not: null } },
        select: { id: true },
      });

      if (!user) {
        throw failure(
          "QUALIFICATION_ACCOUNT_INCOMPLETE",
          "账号状态或手机号不符合申请条件",
          HttpStatus.FORBIDDEN,
        );
      }

      const updated = await tx.providerQualificationApplication.update({
        where: { id },
        data: { status: "pending", consentVersion, consentedAt: new Date(), purgeAfter: null },
      });

      await tx.providerQualificationEvent.create({
        data: {
          applicationId: id,
          applicantId,
          actorId: applicantId,
          action: "submitted",
          fromStatus: "draft",
          toStatus: "pending",
        },
      });

      return this.summary(updated);
    });
  }

  async listForAdmin(
    status: ProviderQualificationStatus = "pending",
  ): Promise<ProviderQualificationSummary[]> {
    const rows = await this.prisma.providerQualificationApplication.findMany({
      where: { status },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      take: 50,
    });

    return rows.map((row) => this.summary(row));
  }

  async detailForAdmin(id: string): Promise<AdminProviderQualificationDetail> {
    const application = await this.prisma.providerQualificationApplication.findUnique({
      where: { id },
    });

    if (!application) {
      throw failure("QUALIFICATION_NOT_FOUND", "资格申请不存在", HttpStatus.NOT_FOUND);
    }

    const [user, events] = await Promise.all([
      this.prisma.user.findUnique({
        where: { id: application.applicantId },
        select: { nickname: true, phone: true },
      }),
      this.prisma.providerQualificationEvent.findMany({
        where: { applicationId: id },
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      }),
    ]);

    return {
      ...this.summary(application),
      applicantNickname: user?.nickname ?? "已注销账户",
      applicantPhone: user?.phone ?? null,
      reviewedById: application.reviewedById,
      reviewedAt: application.reviewedAt?.toISOString() ?? null,
      verificationMethod: application.verificationMethod,
      verificationReference: application.verificationReference,
      events: events.map((event) => ({
        id: event.id,
        actorId: event.actorId,
        action: event.action,
        fromStatus: event.fromStatus as ProviderQualificationStatus | null,
        toStatus: event.toStatus as ProviderQualificationStatus,
        reason: event.reason,
        createdAt: event.createdAt.toISOString(),
      })),
    };
  }

  /** Material bytes are never converted into a signed or public URL. */
  async materialForAdmin(
    actorId: string,
    id: string,
    kind: ProviderQualificationMaterialKind,
  ): Promise<{ body: Buffer; mimeType: string }> {
    const application = await this.prisma.providerQualificationApplication.findUnique({
      where: { id },
    });

    if (!application) {
      throw failure("QUALIFICATION_NOT_FOUND", "资格申请不存在", HttpStatus.NOT_FOUND);
    }

    const fields = materialFields(kind);
    const key = application[fields.key];
    const mimeType = application[fields.mime];

    if (!key || !mimeType || application.purgedAt) {
      throw failure("QUALIFICATION_MATERIAL_NOT_FOUND", "资格材料不可用", HttpStatus.NOT_FOUND);
    }

    const body = await this.storage.read(key);

    await this.prisma.providerQualificationEvent.create({
      data: {
        applicationId: id,
        applicantId: application.applicantId,
        actorId,
        action: `read_${kind}`,
        fromStatus: application.status,
        toStatus: application.status,
      },
    });

    return { body, mimeType };
  }

  /** Approval requires an independent verification reference and updates eligibility atomically. */
  async review(
    actorId: string,
    id: string,
    decision: "approve" | "reject",
    reason: string,
    method?: string,
    reference?: string,
  ): Promise<AdminProviderQualificationDetail> {
    const explanation = reason.trim();
    const verificationMethod = method?.trim();
    const verificationReference = reference?.trim();

    if (explanation.length < 5) {
      throw failure(
        "QUALIFICATION_REVIEW_REASON_REQUIRED",
        "请填写具体审核理由",
        HttpStatus.BAD_REQUEST,
      );
    }

    await this.prisma.$transaction(async (tx) => {
      const candidate = await tx.providerQualificationApplication.findUnique({
        where: { id },
        select: { applicantId: true },
      });

      if (!candidate) {
        throw failure("QUALIFICATION_NOT_FOUND", "资格申请不存在", HttpStatus.NOT_FOUND);
      }

      const users = await tx.$queryRaw<Array<{ id: string }>>`
        SELECT "id" FROM "users" WHERE "id" = ${candidate.applicantId}
          AND "status" = 'active' AND "phone" IS NOT NULL AND BTRIM("phone") <> '' FOR UPDATE
      `;

      if (users.length === 0) {
        throw failure("QUALIFICATION_ACCOUNT_INCOMPLETE", "申请人账号已失效", HttpStatus.CONFLICT);
      }

      await tx.$queryRaw`SELECT "id" FROM "provider_qualification_applications" WHERE "id" = ${id} FOR UPDATE`;
      const application = await tx.providerQualificationApplication.findUnique({ where: { id } });

      if (!application) {
        throw failure("QUALIFICATION_NOT_FOUND", "资格申请不存在", HttpStatus.NOT_FOUND);
      }

      if (application.status !== "pending") {
        throw failure("QUALIFICATION_STATE_CONFLICT", "资格申请已处理", HttpStatus.CONFLICT);
      }

      if (application.applicantId === actorId) {
        throw failure("QUALIFICATION_SELF_REVIEW", "不能审核本人资格", HttpStatus.FORBIDDEN);
      }

      if (decision === "approve" && (!verificationMethod || !verificationReference)) {
        throw failure(
          "QUALIFICATION_VERIFICATION_REQUIRED",
          "通过前需记录独立核验方式与凭证编号",
          HttpStatus.BAD_REQUEST,
        );
      }

      const approved = decision === "approve";

      if (approved) {
        await tx.user.update({
          where: { id: application.applicantId },
          data: { userType: "provider" },
        });
        await tx.provider.upsert({
          where: { userId: application.applicantId },
          create: {
            userId: application.applicantId,
            idCardVerified: true,
            trainingPassed: true,
            certifiedSitter: true,
          },
          update: { idCardVerified: true, trainingPassed: true, certifiedSitter: true },
        });
      }

      const status = approved ? "approved" : "rejected";

      await tx.providerQualificationApplication.update({
        where: { id },
        data: {
          status,
          reviewedById: actorId,
          reviewedAt: new Date(),
          reviewReason: explanation,
          verificationMethod: approved ? verificationMethod : null,
          verificationReference: approved ? verificationReference : null,
          purgeAfter: approved ? null : purgeDate(),
        },
      });
      await tx.providerQualificationEvent.create({
        data: {
          applicationId: id,
          applicantId: application.applicantId,
          actorId,
          action: status,
          fromStatus: "pending",
          toStatus: status,
          reason: explanation,
        },
      });
    });

    return this.detailForAdmin(id);
  }

  /** Revocation locks the same rows used by the order eligibility gate. */
  async revoke(
    actorId: string,
    id: string,
    reason: string,
  ): Promise<AdminProviderQualificationDetail> {
    const explanation = reason.trim();

    if (explanation.length < 5) {
      throw failure(
        "QUALIFICATION_REVIEW_REASON_REQUIRED",
        "请填写具体撤销理由",
        HttpStatus.BAD_REQUEST,
      );
    }

    await this.prisma.$transaction(async (tx) => {
      const candidate = await tx.providerQualificationApplication.findUnique({
        where: { id },
        select: { applicantId: true },
      });

      if (!candidate) {
        throw failure("QUALIFICATION_NOT_FOUND", "资格申请不存在", HttpStatus.NOT_FOUND);
      }

      await tx.$queryRaw`SELECT "id" FROM "users" WHERE "id" = ${candidate.applicantId} FOR UPDATE`;
      await tx.$queryRaw`SELECT "id" FROM "provider_qualification_applications" WHERE "id" = ${id} FOR UPDATE`;
      const application = await tx.providerQualificationApplication.findUnique({ where: { id } });

      if (!application) {
        throw failure("QUALIFICATION_NOT_FOUND", "资格申请不存在", HttpStatus.NOT_FOUND);
      }

      if (application.status !== "approved") {
        throw failure("QUALIFICATION_STATE_CONFLICT", "当前资格不可撤销", HttpStatus.CONFLICT);
      }

      if (application.applicantId === actorId) {
        throw failure("QUALIFICATION_SELF_REVIEW", "不能撤销本人资格", HttpStatus.FORBIDDEN);
      }

      const projection = await tx.provider.updateMany({
        where: { userId: application.applicantId },
        data: { idCardVerified: false, trainingPassed: false, certifiedSitter: false },
      });

      if (projection.count !== 1) {
        throw failure("QUALIFICATION_STATE_CONFLICT", "资格投影已失效", HttpStatus.CONFLICT);
      }

      await tx.providerQualificationApplication.update({
        where: { id },
        data: {
          status: "revoked",
          revokedById: actorId,
          revokedAt: new Date(),
          revokeReason: explanation,
          purgeAfter: purgeDate(),
        },
      });
      await tx.providerQualificationEvent.create({
        data: {
          applicationId: id,
          applicantId: application.applicantId,
          actorId,
          action: "revoked",
          fromStatus: "approved",
          toStatus: "revoked",
          reason: explanation,
        },
      });
    });

    return this.detailForAdmin(id);
  }

  /** Retains rejected/revoked material for appeal, then removes every private object. */
  async purgeExpired(): Promise<number> {
    const rows = await this.prisma.providerQualificationApplication.findMany({
      where: {
        status: { in: ["draft", "expired", "rejected", "revoked", "withdrawn"] },
        purgeAfter: { lte: new Date() },
        purgedAt: null,
      },
      orderBy: { purgeAfter: "asc" },
      take: 50,
    });
    let purged = 0;

    // Cleanup is bounded and sequential so storage failures cannot hide unprocessed rows.
    /* eslint-disable no-await-in-loop */
    for (const row of rows) {
      try {
        if (row.status === "draft") {
          await this.prisma.$transaction(async (tx) => {
            const claimed = await tx.providerQualificationApplication.updateMany({
              where: { id: row.id, status: "draft", purgeAfter: { lte: new Date() } },
              data: { status: "expired" },
            });

            if (claimed.count) {
              await tx.providerQualificationEvent.create({
                data: {
                  applicationId: row.id,
                  applicantId: row.applicantId,
                  actorId: "system",
                  action: "expired",
                  fromStatus: "draft",
                  toStatus: "expired",
                },
              });
            }
          });
        }

        const current = await this.prisma.providerQualificationApplication.findUnique({
          where: { id: row.id },
        });

        if (
          !current ||
          current.purgedAt ||
          !["expired", "rejected", "revoked", "withdrawn"].includes(current.status)
        ) {
          continue;
        }

        await Promise.all(
          [current.idCardFrontKey, current.idCardBackKey, current.trainingKey]
            .filter((key): key is string => Boolean(key))
            .map((key) => this.storage.delete(key)),
        );

        const count = await this.prisma.$transaction(async (tx) => {
          const updated = await tx.providerQualificationApplication.updateMany({
            where: { id: row.id, status: current.status, purgedAt: null },
            data: {
              idCardFrontKey: null,
              idCardFrontMime: null,
              idCardBackKey: null,
              idCardBackMime: null,
              trainingKey: null,
              trainingMime: null,
              purgedAt: new Date(),
            },
          });

          if (updated.count) {
            await tx.providerQualificationEvent.create({
              data: {
                applicationId: row.id,
                applicantId: row.applicantId,
                actorId: "system",
                action: "materials_purged",
                fromStatus: current.status,
                toStatus: current.status,
              },
            });
          }

          return updated.count;
        });

        purged += count;
      } catch {
        this.logger.warn("Qualification material purge failed and will retry");
      }
    }
    /* eslint-enable no-await-in-loop */

    return purged;
  }

  private summary(row: ProviderQualificationApplication): ProviderQualificationSummary {
    return {
      id: row.id,
      applicantId: row.applicantId,
      status: row.status as ProviderQualificationStatus,
      materialKinds: KINDS.filter((kind) => Boolean(row[materialFields(kind).key])),
      consentedAt: row.consentedAt?.toISOString() ?? null,
      decisionReason: row.revokeReason ?? row.reviewReason,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }
}
