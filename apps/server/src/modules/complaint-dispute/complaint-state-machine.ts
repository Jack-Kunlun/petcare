import { HttpStatus } from "@nestjs/common";
import { DECISION_LEVEL, type ComplaintAction, type ComplaintStatus } from "@petcare/shared-types";
import { ApiException } from "../../common/http/api-exception";

const processingStatusByDecisionLevel = {
  [DECISION_LEVEL.INITIAL]: "processing_initial",
  [DECISION_LEVEL.FINAL]: "processing_final",
} as const satisfies Record<(typeof DECISION_LEVEL)[keyof typeof DECISION_LEVEL], ComplaintStatus>;

/** 投诉动作计算所需的当前状态与访问者信息。 */
export interface ComplaintActionContext {
  /** 当前投诉处理状态。 */
  status: ComplaintStatus;
  /** 当前访问者唯一标识。 */
  viewerId: string;
  /** 当前访问者在该投诉中的角色。 */
  viewerRole: "complainant" | "respondent" | "admin" | "other";
  /** 当前受理管理员唯一标识；未认领时为 null。 */
  assignedAdminId: string | null;
  /** 当前管理员是否拥有超级管理员权限。 */
  isSuperAdmin: boolean;
  /** 当前访问者是否为被投诉订单任一方。 */
  isOrderParty: boolean;
  /** 二次申诉截止时刻；不适用时为 null。 */
  appealDeadlineAt: Date | null;
  /** 当前访问者是否已提交二次申诉。 */
  hasSecondAppealed: boolean;
  /** 当前投诉是否存在失败的裁决执行任务。 */
  hasFailedExecution: boolean;
  /** 计算动作时使用的当前时刻。 */
  now: Date;
}

/** 根据投诉状态和访问者权限计算可执行动作，不访问持久层。 */
export function getAllowedComplaintActions(context: ComplaintActionContext): ComplaintAction[] {
  switch (context.status) {
    case "pending_response":
      return getPendingResponseActions(context);
    case "unassigned":
      return canClaim(context) ? ["claim"] : [];
    case processingStatusByDecisionLevel[DECISION_LEVEL.INITIAL]:
      return getAssignedAdminActions(context, "initial_decide");
    case "initial_decided":
      return canSecondAppeal(context) ? ["second_appeal"] : [];
    case processingStatusByDecisionLevel[DECISION_LEVEL.FINAL]:
      return getAssignedAdminActions(context, "final_decide");
    case "closed":
      return context.hasFailedExecution && isEligibleAdmin(context) ? ["retry_execution"] : [];
    case "withdrawn":
      return [];
  }
}

/** 断言当前访问者可执行指定投诉动作。 */
export function assertComplaintAction(
  context: ComplaintActionContext,
  action: ComplaintAction,
): void {
  if (!getAllowedComplaintActions(context).includes(action)) {
    throw new ApiException(
      "COMPLAINT_ACTION_NOT_ALLOWED",
      "当前投诉状态不允许执行该操作",
      HttpStatus.CONFLICT,
    );
  }
}

/** 计算等待回应阶段中双方可执行的动作。 */
function getPendingResponseActions(context: ComplaintActionContext): ComplaintAction[] {
  if (context.viewerRole === "respondent") {
    return ["respond"];
  }

  return context.viewerRole === "complainant" ? ["withdraw"] : [];
}

/** 计算受理管理员在裁决阶段可执行的动作。 */
function getAssignedAdminActions(
  context: ComplaintActionContext,
  decisionAction: "initial_decide" | "final_decide",
): ComplaintAction[] {
  return isEligibleAdmin(context) ? ["transfer", decisionAction] : [];
}

/** 判断管理员能否认领未分配的投诉。 */
function canClaim(context: ComplaintActionContext): boolean {
  return context.viewerRole === "admin" && !context.isOrderParty;
}

/** 判断当前订单当事方能否提交二次申诉。 */
function canSecondAppeal(context: ComplaintActionContext): boolean {
  return (
    (context.viewerRole === "complainant" || context.viewerRole === "respondent") &&
    !context.hasSecondAppealed &&
    context.appealDeadlineAt !== null &&
    context.now < context.appealDeadlineAt
  );
}

/** 判断管理员是否可处理当前投诉。 */
function isEligibleAdmin(context: ComplaintActionContext): boolean {
  return (
    context.viewerRole === "admin" &&
    !context.isOrderParty &&
    (context.isSuperAdmin || context.assignedAdminId === context.viewerId)
  );
}
