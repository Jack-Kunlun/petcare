import { HttpStatus, Injectable } from "@nestjs/common";
import {
  COMPLAINT_QUEUE,
  COMPLAINT_STATUS,
  DECISION_LEVEL,
  DISPUTE_EXECUTION_TASK_STATUS,
  type AdminComplaintQueue,
  type AdminComplaintListQuery,
  type AdminComplaintListItem,
  type AdminComplaintListResponse,
  type ComplaintDetail,
  type ComplaintEventView,
  type ComplaintListItem,
  type ComplaintListResponse,
  type ComplaintStatementView,
  type ComplaintStatus,
  type SubmitDisputeDecisionRequest,
} from "@petcare/shared-types";
import { ApiException } from "../../common/http/api-exception";
import type { Prisma } from "../../generated/prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { getAllowedComplaintActions, type ComplaintActionContext } from "./complaint-state-machine";

const publicComplaintListSelect = {
  id: true,
  caseNumber: true,
  orderId: true,
  complaintType: true,
  complainantId: true,
  complainant: { select: { id: true, nickname: true, avatar: true } },
  respondentId: true,
  respondent: { select: { id: true, nickname: true, avatar: true } },
  status: true,
  appealDeadlineAt: true,
  createdAt: true,
  updatedAt: true,
} as const;

type PublicComplaintListRecord = Prisma.ComplaintGetPayload<{
  select: typeof publicComplaintListSelect;
}>;

const complaintListSelect = {
  id: true,
  caseNumber: true,
  orderId: true,
  complaintType: true,
  complainantId: true,
  complainant: { select: { id: true, nickname: true, phone: true } },
  respondentId: true,
  respondent: { select: { id: true, nickname: true, phone: true } },
  status: true,
  assignedAdminId: true,
  assignedAdmin: { select: { id: true, nickname: true, phone: true } },
  appealDeadlineAt: true,
  executionTasks: {
    where: { status: DISPUTE_EXECUTION_TASK_STATUS.FAILED },
    select: { id: true },
  },
  createdAt: true,
  updatedAt: true,
} as const;

type ComplaintListRecord = Prisma.ComplaintGetPayload<{
  select: typeof complaintListSelect;
}>;

const complaintDetailSelect = {
  id: true,
  orderId: true,
  complainantId: true,
  respondentId: true,
  assignedAdminId: true,
  complaintType: true,
  expectedSolution: true,
  status: true,
  appealDeadlineAt: true,
  version: true,
  createdAt: true,
  updatedAt: true,
  statements: {
    orderBy: { createdAt: "asc" as const },
    select: {
      id: true,
      stage: true,
      authorId: true,
      statement: true,
      evidenceUrls: true,
      createdAt: true,
    },
  },
  decisions: {
    orderBy: { createdAt: "asc" as const },
    select: {
      level: true,
      liability: true,
      reason: true,
      refundAmount: true,
      settlementAmount: true,
      complainantCreditDelta: true,
      respondentCreditDelta: true,
    },
  },
  events: {
    orderBy: { createdAt: "asc" as const },
    select: {
      id: true,
      actorId: true,
      action: true,
      fromStatus: true,
      toStatus: true,
      payload: true,
      createdAt: true,
    },
  },
  executionTasks: {
    where: { status: "failed" },
    select: { id: true },
  },
} as const;

type ComplaintDetailRecord = Prisma.ComplaintGetPayload<{
  select: typeof complaintDetailSelect;
}>;

@Injectable()
export class ComplaintQueryService {
  constructor(private readonly prisma: PrismaService) {}

