import { randomUUID } from "node:crypto";
import { HttpStatus, Injectable } from "@nestjs/common";
import {
  COMPLAINT_STATUS,
  type ComplaintStatus,
  type CreateComplaintRequest,
  type SubmitComplaintStatementRequest,
} from "@petcare/shared-types";
import { DISPUTE_RESOLVE_PERMISSION_CODE } from "../../auth/dispute-resolver.guard";
import { ApiException } from "../../common/http/api-exception";
import type { Prisma } from "../../generated/prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { assertComplaintAction, type ComplaintActionContext } from "./complaint-state-machine";

const initialStatementStage = "initial";
const responseStatementStage = "response";
const secondAppealStatementStage = "second_appeal";
const maxCreateAttempts = 3;

type ComplaintCommandRecord = {
  id: string;
  complainantId: string;
  respondentId: string;
  assignedAdminId: string | null;
  status: string;
  appealDeadlineAt: Date | null;
  version: number;
};

/** 执行后台投诉命令的管理员身份。 */
export interface AdminActor {
  /** 当前管理员唯一标识。 */
  id: string;
  /** 当前访问令牌携带的已授权角色代码。 */
  roles: string[];
}

@Injectable()
export class ComplaintCommandService {
  constructor(private readonly prisma: PrismaService) {}

  /** 为订单当事方创建投诉及首份陈述。 */
  async createComplaint(actorId: string, request: CreateComplaintRequest): Promise<string> {
    const order = await this.prisma.order.findUnique({
      where: { id: request.orderId },
      select: { id: true, ownerId: true, providerId: true, status: true },
    });

    if (!order) {
      throw new ApiException("RESOURCE_NOT_FOUND", "订单不存在", HttpStatus.NOT_FOUND);
    }

    let respondentId: string | null = null;

    if (actorId === order.ownerId) {
      respondentId = order.providerId;
    } else if (actorId === order.providerId) {
      respondentId = order.ownerId;
    }

    if (!respondentId) {
      throw new ApiException("FORBIDDEN", "仅订单当事方可以发起投诉", HttpStatus.FORBIDDEN);
    }

    return this.createWithRetry(actorId, respondentId, request, maxCreateAttempts);
  }

  /** 遇到串行化冲突时复查开放投诉并有界重试整个创建事务。 */
  private async createWithRetry(
    actorId: string,
    respondentId: string,
    request: CreateComplaintRequest,
    attemptsRemaining: number,
  ): Promise<string> {
    try {
      return await this.createInTransaction(actorId, respondentId, request);
    } catch (error) {
      if (!this.isSerializationFailure(error)) {
        throw error;
      }

      const existing = await this.prisma.complaint.findFirst({
        where: this.openComplaintWhere(request.orderId),
        select: { id: true },
      });

      if (existing || attemptsRemaining === 1) {
        throw this.openComplaintExists();
      }

      return this.createWithRetry(actorId, respondentId, request, attemptsRemaining - 1);
    }
  }

  /** 以串行化事务检查开放投诉并写入投诉、陈述及事件。 */
  private createInTransaction(
    actorId: string,
    respondentId: string,
    request: CreateComplaintRequest,
  ): Promise<string> {
    return this.prisma.$transaction(
      async (transaction) => {
        const existing = await transaction.complaint.findFirst({
          where: this.openComplaintWhere(request.orderId),
          select: { id: true },
        });

        if (existing) {
          throw this.openComplaintExists();
        }

        const id = randomUUID();
        const caseNumber = `CP${id.replaceAll("-", "").toUpperCase()}`;

        const complaint = await transaction.complaint.create({
          data: {
            id,
            caseNumber,
            orderId: request.orderId,
            complainantId: actorId,
            respondentId,
            complaintType: request.complaintType.trim(),
            expectedSolution: request.expectedSolution.trim(),
            status: COMPLAINT_STATUS.PENDING_RESPONSE,
            statements: {
              create: {
                stage: initialStatementStage,
                authorId: actorId,
                statement: request.reason.trim(),
                evidenceUrls: request.evidenceUrls,
              },
            },
          },
          select: { id: true },
        });

        await transaction.complaintEvent.create({
          data: {
            complaintId: complaint.id,
            actorId,
            action: "create",
            fromStatus: null,
            toStatus: COMPLAINT_STATUS.PENDING_RESPONSE,
          },
        });

        return complaint.id;
      },
      { isolationLevel: "Serializable" },
    );
  }

