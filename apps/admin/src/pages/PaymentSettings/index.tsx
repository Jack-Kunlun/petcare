import { CheckCircle2, ClipboardList, LockKeyhole, SlidersHorizontal } from "lucide-react";
import { Badge, DataPanel, PageHeader, PageShell, Panel } from "../../components/ui";

const merchantItems = [
  ["小程序 AppID", "WECHAT_APP_ID", "公开标识"],
  ["微信商户号", "WECHAT_PAY_MERCHANT_ID", "营业执照和商户开户后补充"],
  ["商户 API 证书序列号", "WECHAT_PAY_CERTIFICATE_SERIAL", "服务端签名身份"],
  ["微信支付公钥 ID", "WECHAT_PAY_PUBLIC_KEY_ID", "通知验签身份"],
  ["API v3 密钥", "WECHAT_PAY_API_V3_KEY", "敏感凭据，仅服务端保存"],
  ["商户 API 私钥", "WECHAT_PAY_PRIVATE_KEY_PATH", "服务端证书文件路径"],
  ["微信支付公钥", "WECHAT_PAY_PUBLIC_KEY_PATH", "服务端证书文件路径"],
  ["支付通知地址", "WECHAT_PAY_NOTIFY_URL", "HTTPS，无查询参数"],
  ["退款通知地址", "WECHAT_PAY_REFUND_NOTIFY_URL", "HTTPS，无查询参数"],
] as const;

const settlementItems = [
  ["经营主体", "待补充", "营业执照对应主体"],
  ["出款账户", "待补充", "服务者收入出款账户"],
  ["平台抽成", "待补充", "以发布的费率版本为准"],
  ["提现手续费", "待补充", "比例与最低金额"],
] as const;

/** Shows the payment and settlement configuration checklist without exposing secrets or enabling funds. */
export default function PaymentSettings() {
  return (
    <PageShell>
      <PageHeader
        eyebrow="系统配置"
        title="支付配置"
        description="集中准备小程序支付、退款、对账和收入出款所需信息。当前支付运行仍由服务端安全配置控制。"
        actions={
          <Badge className="h-9 px-3" tone="warning">
            <LockKeyhole aria-hidden="true" className="h-4 w-4" />
            待资质补充
          </Badge>
        }
      />

      <Panel className="flex items-start gap-3" padding="sm">
        <SlidersHorizontal
          aria-hidden="true"
          className="mt-0.5 h-5 w-5 shrink-0 text-brand-primary"
        />
        <div>
          <h2 className="font-semibold text-text-primary">配置边界</h2>
          <p className="mt-1 text-sm leading-6 text-text-secondary">
            本页列出后续需要补充的配置项。API v3
            密钥、证书和私钥不会进入浏览器、数据库或日志；补充主体资质后，再由服务端安全配置接入并重启校验。
          </p>
        </div>
      </Panel>

      <section className="mt-4 grid gap-4 xl:grid-cols-2" aria-label="支付配置清单">
        <DataPanel>
          <header className="flex items-start gap-3 border-b border-border px-5 py-4">
            <ClipboardList aria-hidden="true" className="mt-0.5 h-5 w-5 text-brand-primary" />
            <div>
              <h2 className="font-semibold text-text-primary">微信支付（小程序）</h2>
              <p className="mt-1 text-sm text-text-secondary">普通商户直连 API v3</p>
            </div>
          </header>
          <dl className="divide-y divide-border">
            {merchantItems.map(([label, key, note]) => (
              <div
                className="grid gap-1 px-5 py-3 sm:grid-cols-[1fr_auto] sm:items-center"
                key={key}
              >
                <div>
                  <dt className="text-sm font-medium text-text-primary">{label}</dt>
                  <dd className="mt-1 font-mono text-xs text-text-muted">{key}</dd>
                </div>
                <dd className="text-xs text-text-secondary sm:text-right">{note}</dd>
              </div>
            ))}
          </dl>
        </DataPanel>

        <DataPanel>
          <header className="flex items-start gap-3 border-b border-border px-5 py-4">
            <ClipboardList aria-hidden="true" className="mt-0.5 h-5 w-5 text-brand-primary" />
            <div>
              <h2 className="font-semibold text-text-primary">收入与提现</h2>
              <p className="mt-1 text-sm text-text-secondary">结算主体和费率准备项</p>
            </div>
          </header>
          <dl className="divide-y divide-border">
            {settlementItems.map(([label, value, note]) => (
              <div
                className="grid gap-1 px-5 py-3 sm:grid-cols-[1fr_auto] sm:items-center"
                key={label}
              >
                <div>
                  <dt className="text-sm font-medium text-text-primary">{label}</dt>
                  <dd className="mt-1 text-xs text-text-secondary">{note}</dd>
                </div>
                <dd className="text-sm font-medium text-warning sm:text-right">{value}</dd>
              </div>
            ))}
          </dl>
        </DataPanel>
      </section>

      <Panel className="mt-4" padding="sm">
        <div className="flex items-start gap-3">
          <CheckCircle2 aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-success" />
          <div>
            <h2 className="font-semibold text-text-primary">当前可用状态</h2>
            <p className="mt-1 text-sm leading-6 text-text-secondary">
              未收款流程可用于公开订单验证，但只产生不可提现的收入记录；真实支付、退款、对账和出款仍需完成资质、商户配置及目标环境验收。
            </p>
            <p className="mt-2 text-xs text-text-muted">
              @TODO(REAL-PAYMENT)：营业执照、经营主体、微信商户号、AppID 绑定、API v3
              密钥、证书、通知地址和真实资金验收完成后，补充安全配置并关闭未收款流程。
            </p>
          </div>
        </div>
      </Panel>
    </PageShell>
  );
}
