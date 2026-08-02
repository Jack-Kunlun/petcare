import type {
  AdminServiceType,
  FeeConfig,
  RatingThresholdConfig,
  SopConfig,
} from "@petcare/shared-types";
import * as Dialog from "@radix-ui/react-dialog";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertCircle, ArrowLeft, Clock3, Copy, LoaderCircle, UserRound, X } from "lucide-react";
import { useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { isSystemConfigVersionConflict } from "../../api/system-settings/client";
import { PermissionGate } from "../../auth/PermissionGate";
import {
  fetchDomainDraft,
  fetchDomainVersion,
  isSettingsPageDomain,
  restoreDomainDraft,
  settingsDomainMeta,
  type SettingsConfig,
} from "./domain-api";
import { formatBasisPointsAsPercent, formatCentsAsYuan, formatScoreAsStars } from "./form-utils";
import { settingsQueryKeys } from "./query-keys";

export default function SettingsDetail() {
  const { domain: domainParam, versionId } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const domain = isSettingsPageDomain(domainParam) ? domainParam : null;
  const requestedServiceType = searchParams.get("serviceType");
  const serviceType: AdminServiceType =
    requestedServiceType === "walking" || requestedServiceType === "playing"
      ? requestedServiceType
      : "feeding";
  const meta = domain ? settingsDomainMeta[domain] : null;
  const [dialogOpen, setDialogOpen] = useState(false);
  const [restoreSummary, setRestoreSummary] = useState("");
  const [error, setError] = useState<string | null>(null);

  const versionQuery = useQuery({
    queryKey: settingsQueryKeys.version(domain ?? "invalid", serviceType, versionId ?? "invalid"),
    queryFn: () => fetchDomainVersion(domain!, serviceType, versionId!),
    enabled: Boolean(domain && versionId),
  });
  const draftQuery = useQuery({
    queryKey: settingsQueryKeys.draft(domain ?? "invalid", serviceType),
    queryFn: () => fetchDomainDraft(domain!, serviceType),
    enabled: Boolean(domain),
  });
  const version = versionQuery.data;

  const restoreMutation = useMutation({
    mutationFn: async () => {
      if (!domain || !version) {
        throw new Error("历史版本不存在");
      }

      return restoreDomainDraft(domain, serviceType, {
        version: version.version,
        revision: 0,
        changeSummary: restoreSummary.trim(),
      });
    },
    onSuccess: async () => {
      setDialogOpen(false);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: settingsQueryKeys.overview() }),
        queryClient.invalidateQueries({ queryKey: settingsQueryKeys.draft(domain!, serviceType) }),
        queryClient.invalidateQueries({
          queryKey: settingsQueryKeys.history(domain!, serviceType),
        }),
      ]);
      navigate(`/settings/${domain}/edit${domain === "sop" ? `?serviceType=${serviceType}` : ""}`);
    },
    onError: async (restoreError) => {
      setDialogOpen(false);

      if (isSystemConfigVersionConflict(restoreError)) {
        setError("服务端已经存在草稿，历史版本未被复制。请先处理现有草稿后重试。");
        await draftQuery.refetch();
      } else {
        setError("复制历史版本失败，请稍后重试。");
      }
    },
  });

  if (!domain || !meta) {
    return <Message title="历史路径无效" message="请返回系统设置选择有效领域。" />;
  }

  const editHref = `/settings/${domain}/edit${domain === "sop" ? `?serviceType=${serviceType}` : ""}`;

  return (
    <section className="mx-auto w-full max-w-[1024px]">
      <Link
        to={editHref}
        className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-lg px-2 font-medium text-blue-800 outline-none transition-colors duration-200 hover:bg-blue-50 focus-visible:ring-2 focus-visible:ring-blue-800 motion-reduce:transition-none"
      >
        <ArrowLeft aria-hidden="true" className="h-4 w-4" />
        返回配置编辑器
      </Link>

      {versionQuery.isPending ? (
        <p
          aria-live="polite"
          className="mt-6 rounded-xl border border-slate-200 bg-white p-8 text-center text-slate-600"
        >
          正在加载历史版本…
        </p>
      ) : null}
      {versionQuery.isError ? (
        <Message title="历史版本加载失败" message="请检查网络连接后重试。" />
      ) : null}
      {!versionQuery.isPending && !versionQuery.isError && !version ? (
        <Message title="历史版本不存在" message="该版本可能已被移除，或链接不完整。" />
      ) : null}

      {version ? (
        <>
          <header className="mt-3 rounded-xl border border-blue-100 bg-white p-5 shadow-sm sm:p-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="font-medium text-blue-800">只读历史详情</p>
                <h1 className="mt-1 text-2xl font-bold text-slate-950 sm:text-3xl">
                  {meta.label} v{version.version}
                </h1>
                <p className="mt-2 leading-6 text-slate-600">{version.changeSummary}</p>
              </div>
              <span className="self-start rounded-full border border-slate-300 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700">
                {version.status === "published" ? "当前生效" : "历史版本"}
              </span>
            </div>
            <dl className="mt-5 grid gap-3 border-t border-slate-200 pt-4 sm:grid-cols-2">
              <div className="flex items-center gap-3">
                <UserRound aria-hidden="true" className="h-5 w-5 text-slate-500" />
                <div>
                  <dt className="text-xs font-medium text-slate-500">发布者</dt>
                  <dd className="mt-0.5 text-slate-900">{version.publishedBy || "未知管理员"}</dd>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Clock3 aria-hidden="true" className="h-5 w-5 text-slate-500" />
                <div>
                  <dt className="text-xs font-medium text-slate-500">发布时间</dt>
                  <dd className="mt-0.5 text-slate-900">
                    {new Intl.DateTimeFormat("zh-CN", {
                      dateStyle: "medium",
                      timeStyle: "short",
                    }).format(new Date(version.publishedAt))}
                  </dd>
                </div>
              </div>
            </dl>
          </header>

          {error ? (
            <div
              role="alert"
              aria-live="assertive"
              className="mt-5 flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-4 text-red-950"
            >
              <AlertCircle aria-hidden="true" className="h-5 w-5 shrink-0" />
              {error}
            </div>
          ) : null}

          <div className="mt-5">
            <ReadOnlyConfig domain={domain} config={version.config} />
          </div>

          <section className="mt-5 flex flex-col gap-4 rounded-xl border border-slate-200 bg-white p-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="font-semibold text-slate-950">需要重新使用这个版本？</h2>
              <p className="mt-1 text-slate-600">复制会创建新草稿，不会直接发布或覆盖历史记录。</p>
              {draftQuery.data ? (
                <p className="mt-2 font-medium text-amber-800">
                  当前已有修订版 {draftQuery.data.revision} 草稿，请先处理后再复制。
                </p>
              ) : null}
              {draftQuery.isError ? (
                <div
                  role="alert"
                  aria-label="草稿状态加载失败"
                  className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3 text-red-950"
                >
                  <p className="font-semibold">草稿状态加载失败</p>
                  <p className="mt-1 text-sm">无法确认是否已有草稿，因此暂时禁止复制。</p>
                  <button
                    type="button"
                    disabled={draftQuery.isFetching}
                    onClick={() => {
                      void draftQuery.refetch();
                    }}
                    className="mt-2 min-h-11 cursor-pointer rounded-lg border border-red-700 px-4 py-2 font-semibold outline-none hover:bg-red-100 focus-visible:ring-2 focus-visible:ring-red-800 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    重新检查草稿状态
                  </button>
                </div>
              ) : null}
            </div>
            <PermissionGate
              all={[meta.editPermission, "system.publish"]}
              fallback={
                <p className="text-sm text-slate-600">需要领域编辑和 system.publish 权限。</p>
              }
            >
              <button
                type="button"
                disabled={!draftQuery.isSuccess || Boolean(draftQuery.data)}
                onClick={() => {
                  setRestoreSummary(`从历史版本 v${version.version} 复制`);
                  setDialogOpen(true);
                }}
                className="inline-flex min-h-11 shrink-0 cursor-pointer items-center justify-center gap-2 rounded-lg bg-amber-700 px-5 py-2 font-semibold text-white outline-none transition-colors duration-200 hover:bg-amber-800 focus-visible:ring-2 focus-visible:ring-amber-700 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-40 motion-reduce:transition-none"
              >
                <Copy aria-hidden="true" className="h-4 w-4" />
                复制为新草稿
              </button>
            </PermissionGate>
          </section>

          <Dialog.Root
            open={dialogOpen}
            onOpenChange={(open) => !restoreMutation.isPending && setDialogOpen(open)}
          >
            <Dialog.Portal>
              <Dialog.Overlay className="fixed inset-0 z-40 bg-slate-950/55 backdrop-blur-[2px] data-[state=closed]:opacity-0 data-[state=open]:opacity-100 data-[state=closed]:transition-opacity data-[state=open]:transition-opacity data-[state=closed]:duration-200 data-[state=open]:duration-200 motion-reduce:transition-none" />
              <Dialog.Content className="fixed inset-x-4 top-1/2 z-50 max-h-[90dvh] -translate-y-1/2 overflow-y-auto rounded-2xl bg-white p-5 shadow-2xl outline-none focus-visible:ring-2 focus-visible:ring-blue-800 sm:left-1/2 sm:right-auto sm:w-[min(512px,calc(100vw-32px))] sm:-translate-x-1/2 sm:p-6">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <Dialog.Title className="text-xl font-semibold text-slate-950">
                      复制历史版本
                    </Dialog.Title>
                    <Dialog.Description className="mt-2 leading-6 text-slate-600">
                      将 {meta.label} v{version.version} 完整复制为新的可编辑草稿。此操作不会发布。
                    </Dialog.Description>
                  </div>
                  <Dialog.Close asChild>
                    <button
                      type="button"
                      aria-label="关闭复制确认"
                      disabled={restoreMutation.isPending}
                      className="flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-lg outline-none hover:bg-slate-100 focus-visible:ring-2 focus-visible:ring-blue-800 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      <X aria-hidden="true" className="h-5 w-5" />
                    </button>
                  </Dialog.Close>
                </div>
                <label className="mt-5 block font-medium text-slate-800">
                  变更摘要{" "}
                  <span aria-hidden="true" className="text-red-700">
                    *
                  </span>
                  <textarea
                    rows={3}
                    value={restoreSummary}
                    onChange={(event) => setRestoreSummary(event.target.value)}
                    className="mt-1.5 min-h-11 w-full resize-y rounded-lg border border-slate-300 px-3 py-2 text-[16px] outline-none focus-visible:ring-2 focus-visible:ring-blue-800 sm:text-sm"
                  />
                </label>
                <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                  <Dialog.Close asChild>
                    <button
                      type="button"
                      disabled={restoreMutation.isPending}
                      className="min-h-11 cursor-pointer rounded-lg border border-slate-300 px-4 py-2 font-semibold text-slate-800 outline-none hover:bg-slate-50 focus-visible:ring-2 focus-visible:ring-blue-800 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      取消
                    </button>
                  </Dialog.Close>
                  <PermissionGate all={[meta.editPermission, "system.publish"]}>
                    <button
                      type="button"
                      disabled={restoreMutation.isPending || !restoreSummary.trim()}
                      onClick={() => restoreMutation.mutate()}
                      className="inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-lg bg-amber-700 px-5 py-2 font-semibold text-white outline-none hover:bg-amber-800 focus-visible:ring-2 focus-visible:ring-amber-700 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      {restoreMutation.isPending ? (
                        <LoaderCircle
                          aria-hidden="true"
                          className="h-4 w-4 animate-spin motion-reduce:animate-none"
                        />
                      ) : null}
                      {restoreMutation.isPending ? "正在复制…" : "确认复制"}
                    </button>
                  </PermissionGate>
                </div>
              </Dialog.Content>
            </Dialog.Portal>
          </Dialog.Root>
        </>
      ) : null}
    </section>
  );
}

