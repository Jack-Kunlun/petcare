import { DEMO_STAGE, DEMO_STAGE_LABELS } from "@petcare/shared-types";
import type { AdminDemoAction, DemoScenario } from "@petcare/shared-types";
import { useState } from "react";
import { advanceDemo, fetchDemo } from "../../api/demo";
import { useAuth } from "../../auth/auth.context";
import { Badge, Button, Field, Input, Panel } from "../../components/ui";

function nextAction(
  stage: DemoScenario["stage"],
): { action: AdminDemoAction; label: string } | null {
  if (stage === DEMO_STAGE.BOUNTY) {
    return { action: "approve_qualification", label: "确认演示资格" };
  }

  if (stage === DEMO_STAGE.SOP) {
    return { action: "simulate_settlement", label: "完成演示结算" };
  }

  return null;
}

export default function Demo() {
  const { user } = useAuth();
  const [code, setCode] = useState("");
  const [scenario, setScenario] = useState<DemoScenario | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const isSuperAdmin = user?.roles.includes("super_admin") ?? false;
  const action = scenario ? nextAction(scenario.stage) : null;

  async function load(): Promise<void> {
    if (!isSuperAdmin || busy || !/^[A-F0-9]{12}$/.test(code.trim().toUpperCase())) {
      return;
    }

    setBusy(true);
    setError("");

    try {
      setScenario(await fetchDemo(code.trim().toUpperCase()));
    } catch {
      setScenario(null);
      setError("演示编号不存在、已过期或暂时无法读取，请检查后重试。");
    } finally {
      setBusy(false);
    }
  }

  async function advance(): Promise<void> {
    if (!isSuperAdmin || !scenario || !action || busy) {
      return;
    }

    setBusy(true);
    setError("");

    try {
      setScenario(await advanceDemo(scenario.code, action.action));
    } catch {
      setError("步骤未完成，可能已在另一端更新。请重新读取演示编号后重试。");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section aria-label="服务流程演示" className="space-y-4">
      <Panel className="border-warning-border bg-warning-soft">
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="text-base font-semibold text-text-primary">服务流程演示</h2>
          <Badge tone="warning">演示数据 · 24 小时过期</Badge>
        </div>
        <p className="mt-2 text-sm leading-6 text-text-secondary">
          与小程序体验版通过编号查看同一流程。资格、支付和结算只是演示，不产生真实订单、资金、账务或服务约定；请勿上传身份材料。
        </p>
      </Panel>
      {!isSuperAdmin ? (
        <Panel>仅超管可访问演示管理入口。</Panel>
      ) : (
        <>
          <Panel>
            <form
              className="flex flex-wrap items-end gap-3"
              onSubmit={(event) => {
                event.preventDefault();
                void load();
              }}
            >
              <Field label="小程序演示编号" htmlFor="demo-code" required>
                <Input
                  id="demo-code"
                  value={code}
                  maxLength={12}
                  autoComplete="off"
                  disabled={busy}
                  onChange={(event) => {
                    setCode(event.target.value.toUpperCase());
                    setScenario(null);
                  }}
                />
              </Field>
              <Button
                type="submit"
                loading={busy}
                disabled={!/^[A-F0-9]{12}$/.test(code.trim()) || busy}
              >
                读取演示
              </Button>
            </form>
            {error && (
              <p role="alert" className="mt-3 text-sm text-destructive">
                {error}
              </p>
            )}
          </Panel>
          {scenario && (
            <Panel>
              <h2 className="text-base font-semibold text-text-primary">
                {DEMO_STAGE_LABELS[scenario.stage]}
              </h2>
              <p className="mt-2 text-sm text-text-secondary">
                编号：{scenario.code} · 到期：{new Date(scenario.expiresAt).toLocaleString("zh-CN")}
              </p>
              <ol className="mt-4 space-y-2 text-sm text-text-secondary">
                {scenario.events.map((event, index) => (
                  <li key={`${event.stage}-${index}`}>
                    {index + 1}. {DEMO_STAGE_LABELS[event.stage]} ·{" "}
                    {event.actor === "admin" ? "PC 超管" : "小程序体验端"}
                  </li>
                ))}
              </ol>
              {action && (
                <Button
                  className="mt-5"
                  loading={busy}
                  disabled={busy}
                  onClick={() => void advance()}
                >
                  {action.label}
                </Button>
              )}
              {!action && scenario.stage !== DEMO_STAGE.SETTLEMENT && (
                <p className="mt-5 text-sm text-text-secondary">下一步由小程序体验端操作。</p>
              )}
            </Panel>
          )}
        </>
      )}
    </section>
  );
}