  /** 构建同一订单开放投诉的查询条件。 */
  private openComplaintWhere(orderId: string) {
    return {
      orderId,
      status: { notIn: [COMPLAINT_STATUS.CLOSED, COMPLAINT_STATUS.WITHDRAWN] },
    };
  }

  /** 判断错误是否为 Prisma 串行化事务冲突。 */
  private isSerializationFailure(error: unknown): boolean {
    return typeof error === "object" && error !== null && "code" in error && error.code === "P2034";
  }

  /** 返回开放投诉冲突的稳定客户端异常。 */
  private openComplaintExists(): ApiException {
    return new ApiException("OPEN_COMPLAINT_EXISTS", "该订单已有处理中投诉", HttpStatus.CONFLICT);
  }

  /** 提交被投诉方的唯一一次首次回应并进入待认领状态。 */
  async respond(
    id: string,
    actorId: string,
    request: SubmitComplaintStatementRequest,
  ): Promise<string> {
    const statement = request.statement.trim();

    if (!statement) {
      throw new ApiException(
        "COMPLAINT_RESPONSE_REQUIRED",
        "首次回应必须填写陈述内容",
        HttpStatus.BAD_REQUEST,
      );
    }

    return this.prisma.$transaction(async (transaction) => {
      const complaint = await this.findComplaint(transaction, id);

      this.assertAction(complaint, actorId, false, "respond");

      await this.updateStatus(transaction, complaint, request.version, COMPLAINT_STATUS.UNASSIGNED);
      await transaction.complaintStatement.create({
        data: {
          complaintId: id,
          stage: responseStatementStage,
          authorId: actorId,
          statement,
          evidenceUrls: request.evidenceUrls,
        },
      });
      await this.createEvent(
        transaction,
        complaint,
        actorId,
        "respond",
        COMPLAINT_STATUS.UNASSIGNED,
      );

      return id;
    });
  }

  /** 在截止时间前提交当前订单当事方唯一一次二次申诉。 */
  async submitSecondAppeal(
    id: string,
    actorId: string,
    request: SubmitComplaintStatementRequest,
  ): Promise<string> {
    return this.prisma.$transaction(async (transaction) => {
      const complaint = await transaction.complaint.findUnique({
        where: { id },
        select: {
          id: true,
          complainantId: true,
          respondentId: true,
          assignedAdminId: true,
          status: true,
          appealDeadlineAt: true,
          version: true,
          statements: { select: { statement: true, evidenceUrls: true } },
        },
      });

      if (!complaint) {
        throw new ApiException("RESOURCE_NOT_FOUND", "投诉不存在", HttpStatus.NOT_FOUND);
      }

      const isOrderParty =
        actorId === complaint.complainantId || actorId === complaint.respondentId;
      const isAppealState =
        complaint.status === COMPLAINT_STATUS.INITIAL_DECIDED ||
        complaint.status === COMPLAINT_STATUS.PROCESSING_FINAL;

      if (
        isOrderParty &&
        isAppealState &&
        complaint.appealDeadlineAt !== null &&
        new Date() >= complaint.appealDeadlineAt
      ) {
        throw new ApiException(
          "APPEAL_DEADLINE_EXPIRED",
          "二次申诉期限已结束",
          HttpStatus.CONFLICT,
        );
      }

      const existingAppeal = await transaction.complaintStatement.findUnique({
        where: {
          complaintId_stage_authorId: {
            complaintId: id,
            stage: secondAppealStatementStage,
            authorId: actorId,
          },
        },
        select: { id: true },
      });

      this.assertAction(complaint, actorId, Boolean(existingAppeal), "second_appeal");

      const previousEvidence = new Set(
        complaint.statements.flatMap((statement) => statement.evidenceUrls),
      );
      const previousReasons = new Set(
        complaint.statements.map((statement) => statement.statement.trim()),
      );
      const reason = request.statement.trim();
      const hasNewEvidence = request.evidenceUrls.some((url) => !previousEvidence.has(url));
      const hasNewReason = Boolean(reason) && !previousReasons.has(reason);

      if (!hasNewReason && !hasNewEvidence) {
        throw new ApiException(
          "NEW_APPEAL_MATERIAL_REQUIRED",
          "二次申诉必须提供新理由或新证据",
          HttpStatus.BAD_REQUEST,
        );
      }

      const nextStatus = COMPLAINT_STATUS.PROCESSING_FINAL;

      await this.updateStatus(transaction, complaint, request.version, nextStatus);
      await transaction.complaintStatement.create({
        data: {
          complaintId: id,
          stage: secondAppealStatementStage,
          authorId: actorId,
          statement: reason,
          evidenceUrls: request.evidenceUrls,
        },
      });
      await this.createEvent(transaction, complaint, actorId, "second_appeal", nextStatus);

      return id;
    });
  }

