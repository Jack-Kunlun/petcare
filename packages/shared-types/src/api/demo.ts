/** Stages of a non-financial, expiring service-flow demonstration. */
export const DEMO_STAGE = {
  /** A synthetic bounty was created. */
  BOUNTY: "bounty",
  /** A super administrator approved the synthetic qualification step. */
  QUALIFIED: "qualified",
  /** A synthetic provider intent was submitted. */
  INTENT: "intent",
  /** The synthetic owner confirmed the intent. */
  CONFIRMED: "confirmed",
  /** Payment interaction was demonstrated without moving money. */
  PAYMENT: "payment_demo",
  /** Service execution was demonstrated without creating SOP evidence. */
  SOP: "sop_demo",
  /** Settlement interaction was demonstrated without a ledger entry. */
  SETTLEMENT: "settlement_demo",
} as const;

/** User-facing stage labels that always distinguish the financial demonstrations. */
export const DEMO_STAGE_LABELS: Record<DemoStage, string> = {
  [DEMO_STAGE.BOUNTY]: "演示悬赏已创建",
  [DEMO_STAGE.QUALIFIED]: "演示资格已确认",
  [DEMO_STAGE.INTENT]: "演示接单意向已提交",
  [DEMO_STAGE.CONFIRMED]: "演示订单已确认",
  [DEMO_STAGE.PAYMENT]: "演示支付步骤已完成（未付款）",
  [DEMO_STAGE.SOP]: "演示履约步骤已完成",
  [DEMO_STAGE.SETTLEMENT]: "演示结算步骤已完成（未结算）",
};

/** One stage in the isolated demonstration. */
export type DemoStage = (typeof DEMO_STAGE)[keyof typeof DEMO_STAGE];

/** Actions available to a Miniapp experience-version tester. */
export type MiniappDemoAction = "submit_intent" | "confirm" | "simulate_payment" | "complete_sop";

/** Actions reserved for a super administrator in the PC demonstration. */
export type AdminDemoAction = "approve_qualification" | "simulate_settlement";

/** A single immutable event in an expiring demonstration. */
export interface DemoEvent {
  /** Stage reached by this event. */
  stage: DemoStage;
  /** Actor category, not an identity or qualification claim. */
  actor: "miniapp" | "admin";
  /** Server time when the stage changed. */
  at: string;
}

/** Shared demonstration state; it never represents an Order or payment record. */
export interface DemoScenario {
  /** Short code used to open the same scenario on PC and Miniapp. */
  code: string;
  /** Current demonstration stage. */
  stage: DemoStage;
  /** Monotonic version for concurrent updates. */
  version: number;
  /** Expiry time; demonstration state is automatically deleted. */
  expiresAt: string;
  /** Append-only stage history for the current scenario. */
  events: DemoEvent[];
}
