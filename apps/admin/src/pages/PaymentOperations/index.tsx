import type {
  CreatePaymentBillRunRequest,
  PaymentReconciliationIssue,
} from "@petcare/shared-types";
import { useQuery } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { createPaymentBill, fetchPaymentBills, fetchPaymentIssues } from "../../api/payment";
import { useAuth } from "../../auth/auth.context";
import { PermissionGate } from "../../auth/PermissionGate";
import { usePermissions } from "../../auth/permissions";
import {
  Badge,
  Button,
  Field,
  Input,
  PageHeader,
  PageShell,
  Panel,
  StatePanel,
} from "../../components/ui";
import { BillStatus, paymentErrorCode, PaymentLoadError, paymentTime } from "./presentation";

const issueLabels: Record<PaymentReconciliationIssue, string> = {
  query_failed: "连续查询失败",
  result_invalid: "结果字段不匹配",
  refund_abnormal: "退款异常",
  refund_closed: "退款已关闭",
  external_refund: "发现外部退款",
  cancelled_payment: "已取消订单仍收款",
  refund_pending_too_long: "退款长期未决",
  payment_pending_too_long: "支付长期未决",
};

export default function PaymentOperations() {
  const { user } = useAuth();
  const permissions = usePermissions();
  const navigate = useNavigate();
  const [billPages, setBillPages] = useState<(string | undefined)[]>([undefined]);
  const [issuePages, setIssuePages] = useState<(string | undefined)[]>([undefined]);
  const billCursor = billPages[billPages.length - 1];
  const issueCursor = issuePages[issuePages.length - 1];
  const bills = useQuery({
    queryKey: ["payment-bills", user?.id, billCursor],
    queryFn: () => fetchPaymentBills({ after: billCursor }),
    enabled: permissions.has("payment.bill_read"),
    retry: false,
  });
  const issues = useQuery({
    queryKey: ["payment-issues", user?.id, issueCursor],
    queryFn: () => fetchPaymentIssues({ after: issueCursor }),
    enabled: permissions.has("payment.reconciliation_read"),
    retry: false,
  });
  const yesterday = new Date(Date.now() - 86_400_000 + 8 * 3_600_000).toISOString().slice(0, 10);
  const [date, setDate] = useState(yesterday);
  const command = useRef<CreatePaymentBillRunRequest | null>(null);
  const submitting = useRef(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [uncertain, setUncertain] = useState(false);

  async function run(): Promise<void> {
    if (submitting.current || !permissions.has("payment.bill_action") || !date) {
      return;
    }

    command.current ??= { idempotencyKey: crypto.randomUUID(), billDate: date };
    submitting.current = true;
    setBusy(true);
    setError("");

    try {
      const result = await createPaymentBill(command.current);

      command.current = null;
      setUncertain(false);
      navigate(`/payment-operations/bills/${result.id}`);
    } catch (cause) {
      const rejected = [
        "VALIDATION_FAILED",
        "PAYMENT_BILL_DATE_INVALID",
        "PAYMENT_BILL_REQUEST_INVALID",
        "PAYMENT_BILL_REQUEST_CONFLICT",
      ].includes(paymentErrorCode(cause) ?? "");

      if (rejected) {
        command.current = null;
      }

      setUncertain(!rejected);
      setError(
        rejected
          ? "请求被拒绝，请检查日期或刷新记录后重新提交。"
          : "结果尚未确认。请勿离开页面，使用原请求重试；不要重复发起新核对。",
      );
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  }

  return (
    <PageShell>
      <PageHeader
        title="支付异常巡检"
        description="由超管在后台主动查看与处理，时间均为中国时间。后台展示不代表外部通知已送达。"
        meta={<Badge tone="warning">人工巡检</Badge>}
      />
      <Panel className="border-warning-border bg-warning-soft text-sm leading-6">
        此处不会自动付款、退款或改账。飞书、钉钉等主动通知暂未接入；离开本页后不会主动提醒。没有异常记录也不代表已经完成真实资金验收。
      </Panel>
      <PermissionGate all={["payment.bill_action", "payment.bill_read"]}>
        <Panel>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              void run();
            }}
            className="flex flex-wrap items-end gap-4"
            aria-label="发起日账核对"
          >
            <Field label="账单日期（中国时间）" htmlFor="bill-date" required>
              <Input
                id="bill-date"
                type="date"
                required
                max={yesterday}
                value={date}
                disabled={busy || uncertain}
                onChange={(event) => setDate(event.target.value)}
              />
            </Field>
            <Button
              type="submit"
              loading={busy}
              disabled={!date}
              className="disabled:pointer-events-auto"
            >
              {uncertain ? "重试原核对请求" : "发起日账核对"}
            </Button>
            <p className="text-sm text-text-secondary">只比较历史账单，不执行资金操作。</p>
            {error ? (
              <p role="alert" className="w-full text-sm text-danger">
                {error}
              </p>
            ) : null}
          </form>
        </Panel>
      </PermissionGate>
      <PermissionGate
        all={["payment.reconciliation_read"]}
        fallback={<StatePanel title="没有状态核对读取权限" />}
      >
        <Panel aria-label="状态核对异常" className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-semibold">状态核对异常</h2>
            <Button
              intent="secondary"
              loading={issues.isFetching}
              onClick={() => {
                setIssuePages([undefined]);
                void issues.refetch();
              }}
            >
              刷新异常
            </Button>
          </div>
          <p className="text-sm text-text-secondary">
            当前查询时间：
            {issues.dataUpdatedAt
              ? paymentTime(new Date(issues.dataUpdatedAt).toISOString())
              : "尚未成功读取"}
            。队列随查单结果变化，巡检时请从首页刷新。
          </p>
          {issues.isPending && <p role="status">正在加载异常…</p>}
          {issues.isError && (
            <PaymentLoadError
              error={issues.error}
              retry={() => void issues.refetch()}
              busy={issues.isFetching}
            />
          )}
          {issues.isSuccess && (
            <>
              {issues.data.list.length === 0 ? (
                <StatePanel
                  title="本页没有状态核对异常"
                  description="这不代表商户已接入、日账已核对或资金已验收。"
                />
              ) : (
                <ul className="divide-y divide-border">
                  {issues.data.list.map((item) => (
                    <li key={item.paymentId} className="space-y-2 py-4 text-sm">
                      <Badge tone="warning">{issueLabels[item.issue]}</Badge>
                      <p className="break-all">
                        订单：{item.orderId} · 支付单：{item.paymentId}
                      </p>
                      <p>
                        金额 ¥{(item.amountCents / 100).toFixed(2)} · 连续失败{" "}
                        {item.consecutiveFailures} 次 · 下次计划查询 {paymentTime(item.nextCheckAt)}
                      </p>
                      <p className="text-text-secondary">
                        需核查商户原交易及原退款单，不可据此重复退款或手动标记付款成功。
                      </p>
                    </li>
                  ))}
                </ul>
              )}
              <div className="flex gap-3" aria-label="异常翻页">
                <Button
                  intent="secondary"
                  disabled={issuePages.length === 1 || issues.isFetching}
                  onClick={() => setIssuePages((pages) => pages.slice(0, -1))}
                >
                  上一页异常
                </Button>
                <Button
                  intent="secondary"
                  disabled={!issues.data.nextCursor || issues.isFetching}
                  onClick={() => setIssuePages((pages) => [...pages, issues.data.nextCursor!])}
                >
                  下一页异常
                </Button>
              </div>
            </>
          )}
        </Panel>
      </PermissionGate>
      <PermissionGate
        all={["payment.bill_read"]}
        fallback={<StatePanel title="没有日账读取权限" />}
      >
        <Panel aria-label="日账核对记录" className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-semibold">日账核对记录</h2>
            <Button
              intent="secondary"
              loading={bills.isFetching}
              onClick={() => {
                setBillPages([undefined]);
                void bills.refetch();
              }}
            >
              刷新日账
            </Button>
          </div>
          <p className="text-sm text-text-secondary">
            每页 20 次，包含失败和未结束运行；原始差异不因人工处理而消失。
          </p>
          {bills.isPending && <p role="status">正在加载日账记录…</p>}
          {bills.isError && (
            <PaymentLoadError
              error={bills.error}
              retry={() => void bills.refetch()}
              busy={bills.isFetching}
            />
          )}
          {bills.isSuccess && (
            <>
              {bills.data.list.length === 0 ? (
                <StatePanel
                  title="尚无日账核对记录"
                  description="没有运行记录不代表当日没有交易或没有差异。"
                />
              ) : (
                <ul className="divide-y divide-border">
                  {bills.data.list.map((item) => (
                    <li
                      key={item.id}
                      className="flex flex-wrap items-center justify-between gap-3 py-4"
                    >
                      <div className="min-w-0 space-y-2">
                        <p className="font-medium">
                          {item.billDate} <BillStatus status={item.status} />
                        </p>
                        <p className="text-sm text-text-secondary">
                          原始差异 {item.differenceCount} 项 · 发起于 {paymentTime(item.createdAt)}
                        </p>
                        <p className="break-all text-xs text-text-secondary">{item.id}</p>
                      </div>
                      <Button asChild intent="secondary">
                        <Link to={`/payment-operations/bills/${item.id}`}>
                          查看 {item.billDate} 核对
                        </Link>
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
              <div className="flex gap-3" aria-label="日账翻页">
                <Button
                  intent="secondary"
                  disabled={billPages.length === 1 || bills.isFetching}
                  onClick={() => setBillPages((pages) => pages.slice(0, -1))}
                >
                  上一页日账
                </Button>
                <Button
                  intent="secondary"
                  disabled={!bills.data.nextCursor || bills.isFetching}
                  onClick={() => setBillPages((pages) => [...pages, bills.data.nextCursor!])}
                >
                  下一页日账
                </Button>
              </div>
            </>
          )}
        </Panel>
      </PermissionGate>
    </PageShell>
  );
}
