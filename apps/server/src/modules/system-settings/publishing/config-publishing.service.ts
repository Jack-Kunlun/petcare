import { Inject, Injectable } from "@nestjs/common";
import {
  PublishSystemConfigCommand,
  PublishSystemConfigResponse,
  RestoreSystemConfigResponse,
  RestoreSystemConfigRequest,
  SaveSystemConfigDraftRequest,
  SystemConfigDiffResponse,
  SystemConfigDomain,
  SystemConfigDraft,
  SystemConfigVersion as PublishedConfigVersion,
  SystemConfigVersionListResponse,
} from "@petcare/shared-types";
import { SystemConfigVersion } from "../../../generated/prisma/client";
import { PrismaService } from "../../../prisma/prisma.service";
import { systemConfigNotFound, systemConfigVersionConflict } from "../system-settings.errors";
import { ConfigDiffService } from "./config-diff.service";
import {
  CONFIG_DOMAIN_ADAPTERS,
  ConfigDomainAdapter,
  PrismaTransaction,
} from "./config-domain.adapter";

const DRAFT_SLOT = "active";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function normalizedConstraintField(value: unknown): string {
  return typeof value === "string" ? value.replaceAll(/[^a-z]/giu, "").toLowerCase() : "";
}

function isDraftSlotConflict(error: unknown): boolean {
  if (!isRecord(error) || error.code !== "P2002") {
    return false;
  }

  const meta = isRecord(error.meta) ? error.meta : {};
  const modelName = meta.modelName ?? error.modelName;

  if (modelName !== "SystemConfigVersion") {
    return false;
  }

  if (Array.isArray(meta.target)) {
    const target = new Set(meta.target.map(normalizedConstraintField));

    return target.size === 2 && target.has("configkey") && target.has("draftslot");
  }

  const target = normalizedConstraintField(meta.target);

  return target.includes("configkey") && target.includes("draftslot");
}

/** 管理草稿、发布、历史恢复、幂等和审计的领域无关内核。 */
@Injectable()
export class ConfigPublishingService {
  private readonly adapters: Map<SystemConfigDomain, ConfigDomainAdapter<unknown>>;

  /** 创建领域无关的配置发布内核。 */
  constructor(
    private readonly prisma: PrismaService,
    @Inject(CONFIG_DOMAIN_ADAPTERS)
    adapters: ConfigDomainAdapter<unknown>[],
    private readonly diffService: ConfigDiffService,
  ) {
    this.adapters = new Map(adapters.map((adapter) => [adapter.domain, adapter]));
  }

  /** 获取指定领域的唯一活动草稿。 */
  async getDraft<TConfig>(domain: SystemConfigDomain): Promise<SystemConfigDraft<TConfig> | null> {
    const draft = await this.prisma.systemConfigVersion.findFirst({
      where: { configKey: domain, status: "draft", draftSlot: DRAFT_SLOT },
    });

    if (!draft) {
      return null;
    }

    const config = (await this.adapter(domain).load(
      draft.id,
      this.prisma as unknown as PrismaTransaction,
    )) as TConfig;

    return this.toDraft(draft, config);
  }

