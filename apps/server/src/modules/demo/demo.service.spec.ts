import { DEMO_STAGE } from "@petcare/shared-types";
import { RedisService } from "../../config/redis.service";
import { DemoService } from "./demo.service";

function fixture(): DemoService {
  const values = new Map<string, string>();
  const redis = {
    async consumeFixedWindow() {
      return true;
    },
    async setIfAbsent(key: string, value: string) {
      if (values.has(key)) {
        return false;
      }

      values.set(key, value);

      return true;
    },
    async get(key: string) {
      return values.get(key) ?? null;
    },
    async ttl() {
      return 3600;
    },
    getClient() {
      return {
        async eval(_script: string, input: { keys: string[]; arguments: string[] }) {
          const [key] = input.keys;
          const [expected, next] = input.arguments;

          if (values.get(key) !== expected) {
            return 0;
          }

          values.set(key, next);

          return 1;
        },
      };
    },
  } as unknown as RedisService;

  return new DemoService(redis);
}

describe("DemoService", () => {
  it("keeps a shared demonstration separate from real payment and enforces PC steps", async () => {
    const service = fixture();
    const created = await service.create("tester");

    expect(created.stage).toBe(DEMO_STAGE.BOUNTY);
    expect(created).not.toHaveProperty("paymentId");
    await expect(
      service.advance("tester", created.code, "approve_qualification", "miniapp"),
    ).rejects.toMatchObject({ status: 400 });

    await service.advance("admin", created.code, "approve_qualification", "admin");
    await service.advance("tester", created.code, "submit_intent", "miniapp");
    await service.advance("tester", created.code, "confirm", "miniapp");
    await expect(
      service.advance("admin", created.code, "simulate_settlement", "admin"),
    ).rejects.toMatchObject({ status: 409 });

    const paid = await service.advance("tester", created.code, "simulate_payment", "miniapp");

    expect(paid.stage).toBe(DEMO_STAGE.PAYMENT);
    expect(paid).not.toHaveProperty("payment");

    await service.advance("tester", created.code, "complete_sop", "miniapp");
    const settled = await service.advance("admin", created.code, "simulate_settlement", "admin");

    expect(settled.stage).toBe(DEMO_STAGE.SETTLEMENT);
    expect(settled.events).toHaveLength(7);
    expect(settled).not.toHaveProperty("ledger");
  });

  it("rejects a concurrent replay rather than duplicating a stage", async () => {
    const service = fixture();
    const created = await service.create("tester");

    await service.advance("admin", created.code, "approve_qualification", "admin");

    const results = await Promise.allSettled([
      service.advance("tester", created.code, "submit_intent", "miniapp"),
      service.advance("tester", created.code, "submit_intent", "miniapp"),
    ]);

    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(results.filter((result) => result.status === "rejected")).toHaveLength(1);
    expect((await service.get(created.code)).events).toHaveLength(3);
  });
});
