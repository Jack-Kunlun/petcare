import { HttpStatus, Injectable } from "@nestjs/common";
import {
  DECISION_LEVEL,
  type AdminComplaintListQuery,
  type AdminComplaintListItem,
  type AdminComplaintListResponse,
  type ComplaintDetail,
  type ComplaintEventView,
  type ComplaintStatementView,
  type ComplaintStatus,
  type SubmitDisputeDecisionRequest,
} from "@petcare/shared-types";
import { ApiException } from "../../common/http/api-exception";
import type { Prisma } from "../../generated/prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { getAllowedComplaintActions, type ComplaintActionContext } from "./complaint-state-machine";

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
  async findMine(userId: string, page = 1, pageSize = 20): Promise<AdminComplaintListResponse> {
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
        select: {
          id: true,
          orderId: true,
          complainantId: true,
          respondentId: true,
          status: true,
          assignedAdminId: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
      this.prisma.complaint.count({ where }),
    ]);

    return {
      list: records.map((record) => this.toListItem(record)),
      total,
      page,
      pageSize,
    };
  }

  /** 按后台筛选条件分页返回投诉案件。 */
  async findAdminPage(query: AdminComplaintListQuery): Promise<AdminComplaintListResponse> {
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

    const where: Prisma.ComplaintWhereInput = {};
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
        select: {
          id: true,
          orderId: true,
          complainantId: true,
          respondentId: true,
          status: true,
          assignedAdminId: true,
          createdAt: true,
          updatedAt: true,
        },
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
  private toListItem(record: {
    id: string;
    orderId: string;
    complainantId: string;
    respondentId: string;
    status: string;
    assignedAdminId: string | null;
    createdAt: Date;
    updatedAt: Date;
  }): AdminComplaintListItem {
    return {
      id: record.id,
      orderId: record.orderId,
      complainantId: record.complainantId,
      respondentId: record.respondentId,
      status: record.status as ComplaintStatus,
      handlerId: record.assignedAdminId,
      createdAt: record.createdAt.toISOString(),
      updatedAt: record.updatedAt.toISOString(),
    };
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