  /** 以状态和版本条件原子认领未分配案件。 */
  async claim(id: string, admin: AdminActor, version: number): Promise<string> {
    return this.prisma.$transaction(async (transaction) => {
      const complaint = await this.findComplaint(transaction, id);

      assertComplaintAction(this.toAdminActionContext(complaint, admin), "claim");

      const updated = await transaction.complaint.updateMany({
        where: {
          id,
          status: COMPLAINT_STATUS.UNASSIGNED,
          version,
        },
        data: {
          assignedAdminId: admin.id,
          status: COMPLAINT_STATUS.PROCESSING_INITIAL,
          version: { increment: 1 },
        },
      });

      this.assertUpdated(updated.count);
      await transaction.complaintAssignment.create({
        data: {
          complaintId: id,
          assigneeAdminId: admin.id,
          assignedByAdminId: admin.id,
        },
      });
      await this.createEvent(
        transaction,
        complaint,
        admin.id,
        "claim",
        COMPLAINT_STATUS.PROCESSING_INITIAL,
      );

      return id;
    });
  }

  /** 由当前处理人或超级管理员将案件转交给有效管理员。 */
  async transfer(
    id: string,
    admin: AdminActor,
    targetAdminId: string,
    reason: string,
    version: number,
  ): Promise<string> {
    return this.prisma.$transaction(async (transaction) => {
      const complaint = await this.findComplaint(transaction, id);

      assertComplaintAction(this.toAdminActionContext(complaint, admin), "transfer");

      if (targetAdminId === complaint.complainantId || targetAdminId === complaint.respondentId) {
        throw new ApiException(
          "COMPLAINT_PARTY_CANNOT_BE_ASSIGNEE",
          "订单当事方不能处理自己的投诉案件",
          HttpStatus.BAD_REQUEST,
        );
      }

      const targetAdmin = await transaction.user.findFirst({
        where: {
          id: targetAdminId,
          status: "active",
          roles: {
            some: {
              role: {
                isActive: true,
                OR: [
                  { roleName: "super_admin" },
                  {
                    permissions: {
                      some: {
                        permission: {
                          permissionCode: DISPUTE_RESOLVE_PERMISSION_CODE,
                        },
                      },
                    },
                  },
                ],
              },
            },
          },
        },
        select: { id: true },
      });

      if (!targetAdmin) {
        throw new ApiException(
          "INVALID_COMPLAINT_ASSIGNEE",
          "目标用户不是有效管理员",
          HttpStatus.BAD_REQUEST,
        );
      }

      const transferReason = reason.trim();

      if (!transferReason) {
        throw new ApiException(
          "COMPLAINT_TRANSFER_REASON_REQUIRED",
          "转交案件必须填写原因",
          HttpStatus.BAD_REQUEST,
        );
      }

      const updated = await transaction.complaint.updateMany({
        where: {
          id,
          status: complaint.status,
          version,
        },
        data: {
          assignedAdminId: targetAdminId,
          version: { increment: 1 },
        },
      });

      this.assertUpdated(updated.count);
      await transaction.complaintAssignment.create({
        data: {
          complaintId: id,
          assigneeAdminId: targetAdminId,
          assignedByAdminId: admin.id,
        },
      });
      await transaction.complaintEvent.create({
        data: {
          complaintId: id,
          actorId: admin.id,
          action: "transfer",
          fromStatus: complaint.status,
          toStatus: complaint.status,
          payload: JSON.stringify({ targetAdminId, reason: transferReason }),
        },
      });

      return id;
    });
  }

