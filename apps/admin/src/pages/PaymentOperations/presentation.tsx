import type { ApiErrorResponse, PaymentBillRunStatus } from "@petcare/shared-types";
import { isAxiosError } from "axios";
import { Badge, Button, StatePanel } from "../../components/ui";

/** Displays all payment times in the merchant bill's China time zone. */
export function paymentTime(value: string | null): string {
  return value
    ? new Date(value).toLocaleString("zh-CN", { timeZone: "Asia/Shanghai", hour12: false })
    : "未知";
}

/** Retrieves a stable error code without exposing transport or provider details. */
export function paymentErrorCode(error: unknown): string | undefined {
  return isAxiosError<ApiErrorResponse>(error) ? error.response?.data?.code : undefined;
}

/** Historical comparison status must not imply bank settlement or successful human remediation. */
export function BillStatus({ status }: { status: PaymentBillRunStatus }) {
  const labels = {
    running: "结论未知 / 未结束",
    failed: "核对失败",
    differences: "快照存在差异",
    matched: "本次快照无差异",
  };
  const tones = {
    running: "neutral",
    failed: "danger",
    differences: "warning",
    matched: "neutral",
  } as const;

  return <Badge tone={tones[status]}>{labels[status]}</Badge>;
}

/** Keeps unavailable or unauthorized data distinct from a successfully loaded empty queue. */
export function PaymentLoadError({
  error,
  retry,
  busy,
}: {
  error: unknown;
  retry: () => void;
  busy: boolean;
}) {
  const status = isAxiosError(error) ? error.response?.status : undefined;
  let title = "巡检记录加载失败";

  if (status === 403) {
    title = "无权读取巡检记录";
  } else if (status === 404) {
    title = "巡检记录暂不可用";
  }

  return (
    <StatePanel
      role="alert"
      tone="danger"
      title={title}
      description="请核对权限、服务端支付配置或网络后重试。加载失败不代表没有异常。"
      action={
        <Button intent="secondary" loading={busy} onClick={retry}>
          重试加载
        </Button>
      }
    />
  );
}
