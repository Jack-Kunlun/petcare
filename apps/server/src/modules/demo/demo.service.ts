import { randomBytes } from "node:crypto";
import { HttpStatus, Injectable } from "@nestjs/common";
import { DEMO_STAGE } from "@petcare/shared-types";
import type {
  AdminDemoAction,
  DemoScenario,
  DemoStage,
  MiniappDemoAction,
} from "@petcare/shared-types";
import { ApiException } from "../../common/http/api-exception";
import { RedisService } from "../../config/redis.service";

const TTL_SECONDS = 24 * 60 * 60;
const CODE_PATTERN = /^[A-F0-9]{12}$/;
const transitions: Record<MiniappDemoAction | AdminDemoAction, [DemoStage, DemoStage]> = {
  approve_qualification: [DEMO_STAGE.BOUNTY, DEMO_STAGE.QUALIFIED],
  submit_intent: [DEMO_STAGE.QUALIFIED, DEMO_STAGE.INTENT],
  confirm: [DEMO_STAGE.INTENT, DEMO_STAGE.CONFIRMED],
  simulate_payment: [DEMO_STAGE.CONFIRMED, DEMO_STAGE.PAYMENT],
  complete_sop: [DEMO_STAGE.PAYMENT, DEMO_STAGE.SOP],
  simulate_settlement: [DEMO_STAGE.SOP, DEMO_STAGE.SETTLEMENT],
};

const appActions = new Set<MiniappDemoAction>([
  "submit_intent",
  "confirm",
  "simulate_payment",
  "complete_sop",
]);
const adminActions = new Set<AdminDemoAction>(["approve_qualification", "simulate_settlement"]);

function key(code: string): string {
  if (!CODE_PATTERN.test(code)) {
    throw new ApiException("DEMO_NOT_FOUND", "演示编号不存在或已过期", HttpStatus.NOT_FOUND);
  }

  return `petcare:demo:scenario:${code}`;
}

@Injectable()
export class DemoService {
  constructor(private readonly redis: RedisService) {}

  async create(userId: string): Promise<DemoScenario> {
    await this.limit(userId);

    const code = randomBytes(6).toString("hex").toUpperCase();
    const now = new Date().toISOString();
    const scenario: DemoScenario = {
      code,
      stage: DEMO_STAGE.BOUNTY,
      version: 1,
      expiresAt: new Date(Date.now() + TTL_SECONDS * 1000).toISOString(),
      events: [{ stage: DEMO_STAGE.BOUNTY, actor: "miniapp", at: now }],
    };

    if (!(await this.redis.setIfAbsent(key(code), JSON.stringify(scenario), TTL_SECONDS))) {
      throw new ApiException("DEMO_UNAVAILABLE", "演示暂不可用，请稍后重试", 503);
    }

    return scenario;
  }

  async get(code: string): Promise<DemoScenario> {
    const raw = await this.redis.get(key(code));

    if (!raw) {
      throw new ApiException("DEMO_NOT_FOUND", "演示编号不存在或已过期", HttpStatus.NOT_FOUND);
    }

    return JSON.parse(raw) as DemoScenario;
  }

  async advance(
    userId: string,
    code: string,
    action: string,
    actor: "miniapp" | "admin",
  ): Promise<DemoScenario> {
    await this.limit(userId);

    if (
      actor === "miniapp"
        ? !appActions.has(action as MiniappDemoAction)
        : !adminActions.has(action as AdminDemoAction)
    ) {
      throw new ApiException("DEMO_INVALID_ACTION", "此操作不属于当前演示角色", 400);
    }

    const [expected, nextStage] = transitions[action as MiniappDemoAction | AdminDemoAction];
    const redisKey = key(code);
    const raw = await this.redis.get(redisKey);

    if (!raw) {
      throw new ApiException("DEMO_NOT_FOUND", "演示编号不存在或已过期", HttpStatus.NOT_FOUND);
    }

    const current = JSON.parse(raw) as DemoScenario;

    if (current.stage !== expected) {
      throw new ApiException("DEMO_STAGE_CONFLICT", "演示步骤已变化，请刷新后重试", 409);
    }

    const updated: DemoScenario = {
      ...current,
      stage: nextStage,
      version: current.version + 1,
      events: [...current.events, { stage: nextStage, actor, at: new Date().toISOString() }],
    };
    const remaining = await this.redis.ttl(redisKey);

    if (remaining <= 0) {
      throw new ApiException("DEMO_NOT_FOUND", "演示编号不存在或已过期", HttpStatus.NOT_FOUND);
    }

    const changed = await this.redis.getClient().eval(
      `if redis.call("GET", KEYS[1]) ~= ARGV[1] then return 0 end
       redis.call("SET", KEYS[1], ARGV[2], "EX", ARGV[3])
       return 1`,
      {
        keys: [redisKey],
        arguments: [raw, JSON.stringify(updated), String(remaining)],
      },
    );

    if (Number(changed) !== 1) {
      throw new ApiException("DEMO_STAGE_CONFLICT", "演示步骤已变化，请刷新后重试", 409);
    }

    return updated;
  }

  private async limit(userId: string): Promise<void> {
    if (!(await this.redis.consumeFixedWindow(`petcare:demo:limit:${userId}`, 60, 3600))) {
      throw new ApiException("DEMO_RATE_LIMIT", "演示操作过于频繁，请稍后重试", 429);
    }
  }
}
