import { BOUNTY_SERVICE_TYPE_LABELS, BOUNTY_STATUS_LABELS } from "@petcare/shared-types";
import { useQuery } from "@tanstack/react-query";
import { FileText } from "lucide-react";
import { useState } from "react";
import { fetchAdminBountyOrders } from "../../api/bounties";
import {
  Badge,
  DataPanel,
  PageHeader,
  PageShell,
  Pagination,
  Skeleton,
  StatePanel,
} from "../../components/ui";

const PAGE_SIZE = 20;

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("zh-CN", { dateStyle: "short", timeStyle: "short" }).format(
    new Date(value),
  );
}

function paymentLabel(status: string | null): string {
  if (status === "simulated") {
    return "模拟支付";
  }

  if (status === "succeeded") {
    return "已收款";
  }

  return "未支付";
}

function paymentTone(status: string | null): "warning" | "success" | "neutral" {
  if (status === "simulated") {
    return "warning";
  }

  return status === "succeeded" ? "success" : "neutral";
}

/** Lists all bounty orders for operations and fulfillment review. */
export default function BountyOrders() {
  const [page, setPage] = useState(1);
  const query = useQuery({
    queryKey: ["admin-bounty-orders", page],
    queryFn: () => fetchAdminBountyOrders({ page, pageSize: PAGE_SIZE }),
  });
  const total = query.data?.total ?? 0;

  return (
    <PageShell>
      <PageHeader
        eyebrow="悬赏服务"
        title="悬赏订单"
        description="查看订单状态、服务双方与支付状态。"
        actions={
          <Badge className="h-9 px-3" tone="brand">
            <FileText aria-hidden="true" className="h-4 w-4" />共 {total} 笔订单
          </Badge>
        }
      />
      <DataPanel>
        {query.isPending ? <Skeleton className="m-6" lines={5} /> : null}
        {query.isError ? (
          <StatePanel title="订单加载失败" description="请刷新后重试。" tone="danger" />
        ) : null}
        {query.data && query.data.list.length === 0 ? <StatePanel title="暂无悬赏订单" /> : null}
        {query.data && query.data.list.length > 0 ? (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[920px] text-left text-sm">
                <thead className="border-b border-border text-xs text-text-secondary">
                  <tr>
                    <th className="px-4 py-3 font-medium">订单</th>
                    <th className="px-4 py-3 font-medium">服务</th>
                    <th className="px-4 py-3 font-medium">金额</th>
                    <th className="px-4 py-3 font-medium">双方</th>
                    <th className="px-4 py-3 font-medium">订单状态</th>
                    <th className="px-4 py-3 font-medium">支付</th>
                    <th className="px-4 py-3 font-medium">创建时间</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {query.data.list.map((order) => (
                    <tr key={order.id}>
                      <td className="px-4 py-4 font-mono text-xs text-text-secondary">
                        {order.id.slice(0, 8)}
                      </td>
                      <td className="px-4 py-4 text-text-primary">
                        {BOUNTY_SERVICE_TYPE_LABELS[order.serviceType]}
                      </td>
                      <td className="px-4 py-4 font-medium text-text-primary">
                        ¥{(order.amountCents / 100).toFixed(2)}
                      </td>
                      <td className="px-4 py-4 text-text-secondary">
                        {order.owner.nickname} / {order.provider?.nickname ?? "待确认"}
                      </td>
                      <td className="px-4 py-4 text-text-primary">
                        {BOUNTY_STATUS_LABELS[order.status]}
                      </td>
                      <td className="px-4 py-4">
                        <Badge tone={paymentTone(order.paymentStatus)}>
                          {paymentLabel(order.paymentStatus)}
                        </Badge>
                      </td>
                      <td className="px-4 py-4 text-text-secondary">
                        {formatDate(order.createdAt)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination
              page={page}
              pageSize={PAGE_SIZE}
              total={total}
              totalPages={Math.max(1, Math.ceil(total / PAGE_SIZE))}
              onPageChange={setPage}
            />
          </>
        ) : null}
      </DataPanel>
    </PageShell>
  );
}