  /** 允许投诉方在初裁前撤回投诉。 */
  async withdraw(id: string, actorId: string, version: number): Promise<string> {
    return this.prisma.$transaction(async (transaction) => {
      const complaint = await this.findComplaint(transaction, id);

      this.assertAction(complaint, actorId, false, "withdraw");

      const updated = await transaction.complaint.updateMany({
        where: { id, status: complaint.status, version },
        data: {
          status: COMPLAINT_STATUS.WITHDRAWN,
          closedAt: new Date(),
          version: { increment: 1 },
        },
      });

      this.assertUpdated(updated.count);
      await this.createEvent(
        transaction,
        complaint,
        actorId,
        "withdraw",
        COMPLAINT_STATUS.WITHDRAWN,
      );

      return id;
    });
  }

  /** 查询命令执行所需的最小投诉状态。 */
  private async findComplaint(
    transaction: Prisma.TransactionClient,
    id: string,
  ): Promise<ComplaintCommandRecord> {
    const complaint = await transaction.complaint.findUnique({
      where: { id },
      select: {
        id: true,
        complainantId: true,
        respondentId: true,
        assignedAdminId: true,
        status: true,
        appealDeadlineAt: true,
        version: true,
      },
    });

    if (!complaint) {
      throw new ApiException("RESOURCE_NOT_FOUND", "投诉不存在", HttpStatus.NOT_FOUND);
    }

    return complaint;
  }

  /** 按数据库状态与当前访问者断言命令权限。 */
  private assertAction(
    complaint: ComplaintCommandRecord,
    actorId: string,
    hasSecondAppealed: boolean,
    action: "respond" | "second_appeal" | "withdraw",
  ): void {
    assertComplaintAction(this.toActionContext(complaint, actorId, hasSecondAppealed), action);
  }

  /** 构建面向当前订单当事方的纯状态机上下文。 */
  private toActionContext(
    complaint: ComplaintCommandRecord,
    actorId: string,
    hasSecondAppealed: boolean,
  ): ComplaintActionContext {
    let viewerRole: ComplaintActionContext["viewerRole"] = "other";

    if (actorId === complaint.complainantId) {
      viewerRole = "complainant";
    } else if (actorId === complaint.respondentId) {
      viewerRole = "respondent";
    }

    return {
      status: complaint.status as ComplaintStatus,
      viewerId: actorId,
      viewerRole,
      assignedAdminId: complaint.assignedAdminId,
      isSuperAdmin: false,
      isOrderParty: viewerRole !== "other",
      appealDeadlineAt: complaint.appealDeadlineAt,
      hasSecondAppealed,
      hasFailedExecution: false,
      now: new Date(),
    };
  }

  /** 构建后台命令的状态机上下文，超级管理员身份仅来自角色代码。 */
  private toAdminActionContext(
    complaint: ComplaintCommandRecord,
    admin: AdminActor,
  ): ComplaintActionContext {
    return {
      status: complaint.status as ComplaintStatus,
      viewerId: admin.id,
      viewerRole: "admin",
      assignedAdminId: complaint.assignedAdminId,
      isSuperAdmin: admin.roles.includes("super_admin"),
      isOrderParty: admin.id === complaint.complainantId || admin.id === complaint.respondentId,
      appealDeadlineAt: complaint.appealDeadlineAt,
      hasSecondAppealed: false,
      hasFailedExecution: false,
      now: new Date(),
    };
  }

  /** 以状态和版本双条件更新投诉。 */
  private async updateStatus(
    transaction: Prisma.TransactionClient,
    complaint: ComplaintCommandRecord,
    version: number,
    nextStatus: ComplaintStatus,
  ): Promise<void> {
    const updated = await transaction.complaint.updateMany({
      where: { id: complaint.id, status: complaint.status, version },
      data: {
        status: nextStatus,
        version: { increment: 1 },
      },
    });

    this.assertUpdated(updated.count);
  }

  /** 断言条件更新成功，避免覆盖并发状态变化。 */
  private assertUpdated(count: number): void {
    if (count === 0) {
      throw new ApiException(
        "COMPLAINT_STATE_CONFLICT",
        "投诉状态已变化，请刷新后重试",
        HttpStatus.CONFLICT,
      );
    }
  }

  /** 在事务中记录用户命令对应的投诉事件。 */
  private async createEvent(
    transaction: Prisma.TransactionClient,
    complaint: ComplaintCommandRecord,
    actorId: string,
    action: string,
    toStatus: ComplaintStatus,
  ): Promise<void> {
    await transaction.complaintEvent.create({
      data: {
        complaintId: complaint.id,
        actorId,
        action,
        fromStatus: complaint.status,
        toStatus,
      },
    });
  }
}
