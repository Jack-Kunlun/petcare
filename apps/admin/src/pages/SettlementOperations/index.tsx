import { Badge, DataPanel, PageHeader, PageShell } from "../../components/ui";

/** Presents settlement and withdrawal status while the external payout entity is pending. */
export default function SettlementOperations() {
  return (
    <PageShell>
      <PageHeader
        eyebrow="资金运营"
        title="结算与提现"
        description="查看服务收入结算状态。外部结算主体配置完成前，提现不会产生出款。"
      />
      <div className="grid gap-4 md:grid-cols-3">
        <DataPanel className="p-5">
          <p className="text-sm text-text-secondary">可提现余额</p>
          <p className="mt-2 text-2xl font-semibold text-text-primary">¥0.00</p>
          <Badge className="mt-3" tone="neutral">
            未配置出款主体
          </Badge>
        </DataPanel>
        <DataPanel className="p-5">
          <p className="text-sm text-text-secondary">模拟订单收入</p>
          <p className="mt-2 text-2xl font-semibold text-text-primary">¥0.00</p>
          <Badge className="mt-3" tone="warning">
            不可提现
          </Badge>
        </DataPanel>
        <DataPanel className="p-5">
          <p className="text-sm text-text-secondary">结算状态</p>
          <p className="mt-2 text-lg font-semibold text-text-primary">等待配置</p>
          <p className="mt-3 text-sm text-text-secondary">
            营业主体、出款账户和手续费规则确定后接入真实账务。
          </p>
        </DataPanel>
      </div>
      <DataPanel className="mt-4 p-5">
        <h2 className="font-semibold text-text-primary">收入记录</h2>
        <p className="mt-2 text-sm text-text-secondary">
          当前没有已完成真实收款的可结算订单。模拟支付订单只用于公开业务流程，不生成可兑付余额。
        </p>
      </DataPanel>
    </PageShell>
  );
}