function ReadOnlyConfig({
  domain,
  config,
}: {
  domain: "sop" | "rating_threshold" | "fee";
  config: SettingsConfig;
}) {
  if (domain === "sop") {
    const value = config as SopConfig;

    return (
      <div className="space-y-5">
        <section className="rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="text-xl font-semibold text-slate-950">固定五步流程</h2>
          <ol className="mt-4 space-y-3">
            {value.steps.map((step) => (
              <li key={step.stepNumber} className="rounded-lg bg-slate-50 p-4">
                <p className="font-semibold text-slate-950">
                  第 {step.stepNumber} 步 · {step.stepName}
                </p>
                <p className="mt-2 leading-6 text-slate-700">{step.instruction}</p>
                <p className="mt-2 text-sm text-slate-600">
                  {step.expectedDurationMinutes} 分钟 · 至少 {step.minimumPhotoCount} 张照片 ·{" "}
                  {step.videoRequired ? "需要视频" : "无需视频"}
                </p>
              </li>
            ))}
          </ol>
        </section>
        <section className="rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="text-xl font-semibold text-slate-950">违规处理指引</h2>
          <ul className="mt-4 space-y-3">
            {value.violationRules.map((rule) => (
              <li key={rule.severity} className="rounded-lg bg-slate-50 p-4">
                <p className="font-semibold text-slate-950">
                  {violationSeverityLabel(rule.severity)}
                </p>
                <p className="mt-1 text-slate-700">{rule.description}</p>
              </li>
            ))}
          </ul>
        </section>
      </div>
    );
  }

  const rows =
    domain === "rating_threshold"
      ? [
          ["评分窗口", `${(config as RatingThresholdConfig).evaluationWindow} 条`],
          ["最小评价样本数", `${(config as RatingThresholdConfig).minimumSampleSize} 条`],
          ["预警评分", `${formatScoreAsStars((config as RatingThresholdConfig).warningScore)} 星`],
          [
            "暂停评分",
            `${formatScoreAsStars((config as RatingThresholdConfig).suspensionScore)} 星`,
          ],
          ["再培训要求", (config as RatingThresholdConfig).retrainingRequirement],
        ]
      : [
          [
            "平台佣金",
            `${formatBasisPointsAsPercent((config as FeeConfig).platformCommissionBps)}%`,
          ],
          ["悬赏服务费", `¥${formatCentsAsYuan((config as FeeConfig).rewardServiceFeeCents)}`],
          ["提现手续费", `${formatBasisPointsAsPercent((config as FeeConfig).withdrawalFeeBps)}%`],
          [
            "最低提现手续费",
            `¥${formatCentsAsYuan((config as FeeConfig).minimumWithdrawalFeeCents)}`,
          ],
        ];

  return (
    <dl className="grid gap-3 rounded-xl border border-slate-200 bg-white p-5 sm:grid-cols-2">
      {rows.map(([label, value]) => (
        <div key={label} className="rounded-lg bg-slate-50 p-4">
          <dt className="text-sm font-medium text-slate-600">{label}</dt>
          <dd className="mt-1 font-semibold text-slate-950">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

function violationSeverityLabel(severity: SopConfig["violationRules"][number]["severity"]): string {
  if (severity === "minor") {
    return "轻微";
  }

  if (severity === "moderate") {
    return "中等";
  }

  return "严重";
}

function Message({ title, message }: { title: string; message: string }) {
  return (
    <div
      role="alert"
      className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-6 text-amber-950"
    >
      <AlertCircle aria-hidden="true" className="h-8 w-8" />
      <h1 className="mt-3 text-xl font-semibold">{title}</h1>
      <p className="mt-2">{message}</p>
      <Link
        to="/settings"
        className="mt-4 inline-flex min-h-11 cursor-pointer items-center rounded-lg border border-amber-700 px-4 py-2 font-semibold outline-none focus-visible:ring-2 focus-visible:ring-amber-800"
      >
        返回系统设置
      </Link>
    </div>
  );
}
