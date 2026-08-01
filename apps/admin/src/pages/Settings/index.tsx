import type {
  FeeConfig,
  RatingThresholdConfig,
  SopConfig,
  SystemSettingDomainOverview,
} from "@petcare/shared-types";
import { useQuery } from "@tanstack/react-query";
import { AlertCircle, ArrowRight, ClipboardList, Percent, RefreshCw, Star } from "lucide-react";
import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { fetchSystemSettingsOverview } from "../../api/system-settings/overview";
import { useAuth } from "../../auth/auth.context";
import { settingsQueryKeys } from "./query-keys";

function formatDate(value: string): string {
  if (!value) {
    return "尚未发布";
  }

  return new Intl.DateTimeFormat("zh-CN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

interface DomainCardProps<TConfig> {
  title: string;
  description: string;
  icon: ReactNode;
  overview: SystemSettingDomainOverview<TConfig>;
  editPath: string;
  historyPath: string;
  extra?: ReactNode;
  canEdit: boolean;
}

function DomainCard<TConfig>({
  title,
  description,
  icon,
  overview,
  editPath,
  historyPath,
  extra,
  canEdit,
}: DomainCardProps<TConfig>) {
  const { current, draft } = overview;

  return (
    <article className="flex min-w-0 flex-col rounded-xl border border-blue-100 bg-white p-5 shadow-sm transition-shadow duration-200 motion-reduce:transition-none hover:shadow-md sm:p-6">
      <div className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 items-start gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-800">
            {icon}
          </span>
          <div className="min-w-0">
            <h2 className="text-xl font-semibold text-slate-950">{title}</h2>
            <p className="mt-1 leading-6 text-slate-600">{description}</p>
          </div>
        </div>
        <span className="shrink-0 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-semibold text-slate-700">
          {current ? `v${current.version}` : "未发布"}
        </span>
      </div>

      {extra}

      <dl className="mt-5 grid grid-cols-1 gap-3 rounded-lg bg-slate-50 p-4 sm:grid-cols-2">
        <div>
          <dt className="text-xs font-medium text-slate-500">草稿状态</dt>
          <dd className="mt-1 font-medium text-slate-900">
            {draft ? `修订版 ${draft.revision}` : "没有待发布变更"}
          </dd>
        </div>
        <div>
          <dt className="text-xs font-medium text-slate-500">最近发布</dt>
          <dd className="mt-1 text-slate-900">
            {current ? `${current.publishedBy || "未知管理员"} · ${formatDate(current.publishedAt)}` : "尚无记录"}
          </dd>
        </div>
      </dl>

      {draft ? (
        <p className="mt-4 flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 font-medium text-amber-900">
          <AlertCircle aria-hidden="true" className="h-4 w-4 shrink-0" />
          有未发布草稿
        </p>
      ) : null}

      <div className="mt-auto flex flex-wrap items-center gap-3 pt-5">
        {canEdit ? (
          <Link
            to={editPath}
            className="inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-lg border border-blue-700 px-4 py-2 font-semibold text-blue-800 outline-none transition-colors duration-200 hover:bg-blue-50 focus-visible:ring-2 focus-visible:ring-blue-800 focus-visible:ring-offset-2 motion-reduce:transition-none"
          >
            编辑配置
            <ArrowRight aria-hidden="true" className="h-4 w-4" />
          </Link>
        ) : (
          <span className="inline-flex min-h-11 items-center rounded-lg border border-slate-200 bg-slate-50 px-4 py-2 font-medium text-slate-600">
            仅查看
          </span>
        )}
        {current ? (
          <Link
            to={`${historyPath}/${current.id}`}
            className="inline-flex min-h-11 cursor-pointer items-center justify-center rounded-lg px-3 py-2 font-medium text-slate-700 outline-none transition-colors duration-200 hover:bg-slate-100 focus-visible:ring-2 focus-visible:ring-blue-800 focus-visible:ring-offset-2 motion-reduce:transition-none"
          >
            查看发布历史
          </Link>
        ) : null}
      </div>
    </article>
  );
}

function SettingsSkeleton() {
  return (
    <div aria-label="正在加载系统设置" className="grid gap-4 lg:grid-cols-3">
      {[0, 1, 2].map((item) => (
        <div key={item} className="h-72 animate-pulse rounded-xl bg-slate-200 motion-reduce:animate-none" />
      ))}
    </div>
  );
}

export default function Settings() {
  const auth = useAuth();
  const permissions = new Set(auth.user?.permissions ?? []);
  const overviewQuery = useQuery({
    queryKey: settingsQueryKeys.overview(),
    queryFn: fetchSystemSettingsOverview,
  });

  const data = overviewQuery.data;
  const hasConfiguration = data
    ? Object.values(data.sop).some(({ current, draft }) => current || draft) ||
      Boolean(data.ratingThreshold.current || data.ratingThreshold.draft) ||
      Boolean(data.fee.current || data.fee.draft)
    : false;
  const pendingCount = data
    ? Object.values(data.sop).filter(({ draft }) => draft).length +
      Number(Boolean(data.ratingThreshold.draft)) +
      Number(Boolean(data.fee.draft))
    : 0;
  const representativeSop = data
    ? data.sop.feeding.current || data.sop.walking.current || data.sop.playing.current
    : null;
  const representativeSopDraft = data
    ? data.sop.feeding.draft || data.sop.walking.draft || data.sop.playing.draft
    : null;

  return (
    <section className="mx-auto w-full max-w-[1280px]">
      <header className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="font-medium text-blue-800">配置控制台</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">系统设置</h1>
          <p className="mt-2 max-w-[720px] leading-6 text-slate-600">
            集中维护服务流程、服务者评分规则与平台费率。所有变更先保存为草稿，经差异确认后发布。
          </p>
        </div>
        {data ? (
          <p className="rounded-lg border border-slate-200 bg-white px-4 py-2.5 font-medium text-slate-700">
            待处理：<span className="font-bold text-amber-800">{pendingCount}</span>
          </p>
        ) : null}
      </header>

      {overviewQuery.isPending ? <SettingsSkeleton /> : null}

      {overviewQuery.isError ? (
        <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-5 text-red-950">
          <h2 className="font-semibold">系统设置加载失败</h2>
          <p className="mt-1">请检查网络连接后重试，已有配置不会受到影响。</p>
          <button
            type="button"
            onClick={() => void overviewQuery.refetch()}
            className="mt-4 inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-lg border border-red-700 px-4 py-2 font-semibold outline-none transition-colors duration-200 hover:bg-red-100 focus-visible:ring-2 focus-visible:ring-red-700 focus-visible:ring-offset-2 motion-reduce:transition-none"
          >
            <RefreshCw aria-hidden="true" className="h-4 w-4" />
            重新加载
          </button>
        </div>
      ) : null}

      {data && !hasConfiguration ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center">
          <ClipboardList aria-hidden="true" className="mx-auto h-10 w-10 text-slate-500" />
          <h2 className="mt-3 text-xl font-semibold text-slate-950">暂无系统配置</h2>
          <p className="mt-1 text-slate-600">领域初始化完成后，可在这里创建并发布第一版配置。</p>
        </div>
      ) : null}

      {data && hasConfiguration ? (
        <div className="grid min-w-0 gap-4 lg:grid-cols-3">
          <DomainCard<SopConfig>
            title="SOP 配置"
            description="维护喂养、遛宠与陪玩服务的固定五步流程。"
            icon={<ClipboardList aria-hidden="true" className="h-5 w-5" />}
            overview={{
              current: representativeSop,
              draft: representativeSopDraft,
              pendingActions: Object.values(data.sop).flatMap((item) => item.pendingActions),
            }}
            editPath="/settings/sop/edit?serviceType=feeding"
            historyPath="/settings/sop/history"
            canEdit={permissions.has("system.sop_config")}
            extra={
              <ul aria-label="SOP 服务类型状态" className="mt-4 grid grid-cols-3 gap-2 text-center text-xs">
                {[
                  ["喂养", data.sop.feeding],
                  ["遛宠", data.sop.walking],
                  ["陪玩", data.sop.playing],
                ].map(([label, item]) => {
                  const overview = item as SystemSettingDomainOverview<SopConfig>;

                  return (
                    <li key={label as string} className="rounded-md border border-slate-200 px-2 py-2 text-slate-700">
                      <span className="block font-semibold text-slate-950">{label as string}</span>
                      {overview.draft ? "有草稿" : `v${overview.current?.version ?? "-"}`}
                    </li>
                  );
                })}
              </ul>
            }
          />
          <DomainCard<RatingThresholdConfig>
            title="评分阈值"
            description="配置评分窗口、预警与暂停接单阈值。"
            icon={<Star aria-hidden="true" className="h-5 w-5" />}
            overview={data.ratingThreshold}
            editPath="/settings/rating_threshold/edit"
            historyPath="/settings/rating_threshold/history"
            canEdit={permissions.has("system.threshold_config")}
          />
          <DomainCard<FeeConfig>
            title="费率设置"
            description="维护平台佣金、悬赏服务费与提现手续费。"
            icon={<Percent aria-hidden="true" className="h-5 w-5" />}
            overview={data.fee}
            editPath="/settings/fee/edit"
            historyPath="/settings/fee/history"
            canEdit={permissions.has("system.fee_config")}
          />
        </div>
      ) : null}
    </section>
  );
}
