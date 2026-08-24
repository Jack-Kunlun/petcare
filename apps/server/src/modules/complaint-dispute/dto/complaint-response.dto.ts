import { ApiProperty } from "@nestjs/swagger";
import {
  COMPLAINT_ACTION,
  COMPLAINT_EVENT_ACTION,
  COMPLAINT_STATEMENT_STAGE,
  COMPLAINT_STATUS,
  COMPLAINT_TYPE,
  type AdminComplaintListItem,
  type AdminComplaintListResponse,
  type AdminComplaintDetail,
  type AdminComplaintOrderSummary,
  type AdminComplaintUserSummary,
  type ComplaintAction,
  type ComplaintDetail,
  type ComplaintEventView,
  type ComplaintEventAction,
  type ComplaintListItem,
  type ComplaintListResponse,
  type ComplaintListUserSummary,
  type ComplaintStatementView,
  type ComplaintStatementStage,
  type ComplaintStatus,
  type ComplaintType,
  type SubmitDisputeDecisionRequest,
} from "@petcare/shared-types";

const complaintStatuses = Object.values(COMPLAINT_STATUS);
const complaintActions = Object.values(COMPLAINT_ACTION);
const complaintTypes = Object.values(COMPLAINT_TYPE);
const complaintStatementStages = Object.values(COMPLAINT_STATEMENT_STAGE);
const complaintEventActions = Object.values(COMPLAINT_EVENT_ACTION);

/** 用户投诉列表中的对方安全展示摘要。 */
export class ComplaintListUserSummaryDto implements ComplaintListUserSummary {
  @ApiProperty({ format: "uuid" })
  id: string;

  @ApiProperty()
  nickname: string;

  @ApiProperty({ nullable: true })
  avatar: string | null;
}

/** 用户可见投诉列表项的 Swagger 模型。 */
export class ComplaintListItemDto implements ComplaintListItem {
  @ApiProperty({ format: "uuid" })
  id: string;

  @ApiProperty()
  caseNumber: string;

  @ApiProperty({ format: "uuid" })
  orderId: string;

  @ApiProperty({ enum: complaintTypes })
  complaintType: ComplaintType;

  @ApiProperty({ enum: complaintStatuses })
  status: ComplaintStatus;

  @ApiProperty({ type: ComplaintListUserSummaryDto })
  counterpart: ComplaintListUserSummaryDto;

  @ApiProperty({ format: "date-time", nullable: true })
  appealDeadlineAt: string | null;

  @ApiProperty({ format: "date-time" })
  createdAt: string;

  @ApiProperty({ format: "date-time" })
  updatedAt: string;
}

/** 用户投诉列表分页响应的 Swagger 模型。 */
export class ComplaintListResponseDto implements ComplaintListResponse {
  @ApiProperty({ type: [ComplaintListItemDto] })
  list: ComplaintListItemDto[];

  @ApiProperty()
  total: number;

  @ApiProperty()
  page: number;

  @ApiProperty()
  pageSize: number;
}

/** 后台投诉列表中的用户展示摘要。 */
export class AdminComplaintListUserSummaryDto implements AdminComplaintUserSummary {
  @ApiProperty({ format: "uuid" })
  id: string;

  @ApiProperty()
  nickname: string;

  @ApiProperty({ nullable: true })
  phone: string | null;
}

/** 投诉列表项的 Swagger 模型。 */
export class AdminComplaintListItemDto implements AdminComplaintListItem {
  @ApiProperty({ format: "uuid" })
  id: string;

  @ApiProperty()
  caseNumber: string;

  @ApiProperty({ format: "uuid" })
  orderId: string;

  @ApiProperty({ enum: complaintTypes })
  complaintType: ComplaintType;

  @ApiProperty({ format: "uuid" })
  complainantId: string;

  @ApiProperty({ type: AdminComplaintListUserSummaryDto })
  complainant: AdminComplaintListUserSummaryDto;

  @ApiProperty({ format: "uuid" })
  respondentId: string;

  @ApiProperty({ type: AdminComplaintListUserSummaryDto })
  respondent: AdminComplaintListUserSummaryDto;

  @ApiProperty({ enum: complaintStatuses })
  status: ComplaintStatus;

  @ApiProperty({ format: "uuid", nullable: true })
  handlerId: string | null;

  @ApiProperty({ type: AdminComplaintListUserSummaryDto, nullable: true })
  handler: AdminComplaintListUserSummaryDto | null;

  @ApiProperty({ format: "date-time", nullable: true })
  appealDeadlineAt: string | null;

  @ApiProperty()
  hasFailedExecution: boolean;

  @ApiProperty({ format: "date-time" })
  createdAt: string;

  @ApiProperty({ format: "date-time" })
  updatedAt: string;
}

/** 用户投诉分页响应的 Swagger 模型。 */
export class AdminComplaintListResponseDto implements AdminComplaintListResponse {
  @ApiProperty({ type: [AdminComplaintListItemDto] })
  list: AdminComplaintListItemDto[];

  @ApiProperty()
  total: number;

  @ApiProperty()
  page: number;

  @ApiProperty()
  pageSize: number;
}

