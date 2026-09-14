import type { PaymentBillDifferenceSummary, PaymentBillEntry } from "@petcare/shared-types";
import { useQuery } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import { Link, useParams } from "react-router-dom";
import { fetchPaymentBill } from "../../api/payment";
import { useAuth } from "../../auth/auth.context";
import { usePermissions } from "../../auth/permissions";
import { Badge, Button, PageHeader, PageShell, Panel, StatePanel } from "../../components/ui";
import { BillStatus, PaymentLoadError, paymentTime } from "./presentation";
import { ReviewPanel } from "./ReviewPanel";

const differenceLabels: Record<PaymentBillDifferenceSummary["code"], string> = {
  local_missing: "本地缺少记录",
  provider_missing: "账单缺少记录",
  fields_mismatch: "字段不匹配",
  refund_time_unknown: "退款受理时间未知",
};
const fields: [keyof PaymentBillEntry, string][] = [
  ["paymentId", "支付单号"],
  ["refundId", "退款单号"],
  ["transactionId", "微信支付交易号"],
  ["providerRefundId", "微信退款号"],
  ["appId", "AppID"],
  ["amountCents", "金额（分）"],
  ["occurredAt", "业务时间"],
  ["eventType", "历史事件"],
  ["tradeType", "支付渠道"],
  ["subMerchantId", "子商户号"],
  ["currency", "币种"],
];

function snapshotValue(snapshot: PaymentBillEntry | null, key: keyof PaymentBillEntry) {
  if (!snapshot) {
    return "无对应记录";
  }

  if (key === "occurredAt") {
    return paymentTime(snapshot.occurredAt);
  }

  return snapshot[key] ?? "未知 / 不适用";
}

export default function PaymentBillDetail() {
  const { runId = "" } = useParams();

  return <BillDetail key={runId} runId={runId} />;
}

