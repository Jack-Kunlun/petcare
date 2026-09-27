import { useQuery } from "@tanstack/react-query";
import { fetchAdminSettlementSummary } from "../../api/settlement";
import { Badge, DataPanel, PageHeader, PageShell } from "../../components/ui";

/** Presents the live settlement projection while the external payout entity is pending. */
export default function SettlementOperations() {
  const query = useQuery({
    queryKey: ["admin-settlement-summary"],
    queryFn: fetchAdminSettlementSummary,
  });

  const summary = query.data;

  let settlementStatus = "等待配置";

  if (query.isPending) {
    settlementStatus = "加载中";
  } else if (summary?.pendingCents) {
    settlementStatus = "待核查";
  }

  return (
    <PageShell>
      <PageHeader
        eyebrow="资金运营"
        title="收入与提现"
        description="查看服务收入结算状态。外部结算主体配置完成前，提现不会产生出款。"
      />
      <div className="grid gap-4 md:grid-cols-3">
        <DataPanel className="p-5">
          <p className="text-sm text-text-secondary">可提现余额</p>
          <p className="mt-2 text-2xl font-semibold text-text-primary">
            ¥{((summary?.availableCents ?? 0) / 100).toFixed(2)}
          </p>
          <Badge className="mt-3" tone="neutral">
            未配置出款主体
          </Badge>
        </DataPanel>
        <DataPanel className="p-5">
          <p className="text-sm text-text-secondary">模拟或阻断收入</p>
          <p className="mt-2 text-2xl font-semibold text-text-primary">
            ¥{((summary?.blockedCents ?? 0) / 100).toFixed(2)}
          </p>
          <Badge className="mt-3" tone="warning">
            不可提现
          </Badge>
        </DataPanel>
        <DataPanel className="p-5">
          <p className="text-sm text-text-secondary">结算状态</p>
          <p className="mt-2 text-lg font-semibold text-text-primary">{settlementStatus}</p>
          <p className="mt-3 text-sm text-text-secondary">
            {summary?.entryCount ?? 0}{" "}
            条不可变收入记录；营业主体、出款账户和手续费规则确定后接入真实出款。
          </p>
        </DataPanel>
      </div>
      <DataPanel className="mt-4 p-5">
        <h2 className="font-semibold text-text-primary">收入记录</h2>
        <p className="mt-2 text-sm text-text-secondary">
          模拟支付订单只用于公开业务流程，不生成可兑付余额；真实收款缺少费用快照时会保留在待核查金额。
        </p>
      </DataPanel>
    </PageShell>
  );
}