  /** 使用乐观锁创建或保存指定领域的唯一活动草稿。 */
  async saveDraft<TConfig>(
    domain: SystemConfigDomain,
    request: SaveSystemConfigDraftRequest<TConfig>,
    actorId: string,
  ): Promise<SystemConfigDraft<TConfig>> {
    const adapter = this.adapter<TConfig>(domain);

    adapter.validate(request.config);

    try {
      return await this.prisma.$transaction(async (tx) => {
        const existing = await tx.systemConfigVersion.findFirst({
          where: { configKey: domain, status: "draft", draftSlot: DRAFT_SLOT },
        });

        let draft: SystemConfigVersion;

        if (existing) {
          const result = await tx.systemConfigVersion.updateMany({
            where: { id: existing.id, revision: request.revision, status: "draft" },
            data: {
              revision: { increment: 1 },
              updatedById: actorId,
              changeSummary: request.changeSummary,
            },
          });

          if (result.count !== 1) {
            throw systemConfigVersionConflict();
          }

          await adapter.persist(existing.id, request.config, tx);
          draft = await tx.systemConfigVersion.findUniqueOrThrow({ where: { id: existing.id } });
        } else {
          if (request.revision !== 0) {
            throw systemConfigVersionConflict();
          }

          const latest = await tx.systemConfigVersion.findFirst({
            where: { configKey: domain },
            orderBy: { businessVersion: "desc" },
          });

          draft = await tx.systemConfigVersion.create({
            data: {
              configKey: domain,
              status: "draft",
              businessVersion: (latest?.businessVersion ?? 0) + 1,
              revision: 1,
              draftSlot: DRAFT_SLOT,
              createdById: actorId,
              updatedById: actorId,
              changeSummary: request.changeSummary,
            },
          });
          await adapter.persist(draft.id, request.config, tx);
        }

        await tx.systemConfigAuditEvent.create({
          data: {
            configKey: domain,
            configVersionId: draft.id,
            operatorId: actorId,
            action: "save_draft",
            idempotencyKey: `save:${draft.id}:${draft.revision}`,
            changeSummary: request.changeSummary,
          },
        });

        return this.toDraft(draft, request.config);
      });
    } catch (error) {
      if (isDraftSlotConflict(error)) {
        throw systemConfigVersionConflict();
      }

      throw error;
    }
  }

  /** 比较当前发布版本与活动草稿的字段级差异。 */
  async getDiff(domain: SystemConfigDomain): Promise<SystemConfigDiffResponse> {
    const [draft, pointer] = await Promise.all([
      this.prisma.systemConfigVersion.findFirst({
        where: { configKey: domain, status: "draft", draftSlot: DRAFT_SLOT },
      }),
      this.prisma.systemConfigPointer.findUnique({ where: { configKey: domain } }),
    ]);

    if (!draft || !pointer) {
      return [];
    }

    const adapter = this.adapter(domain);
    const tx = this.prisma as unknown as PrismaTransaction;
    const [before, after] = await Promise.all([
      adapter.load(pointer.publishedVersionId, tx),
      adapter.load(draft.id, tx),
    ]);

    return this.diffService.compare({
      before: adapter.summarize(before),
      after: adapter.summarize(after),
      arrayKeyStrategies: adapter.arrayKeyStrategies,
    });
  }

