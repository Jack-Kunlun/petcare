import { HttpStatus, Injectable } from "@nestjs/common";
import {
  COMPLAINT_STATUS,
  type ComplaintStatus,
  type CreateComplaintRequest,
  type SubmitComplaintStatementRequest,
} from "@petcare/shared-types";
import { ApiException } from "../../common/http/api-exception";
import type { Prisma } from "../../generated/prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { assertComplaintAction, type ComplaintActionContext } from "./complaint-state-machine";

const initialStatementStage = "initial";
const responseStatementStage = "response";
const secondAppealStatementStage = "second_appeal";

type ComplaintCommandRecord = {
  id: string;
  complainantId: string;
  respondentId: string;
  assignedAdminId: string | null;
  status: string;
  appealDeadlineAt: Date | null;
  version: number;
};

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

    return this.prisma.$transaction(
      async (transaction) => {
        const existing = await transaction.complaint.findFirst({
          where: {
            orderId: order.id,
            status: { notIn: [COMPLAINT_STATUS.CLOSED, COMPLAINT_STATUS.WITHDRAWN] },
          },
          select: { id: true },
        });

        if (existing) {
          throw new ApiException(
            "OPEN_COMPLAINT_EXISTS",
            "该订单已有处理中投诉",
            HttpStatus.CONFLICT,
          );
        }

        const complaint = await transaction.complaint.create({
          data: {
            orderId: order.id,
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