/** 投诉陈述的 Swagger 模型。 */
export class ComplaintStatementDto implements ComplaintStatementView {
  @ApiProperty({ format: "uuid" })
  id: string;

  @ApiProperty({ enum: complaintStatementStages })
  stage: ComplaintStatementStage;

  @ApiProperty({ format: "uuid" })
  authorId: string;

  @ApiProperty()
  statement: string;

  @ApiProperty({ type: [String] })
  evidenceUrls: string[];

  @ApiProperty({ format: "date-time" })
  createdAt: string;
}

/** 投诉事件的 Swagger 模型。 */
export class ComplaintEventDto implements ComplaintEventView {
  @ApiProperty({ format: "uuid" })
  id: string;

  @ApiProperty({ format: "uuid", nullable: true })
  actorId: string | null;

  @ApiProperty({ enum: complaintEventActions })
  action: ComplaintEventAction;

  @ApiProperty({ enum: complaintStatuses, nullable: true })
  fromStatus: ComplaintStatus | null;

  @ApiProperty({ enum: complaintStatuses, nullable: true })
  toStatus: ComplaintStatus | null;

  @ApiProperty({ nullable: true })
  payload: string | null;

  @ApiProperty({ format: "date-time" })
  createdAt: string;
}

/** 投诉裁决的 Swagger 模型。 */
export class ComplaintDecisionDto implements SubmitDisputeDecisionRequest {
  @ApiProperty({
    enum: ["complainant", "respondent", "shared", "insufficient_evidence"],
  })
  liability: SubmitDisputeDecisionRequest["liability"];

  @ApiProperty()
  reason: string;

  @ApiProperty({ minimum: 0 })
  refundAmount: number;

  @ApiProperty({ minimum: 0 })
  settlementAmount: number;

  @ApiProperty({ minimum: -100, maximum: 100 })
  complainantCreditDelta: number;

  @ApiProperty({ minimum: -100, maximum: 100 })
  respondentCreditDelta: number;

  @ApiProperty({ minimum: 1 })
  version: number;
}

/** 用户可见投诉详情的 Swagger 模型。 */
export class ComplaintResponseDto implements ComplaintDetail {
  @ApiProperty({ format: "uuid" })
  id: string;

  @ApiProperty({ format: "uuid" })
  orderId: string;

  @ApiProperty({ format: "uuid" })
  complainantId: string;

  @ApiProperty({ format: "uuid" })
  respondentId: string;

  @ApiProperty({ enum: complaintTypes })
  complaintType: ComplaintType;

  @ApiProperty({ nullable: true })
  expectedSolution: string | null;

  @ApiProperty({ enum: complaintStatuses })
  status: ComplaintStatus;

  @ApiProperty()
  reason: string;

  @ApiProperty({ type: [String] })
  evidenceUrls: string[];

  @ApiProperty({ nullable: true })
  respondentStatement: string | null;

  @ApiProperty({ type: [String] })
  respondentEvidenceUrls: string[];

  @ApiProperty({ format: "uuid", nullable: true })
  handlerId: string | null;

  @ApiProperty({ type: ComplaintDecisionDto, nullable: true })
  initialDecision: ComplaintDecisionDto | null;

  @ApiProperty({ type: ComplaintDecisionDto, nullable: true })
  finalDecision: ComplaintDecisionDto | null;

  @ApiProperty({ type: [ComplaintStatementDto] })
  statements: ComplaintStatementDto[];

  @ApiProperty({ type: [ComplaintEventDto] })
  events: ComplaintEventDto[];

  @ApiProperty({ format: "date-time", nullable: true })
  secondAppealDeadline: string | null;

  @ApiProperty({ enum: complaintActions, isArray: true })
  allowedActions: ComplaintAction[];

  @ApiProperty({ minimum: 1 })
  version: number;

  @ApiProperty({ format: "date-time" })
  createdAt: string;

  @ApiProperty({ format: "date-time" })
  updatedAt: string;
}

/** 后台投诉详情中的订单裁决摘要。 */
export class AdminComplaintOrderSummaryDto implements AdminComplaintOrderSummary {
  @ApiProperty({ format: "uuid" })
  id: string;

  @ApiProperty()
  orderType: string;

  @ApiProperty()
  serviceType: string;

  @ApiProperty({ minimum: 0, description: "裁决可分配的订单总金额，单位为分" })
  allocatableAmount: number;

  @ApiProperty()
  status: string;

  @ApiProperty({ format: "date-time" })
  serviceTime: string;
}

/** 管理员可见的投诉卷宗详情 Swagger 模型。 */
export class AdminComplaintResponseDto
  extends ComplaintResponseDto
  implements AdminComplaintDetail
{
  @ApiProperty()
  caseNumber: string;

  @ApiProperty({ type: AdminComplaintOrderSummaryDto })
  order: AdminComplaintOrderSummaryDto;

  @ApiProperty({ type: AdminComplaintListUserSummaryDto })
  complainant: AdminComplaintListUserSummaryDto;

  @ApiProperty({ type: AdminComplaintListUserSummaryDto })
  respondent: AdminComplaintListUserSummaryDto;

  @ApiProperty({ type: AdminComplaintListUserSummaryDto, nullable: true })
  handler: AdminComplaintListUserSummaryDto | null;
}