  /** 分页返回当前用户作为任一订单当事方的投诉。 */
  async findMine(userId: string, page = 1, pageSize = 20): Promise<ComplaintListResponse> {
    if (
      !Number.isInteger(page) ||
      !Number.isInteger(pageSize) ||
      page < 1 ||
      pageSize < 1 ||
      pageSize > 100
    ) {
      throw new ApiException(
        "INVALID_PAGINATION",
        "分页参数必须为正整数且每页不超过 100 条",
        HttpStatus.BAD_REQUEST,
      );
    }

    const where = {
      OR: [{ complainantId: userId }, { respondentId: userId }],
    };
    const [records, total] = await Promise.all([
      this.prisma.complaint.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { createdAt: "desc" },
        select: publicComplaintListSelect,
      }),
      this.prisma.complaint.count({ where }),
    ]);

    return {
      list: records.map((record) => this.toPublicListItem(record, userId)),
      total,
      page,
      pageSize,
    };
  }

  /** 按后台筛选条件分页返回投诉案件。 */
  async findAdminPage(
    query: AdminComplaintListQuery,
    adminId: string,
  ): Promise<AdminComplaintListResponse> {
    if (
      !Number.isInteger(query.page) ||
      !Number.isInteger(query.pageSize) ||
      query.page < 1 ||
      query.pageSize < 1 ||
      query.pageSize > 100
    ) {
      throw new ApiException(
        "INVALID_PAGINATION",
        "分页参数必须为正整数且每页不超过 100 条",
        HttpStatus.BAD_REQUEST,
      );
    }

    const where: Prisma.ComplaintWhereInput = {
      AND: [this.queueWhere(query.queue, adminId)],
    };
    const keyword = query.keyword?.trim();

    if (query.status) {
      where.status = query.status;
    }

    if (query.handlerId) {
      where.assignedAdminId = query.handlerId;
    }

    if (keyword) {
      const userKeywordFilter = {
        OR: [
          { id: { contains: keyword, mode: "insensitive" as const } },
          { phone: { contains: keyword } },
          { username: { contains: keyword, mode: "insensitive" as const } },
          { nickname: { contains: keyword, mode: "insensitive" as const } },
        ],
      };

      where.OR = [
        { caseNumber: { contains: keyword, mode: "insensitive" } },
        { orderId: { contains: keyword, mode: "insensitive" } },
        { complainant: { is: userKeywordFilter } },
        { respondent: { is: userKeywordFilter } },
      ];
    }

    const [records, total] = await Promise.all([
      this.prisma.complaint.findMany({
        where,
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
        orderBy: { createdAt: "desc" },
        select: complaintListSelect,
      }),
      this.prisma.complaint.count({ where }),
    ]);

    return {
      list: records.map((record) => this.toListItem(record)),
      total,
      page: query.page,
      pageSize: query.pageSize,
    };
  }

  /** 返回订单当事方可见的投诉详情与服务端计算动作。 */
  async findForUser(id: string, userId: string, now = new Date()): Promise<ComplaintDetail> {
    const complaint = await this.prisma.complaint.findUnique({
      where: { id },
      select: complaintDetailSelect,
    });

    if (!complaint) {
      throw new ApiException("RESOURCE_NOT_FOUND", "投诉不存在", HttpStatus.NOT_FOUND);
    }

    let viewerRole: "complainant" | "respondent" | "other" = "other";

    if (userId === complaint.complainantId) {
      viewerRole = "complainant";
    } else if (userId === complaint.respondentId) {
      viewerRole = "respondent";
    }

    if (viewerRole === "other") {
      throw new ApiException("FORBIDDEN", "无权查看该投诉", HttpStatus.FORBIDDEN);
    }

    const hasSecondAppealed = complaint.statements.some(
      (statement) => statement.stage === "second_appeal" && statement.authorId === userId,
    );

    return this.toDetail(complaint, {
      status: complaint.status as ComplaintStatus,
      viewerId: userId,
      viewerRole,
      assignedAdminId: complaint.assignedAdminId,
      isSuperAdmin: false,
      isOrderParty: true,
      appealDeadlineAt: complaint.appealDeadlineAt,
      hasSecondAppealed,
      hasFailedExecution: complaint.executionTasks.length > 0,
      now,
    });
  }

  /** 返回管理员视角的投诉详情与基于分配关系计算的允许动作。 */
  async findForAdmin(
    id: string,
    admin: { id: string; roles: string[] },
    now = new Date(),
  ): Promise<ComplaintDetail> {
    const complaint = await this.prisma.complaint.findUnique({
      where: { id },
      select: complaintDetailSelect,
    });

    if (!complaint) {
      throw new ApiException("RESOURCE_NOT_FOUND", "投诉不存在", HttpStatus.NOT_FOUND);
    }

    return this.toDetail(complaint, {
      status: complaint.status as ComplaintStatus,
      viewerId: admin.id,
      viewerRole: "admin",
      assignedAdminId: complaint.assignedAdminId,
      isSuperAdmin: admin.roles.includes("super_admin"),
      isOrderParty: admin.id === complaint.complainantId || admin.id === complaint.respondentId,
      appealDeadlineAt: complaint.appealDeadlineAt,
      hasSecondAppealed: false,
      hasFailedExecution: complaint.executionTasks.length > 0,
      now,
    });
  }

  /** 复用投诉详情序列化并注入服务端计算的允许动作。 */
  private toDetail(
    complaint: ComplaintDetailRecord,
    actionContext: ComplaintActionContext,
  ): ComplaintDetail {
    const initialStatement = complaint.statements.find(
      (statement) => statement.stage === "initial",
    );
    const respondentStatement = complaint.statements.find(
      (statement) =>
        statement.stage === "response" && statement.authorId === complaint.respondentId,
    );
    const initialDecision = complaint.decisions.find(
      (decision) => decision.level === DECISION_LEVEL.INITIAL,
    );
    const finalDecision = complaint.decisions.find(
      (decision) => decision.level === DECISION_LEVEL.FINAL,
    );

    return {
      id: complaint.id,
      orderId: complaint.orderId,
      complainantId: complaint.complainantId,
      respondentId: complaint.respondentId,
      complaintType: complaint.complaintType,
      expectedSolution: complaint.expectedSolution,
      status: complaint.status as ComplaintStatus,
      reason: initialStatement?.statement ?? "",
      evidenceUrls: initialStatement?.evidenceUrls ?? [],
      respondentStatement: respondentStatement?.statement ?? null,
      respondentEvidenceUrls: respondentStatement?.evidenceUrls ?? [],
      handlerId: complaint.assignedAdminId,
      initialDecision: initialDecision ? this.toDecision(initialDecision, complaint.version) : null,
      finalDecision: finalDecision ? this.toDecision(finalDecision, complaint.version) : null,
      statements: complaint.statements.map((statement) => this.toStatement(statement)),
      events: complaint.events.map((event) => this.toEvent(event)),
      secondAppealDeadline: complaint.appealDeadlineAt?.toISOString() ?? null,
      allowedActions: getAllowedComplaintActions(actionContext),
      version: complaint.version,
      createdAt: complaint.createdAt.toISOString(),
      updatedAt: complaint.updatedAt.toISOString(),
    };
  }

  /** 将数据库记录转换为分页列表项。 */
  private toListItem(record: ComplaintListRecord): AdminComplaintListItem {
    return {
      id: record.id,
      caseNumber: record.caseNumber,
      orderId: record.orderId,
      complaintType: record.complaintType,
      complainantId: record.complainantId,
      complainant: record.complainant,
      respondentId: record.respondentId,
      respondent: record.respondent,
      status: record.status as ComplaintStatus,
      handlerId: record.assignedAdminId,
      handler: record.assignedAdmin,
      appealDeadlineAt: record.appealDeadlineAt?.toISOString() ?? null,
      hasFailedExecution: record.executionTasks.length > 0,
      createdAt: record.createdAt.toISOString(),
      updatedAt: record.updatedAt.toISOString(),
    };
  }

  /** 将数据库记录转换为当前用户可见且不含后台字段的列表项。 */
  private toPublicListItem(record: PublicComplaintListRecord, userId: string): ComplaintListItem {
    const counterpart = record.complainantId === userId ? record.respondent : record.complainant;

    return {
      id: record.id,
      caseNumber: record.caseNumber,
      orderId: record.orderId,
      complaintType: record.complaintType,
      status: record.status as ComplaintStatus,
      counterpart,
      appealDeadlineAt: record.appealDeadlineAt?.toISOString() ?? null,
      createdAt: record.createdAt.toISOString(),
      updatedAt: record.updatedAt.toISOString(),
    };
  }

  /** 将后台工作队列映射为服务端可信的数据库筛选条件。 */
  private queueWhere(queue: AdminComplaintQueue, adminId: string): Prisma.ComplaintWhereInput {
    switch (queue) {
      case COMPLAINT_QUEUE.MINE:
        return {
          assignedAdminId: adminId,
          status: { notIn: [COMPLAINT_STATUS.CLOSED, COMPLAINT_STATUS.WITHDRAWN] },
        };
      case COMPLAINT_QUEUE.UNASSIGNED:
        return { status: COMPLAINT_STATUS.UNASSIGNED };
      case COMPLAINT_QUEUE.PENDING_RESPONSE:
        return { status: COMPLAINT_STATUS.PENDING_RESPONSE };
      case COMPLAINT_QUEUE.PROCESSING_INITIAL:
        return { status: COMPLAINT_STATUS.PROCESSING_INITIAL };
      case COMPLAINT_QUEUE.INITIAL_DECIDED:
        return { status: COMPLAINT_STATUS.INITIAL_DECIDED };
      case COMPLAINT_QUEUE.PROCESSING_FINAL:
        return { status: COMPLAINT_STATUS.PROCESSING_FINAL };
      case COMPLAINT_QUEUE.EXECUTION_FAILED:
        return {
          executionTasks: { some: { status: DISPUTE_EXECUTION_TASK_STATUS.FAILED } },
        };
      case COMPLAINT_QUEUE.CLOSED:
        return { status: { in: [COMPLAINT_STATUS.CLOSED, COMPLAINT_STATUS.WITHDRAWN] } };
    }
  }

  /** 将数据库陈述转换为 ISO 8601 客户端视图。 */
  private toStatement(
    statement: ComplaintDetailRecord["statements"][number],
  ): ComplaintStatementView {
    return {
      id: statement.id,
      stage: statement.stage,
      authorId: statement.authorId,
      statement: statement.statement,
      evidenceUrls: statement.evidenceUrls,
      createdAt: statement.createdAt.toISOString(),
    };
  }

  /** 将数据库事件转换为 ISO 8601 客户端视图。 */
  private toEvent(event: ComplaintDetailRecord["events"][number]): ComplaintEventView {
    return {
      id: event.id,
      actorId: event.actorId,
      action: event.action,
      fromStatus: event.fromStatus as ComplaintStatus | null,
      toStatus: event.toStatus as ComplaintStatus | null,
      payload: event.payload,
      createdAt: event.createdAt.toISOString(),
    };
  }

  /** 将数据库裁决转换为共享裁决响应。 */
  private toDecision(
    decision: ComplaintDetailRecord["decisions"][number],
    version: number,
  ): SubmitDisputeDecisionRequest {
    return {
      liability: decision.liability as SubmitDisputeDecisionRequest["liability"],
      reason: decision.reason,
      refundAmount: decision.refundAmount,
      settlementAmount: decision.settlementAmount,
      complainantCreditDelta: decision.complainantCreditDelta,
      respondentCreditDelta: decision.respondentCreditDelta,
      version,
    };
  }
}