  /** 按业务版本倒序列出已发布和已归档历史。 */
  async listHistory<TConfig>(
    domain: SystemConfigDomain,
    page = 1,
    pageSize = 20,
  ): Promise<SystemConfigVersionListResponse<TConfig>> {
    const where = { configKey: domain, status: { in: ["published", "superseded"] } };
    const [versions, total] = await Promise.all([
      this.prisma.systemConfigVersion.findMany({
        where,
        orderBy: { businessVersion: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.systemConfigVersion.count({ where }),
    ]);
    const adapter = this.adapter<TConfig>(domain);
    const tx = this.prisma as unknown as PrismaTransaction;
    const list = await Promise.all(
      versions.map(async (version) =>
        this.toPublished(version, await adapter.load(version.id, tx)),
      ),
    );

    return { list, total, page, pageSize };
  }

  /** 按 ID 获取属于指定领域的已发布或已归档历史版本。 */
  async getVersion<TConfig>(
    domain: SystemConfigDomain,
    versionId: string,
  ): Promise<PublishedConfigVersion<TConfig>> {
    const version = await this.prisma.systemConfigVersion.findFirst({
      where: {
        id: versionId,
        configKey: domain,
        status: { in: ["published", "superseded"] },
      },
    });

    if (!version) {
      throw systemConfigNotFound();
    }

    const config = await this.adapter<TConfig>(domain).load(
      version.id,
      this.prisma as unknown as PrismaTransaction,
    );

    return this.toPublished(version, config);
  }

  /** 原子发布草稿；相同幂等键始终返回首次发布结果。 */
  async publish<TConfig>(
    domain: SystemConfigDomain,
    command: PublishSystemConfigCommand,
  ): Promise<PublishSystemConfigResponse<TConfig>> {
    try {
      const prior = await this.findIdempotentResult<TConfig>(domain, command.idempotencyKey);

      if (prior) {
        return prior;
      }
    } catch (error) {
      return this.failPublish(domain, command, error);
    }

    try {
      return await this.prisma.$transaction(async (tx) => {
        const duplicate = await this.findIdempotentResult<TConfig>(
          domain,
          command.idempotencyKey,
          tx,
        );

        if (duplicate) {
          return duplicate;
        }

        const draft = await tx.systemConfigVersion.findFirst({
          where: { configKey: domain, status: "draft", draftSlot: DRAFT_SLOT },
        });

        if (!draft) {
          throw systemConfigNotFound();
        }

        const adapter = this.adapter<TConfig>(domain);
        const config = await adapter.load(draft.id, tx);

        adapter.validate(config);

        const pointer = await tx.systemConfigPointer.findUnique({ where: { configKey: domain } });

        if (pointer) {
          await tx.systemConfigVersion.update({
            where: { id: pointer.publishedVersionId },
            data: { status: "superseded" },
          });
        }

        const changed = await tx.systemConfigVersion.updateMany({
          where: {
            id: draft.id,
            revision: command.revision,
            status: "draft",
            draftSlot: DRAFT_SLOT,
          },
          data: {
            status: "published",
            draftSlot: null,
            revision: { increment: 1 },
            updatedById: command.actorId,
            publishedById: command.actorId,
            publishedAt: new Date(),
            idempotencyKey: command.idempotencyKey,
          },
        });

        if (changed.count !== 1) {
          throw systemConfigVersionConflict();
        }

        await tx.systemConfigPointer.upsert({
          where: { configKey: domain },
          update: { publishedVersionId: draft.id },
          create: { configKey: domain, publishedVersionId: draft.id },
        });
        await tx.systemConfigAuditEvent.create({
          data: {
            configKey: domain,
            configVersionId: draft.id,
            operatorId: command.actorId,
            action: "publish",
            idempotencyKey: command.idempotencyKey,
            changeSummary: draft.changeSummary,
          },
        });
        const published = await tx.systemConfigVersion.findUniqueOrThrow({
          where: { id: draft.id },
        });

        return this.toPublished(published, config);
      });
    } catch (error) {
      try {
        const concurrentResult = await this.findIdempotentResult<TConfig>(
          domain,
          command.idempotencyKey,
        );

        if (concurrentResult) {
          return concurrentResult;
        }
      } catch (idempotencyError) {
        return this.failPublish(domain, command, idempotencyError);
      }

      return this.failPublish(domain, command, error);
    }
  }

  /** 将历史版本完整复制为新的唯一活动草稿。 */
  async restoreAsDraft<TConfig>(
    domain: SystemConfigDomain,
    command: RestoreSystemConfigRequest,
    actorId: string,
  ): Promise<RestoreSystemConfigResponse<TConfig>> {
    if (command.revision !== 0) {
      throw systemConfigVersionConflict();
    }

    const adapter = this.adapter<TConfig>(domain);

    try {
      return await this.prisma.$transaction(async (tx) => {
        const existing = await tx.systemConfigVersion.findFirst({
          where: { configKey: domain, status: "draft", draftSlot: DRAFT_SLOT },
        });

        if (existing) {
          throw systemConfigVersionConflict();
        }

        const source = await tx.systemConfigVersion.findFirst({
          where: {
            configKey: domain,
            businessVersion: command.version,
            status: { in: ["published", "superseded"] },
          },
        });

        if (!source) {
          throw systemConfigNotFound();
        }

        const config = await adapter.load(source.id, tx);

        adapter.validate(config);
        const latest = await tx.systemConfigVersion.findFirst({
          where: { configKey: domain },
          orderBy: { businessVersion: "desc" },
        });
        const draft = await tx.systemConfigVersion.create({
          data: {
            configKey: domain,
            status: "draft",
            businessVersion: (latest?.businessVersion ?? 0) + 1,
            revision: 1,
            draftSlot: DRAFT_SLOT,
            createdById: actorId,
            updatedById: actorId,
            sourceVersionId: source.id,
            changeSummary: command.changeSummary,
          },
        });

        await adapter.persist(draft.id, config, tx);
        await tx.systemConfigAuditEvent.create({
          data: {
            configKey: domain,
            configVersionId: draft.id,
            operatorId: actorId,
            action: "restore_as_draft",
            idempotencyKey: `restore:${source.id}:${draft.id}`,
            changeSummary: command.changeSummary,
          },
        });

        return this.toDraft(draft, config);
      });
    } catch (error) {
      if (isDraftSlotConflict(error)) {
        throw systemConfigVersionConflict();
      }

      throw error;
    }
  }

  private adapter<TConfig = unknown>(domain: SystemConfigDomain): ConfigDomainAdapter<TConfig> {
    const adapter = this.adapters.get(domain);

    if (!adapter) {
      throw systemConfigNotFound();
    }

    return adapter as ConfigDomainAdapter<TConfig>;
  }

  private async idempotentResult<TConfig>(
    domain: SystemConfigDomain,
    version: SystemConfigVersion,
    tx: PrismaTransaction = this.prisma as unknown as PrismaTransaction,
  ): Promise<PublishedConfigVersion<TConfig>> {
    if (version.configKey !== domain || !["published", "superseded"].includes(version.status)) {
      throw systemConfigVersionConflict();
    }

    const config = await this.adapter<TConfig>(domain).load(version.id, tx);

    return this.toPublished(version, config);
  }

  private async findIdempotentResult<TConfig>(
    domain: SystemConfigDomain,
    idempotencyKey: string,
    tx: PrismaTransaction = this.prisma as unknown as PrismaTransaction,
  ): Promise<PublishSystemConfigResponse<TConfig> | null> {
    const version = await tx.systemConfigVersion.findUnique({ where: { idempotencyKey } });

    return version ? this.idempotentResult<TConfig>(domain, version, tx) : null;
  }

  private async failPublish(
    domain: SystemConfigDomain,
    command: PublishSystemConfigCommand,
    error: unknown,
  ): Promise<never> {
    await this.recordFailedPublish(domain, command);

    throw error;
  }

  private async recordFailedPublish(
    domain: SystemConfigDomain,
    command: PublishSystemConfigCommand,
  ): Promise<void> {
    try {
      await this.prisma.systemConfigAuditEvent.create({
        data: {
          configKey: domain,
          operatorId: command.actorId,
          action: "publish_failed",
          idempotencyKey: `${command.idempotencyKey}:failed`,
          changeSummary: "配置发布失败",
        },
      });
    } catch {
      // 失败审计不得覆盖原始发布异常。
    }
  }

  private toDraft<TConfig>(
    version: SystemConfigVersion,
    config: TConfig,
  ): SystemConfigDraft<TConfig> {
    return {
      id: version.id,
      domain: version.configKey as SystemConfigDomain,
      revision: version.revision,
      config,
      changeSummary: version.changeSummary,
      updatedBy: version.updatedById,
      updatedAt: version.updatedAt.toISOString(),
    };
  }

  private toPublished<TConfig>(
    version: SystemConfigVersion,
    config: TConfig,
  ): PublishedConfigVersion<TConfig> {
    return {
      id: version.id,
      domain: version.configKey as SystemConfigDomain,
      version: version.businessVersion,
      status: version.status as PublishedConfigVersion<TConfig>["status"],
      config,
      changeSummary: version.changeSummary,
      publishedBy: version.publishedById ?? "",
      publishedAt: version.publishedAt?.toISOString() ?? "",
    };
  }
}
