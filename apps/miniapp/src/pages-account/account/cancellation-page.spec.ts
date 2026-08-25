import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(resolve(import.meta.dirname, "cancel.vue"), "utf8");

describe("account cancellation page wiring", () => {
  it("shows the irreversible, retained-history, and active-order notices", () => {
    expect(source).toContain("账户注销后不可恢复");
    expect(source).toContain("历史订单、投诉及必要审计记录会按规则保留");
    expect(source).toContain("进行中的订单会阻止注销");
  });

  it("renders SMS controls only for a server-profile bound phone", () => {
    expect(source).toContain("session.user?.phoneMasked ?? null");
    expect(source).toContain('v-if="requirement.requiresCode"');
    expect(source).toContain("{{ requirement.phoneLabel }}");
    expect(source).toContain("未绑定手机号，无需短信验证码");
    expect(source).toContain(':maxlength="6"');
  });

  it("keeps native control state aligned and delegates behavior to tested flows", () => {
    expect(source).toContain(':disabled="sendDisabled"');
    expect(source).toContain(':aria-disabled="sendDisabled"');
    expect(source).toContain(':disabled="cancelDisabled"');
    expect(source).toContain(':aria-disabled="cancelDisabled"');
    expect(source).toContain('@click="requestCode"');
    expect(source).toContain('@click="requestCancellation"');
    expect(source).toContain("runCancellationCodeFlow");
    expect(source).toContain("runCancellationFlow");
  });

  it("guards async completions with the page lifecycle and current user", () => {
    expect(source).toContain("let active = true;");
    expect(source.match(/isActive: \(\) => active/g)).toHaveLength(2);
    expect(source).toContain("getCurrentUserId: () => session.user?.id ?? null");
    expect(source).toMatch(
      /onUnload\(\(\) => \{\s*active = false;\s*if \(countdownTimer\) \{\s*clearInterval\(countdownTimer\);\s*countdownTimer = undefined;/,
    );
  });
});