function BillDetail({ runId }: { runId: string }) {
  const { user } = useAuth();
  const permissions = usePermissions();
  const [pages, setPages] = useState([0]);
  const [ordinal, setOrdinal] = useState<number | null>(null);
  const [locked, setLocked] = useState(false);
  const cursor = pages[pages.length - 1];
  const detail = useQuery({
    queryKey: ["payment-bill", user?.id, runId, cursor],
    queryFn: () => fetchPaymentBill(runId, cursor),
    enabled: permissions.has("payment.bill_read") && Boolean(runId),
    retry: false,
  });
  const data = permissions.has("payment.bill_read") && detail.isSuccess ? detail.data : null;
  const selected = data?.differences.find((entry) => entry.ordinal === ordinal);
  let loadState: ReactNode = <p role="status">正在加载日账详情…</p>;

  if (!permissions.has("payment.bill_read")) {
    loadState = <StatePanel title="无权读取日账" />;
  } else if (detail.isError) {
    loadState = (
      <PaymentLoadError
        error={detail.error}
        busy={detail.isFetching}
        retry={() => void detail.refetch()}
      />
    );
  }

  return (
    <PageShell>
      <PageHeader
        title="日账核对详情"
        description="原始快照永久保留。人工处理状态与日账核对结果分开记录，不表示资金到账或结算完成。"
        actions={
          locked ? (
            <Button disabled intent="secondary">
              请先确认提交结果
            </Button>
          ) : (
            <Button asChild intent="secondary">
              <Link to="/payment-operations">返回巡检列表</Link>
            </Button>
          )
        }
      />
      {data ? (
        <>
          <Panel className="space-y-3 text-sm">
            <div className="flex flex-wrap items-center gap-3">
              <h2 className="text-lg font-semibold">{data.run.billDate} 日账</h2>
              <BillStatus status={data.run.status} />
            </div>
            <p className="break-all">运行标识：{runId}</p>
            <p>
              原始差异 {data.run.differenceCount} 项 · 账单明细 {data.run.rowCount ?? "未知"} 条 ·
              本地记录 {data.run.localCount ?? "未知"} 条
            </p>
            <p>
              创建：{paymentTime(data.run.createdAt)} · 快照：
              {paymentTime(data.run.snapshotAt)}
            </p>
            <p className="break-all text-text-secondary">
              文件 SHA256：{data.run.fileSha256 ?? "无已验证文件摘要"}
            </p>
            {data.run.status === "failed" || data.run.status === "running" ? (
              <p className="text-warning">
                本次没有成功结论。请先核查失败或中断原因，再从列表显式发起新的核对，旧运行不会被覆盖。
              </p>
            ) : null}
            <Button
              intent="secondary"
              loading={detail.isFetching}
              disabled={locked}
              onClick={() => void detail.refetch()}
            >
              刷新运行状态
            </Button>
          </Panel>
          <div className="grid min-w-0 gap-6 xl:grid-cols-[minmax(260px,1fr)_minmax(0,2fr)]">
            <Panel className="min-w-0 space-y-4" aria-label="日账差异列表">
              <h2 className="text-lg font-semibold">差异快照</h2>
              {data.differences.length === 0 ? (
                <StatePanel
                  title="本页无差异明细"
                  description="请结合运行状态判断；失败或未知运行不能当作核对通过。"
                />
              ) : (
                <ul className="space-y-2">
                  {data.differences.map((entry) => (
                    <li key={entry.ordinal}>
                      <button
                        type="button"
                        disabled={locked}
                        aria-current={ordinal === entry.ordinal ? "true" : undefined}
                        aria-label={`查看差异 ${entry.ordinal}`}
                        onClick={() => setOrdinal(entry.ordinal)}
                        className="min-h-11 w-full cursor-pointer rounded-lg border border-border p-3 text-left text-sm hover:bg-surface-subtle focus-visible:outline-2 focus-visible:outline-brand-primary disabled:cursor-not-allowed disabled:opacity-55 aria-current:border-brand-primary"
                      >
                        <span className="block font-medium">
                          差异 {entry.ordinal} · {differenceLabels[entry.code]}
                        </span>
                        <span className="mt-1 block break-all text-xs text-text-secondary">
                          {entry.local?.paymentId ?? entry.provider?.paymentId}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              <div className="flex flex-wrap gap-3">
                <Button
                  intent="secondary"
                  disabled={pages.length === 1 || detail.isFetching || locked}
                  onClick={() => {
                    setOrdinal(null);
                    setPages((value) => value.slice(0, -1));
                  }}
                >
                  上一页差异
                </Button>
                <Button
                  intent="secondary"
                  disabled={!data.nextCursor || detail.isFetching || locked}
                  onClick={() => {
                    setOrdinal(null);
                    setPages((value) => [...value, data.nextCursor!]);
                  }}
                >
                  下一页差异
                </Button>
              </div>
            </Panel>
            <Panel className="min-w-0 space-y-6" aria-label="差异核查与处理">
              {!selected ? (
                <StatePanel title="选择一项差异进行核查" />
              ) : (
                <>
                  <h2 className="text-lg font-semibold">
                    差异 {selected.ordinal}{" "}
                    <Badge tone="warning">{differenceLabels[selected.code]}</Badge>
                  </h2>
                  <div className="overflow-x-auto">
                    <table className="w-full table-fixed text-left text-sm">
                      <caption className="pb-3 text-left text-text-secondary">
                        原始核对快照，不是实时支付或退款状态
                      </caption>
                      <thead>
                        <tr className="border-b border-border">
                          <th scope="col" className="w-1/3 py-2">
                            核对字段
                          </th>
                          <th scope="col">本地快照</th>
                          <th scope="col">微信账单</th>
                        </tr>
                      </thead>
                      <tbody>
                        {fields.map(([key, label]) => (
                          <tr key={key} className="border-b border-border">
                            <th scope="row" className="py-3 pr-2 align-top font-medium">
                              {label}
                              {selected.fields.includes(key) ? (
                                <span className="block text-xs text-warning">不一致 / 未知</span>
                              ) : null}
                            </th>
                            {[selected.local, selected.provider].map((snapshot, index) => (
                              <td key={index} className="break-all px-2 py-3 align-top">
                                {snapshotValue(snapshot, key)}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <ReviewPanel
                    key={selected.ordinal}
                    runId={runId}
                    ordinal={selected.ordinal}
                    onLock={setLocked}
                  />
                </>
              )}
            </Panel>
          </div>
        </>
      ) : (
        loadState
      )}
    </PageShell>
  );
}
