import type {
  AdminServiceType,
  FeeConfig,
  RatingThresholdConfig,
  SopConfig,
} from "@petcare/shared-types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { AlertCircle, ArrowLeft, CheckCircle2, History, LoaderCircle, Save } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { isSystemConfigVersionConflict } from "../../api/system-settings/client";
import { useAuth } from "../../auth/auth.context";
import { PermissionGate } from "../../auth/PermissionGate";
import {
  fetchDomainCurrent,
  fetchDomainDiff,
  fetchDomainDraft,
  fetchDomainHistory,
  isSettingsPageDomain,
  publishDomainDraft,
  saveDomainDraft,
  settingsDomainMeta,
  type SettingsConfig,
} from "./domain-api";
import { FeeEditor } from "./FeeEditor";
import { settingsFieldId } from "./field-errors";
import { PublishDialog } from "./PublishDialog";
import { settingsQueryKeys } from "./query-keys";
import { RatingThresholdEditor, type SettingsFieldErrors } from "./RatingThresholdEditor";
import { SopEditor } from "./SopEditor";

const SERVICE_TYPES: Array<{ value: AdminServiceType; label: string }> = [
  { value: "feeding", label: "喂养" },
  { value: "walking", label: "遛宠" },
  { value: "playing", label: "陪玩" },
];

type EditorSnapshot = {
  scope: string;
  kind: "current" | "draft";
  revision: number;
  config: SettingsConfig;
  changeSummary: string;
  sourceToken: string;
};

function errorMessage(error: unknown): string {
  if (axios.isAxiosError<{ message?: string }>(error)) {
    return error.response?.data?.message ?? "请求失败，请稍后重试。";
  }

  return "请求失败，请稍后重试。";
}

export default function SettingsEdit() {
  const { domain: domainParam } = useParams();
  const [searchParams] = useSearchParams();
  const auth = useAuth();
  const queryClient = useQueryClient();
  const errorSummaryRef = useRef<HTMLDivElement>(null);
  const domain = isSettingsPageDomain(domainParam) ? domainParam : null;
  const requestedServiceType = searchParams.get("serviceType");
  const serviceType: AdminServiceType =
    requestedServiceType === "walking" || requestedServiceType === "playing"
      ? requestedServiceType
      : "feeding";
  const scope = domain ? `${domain}:${domain === "sop" ? serviceType : "all"}` : "invalid";
  const meta = domain ? settingsDomainMeta[domain] : null;
  const permissionSet = new Set(auth.user?.permissions ?? []);
  const canEdit = meta ? permissionSet.has(meta.editPermission) : false;
  const canPublish = canEdit && permissionSet.has("system.publish");
  const [editorSnapshot, setEditorSnapshot] = useState<EditorSnapshot | null>(null);
  const [fieldErrors, setFieldErrors] = useState<SettingsFieldErrors>({});
  const [dirty, setDirty] = useState(false);
  const [attempted, setAttempted] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [publishTransitionLocked, setPublishTransitionLocked] = useState(false);
  const [notice, setNotice] = useState<{ kind: "success" | "error"; message: string } | null>(null);
  const [conflict, setConflict] = useState<string | null>(null);

  const currentQuery = useQuery({
    queryKey: settingsQueryKeys.current(domain ?? "invalid", serviceType),
    queryFn: () => fetchDomainCurrent(domain!, serviceType),
    enabled: Boolean(domain && canEdit),
  });
  const draftQuery = useQuery({
    queryKey: settingsQueryKeys.draft(domain ?? "invalid", serviceType),
    queryFn: () => fetchDomainDraft(domain!, serviceType),
    enabled: Boolean(domain && canEdit),
  });
  const historyQuery = useQuery({
    queryKey: settingsQueryKeys.history(domain ?? "invalid", serviceType),
    queryFn: () => fetchDomainHistory(domain!, serviceType),
    enabled: Boolean(domain && canEdit),
  });
  const diffQuery = useQuery({
    queryKey: settingsQueryKeys.diff(domain ?? "invalid", serviceType),
    queryFn: () => fetchDomainDiff(domain!, serviceType),
    enabled: Boolean(domain && canPublish && dialogOpen && draftQuery.data),
  });

  const desiredEditorSnapshot = useMemo<EditorSnapshot | null>(() => {
    if (!draftQuery.isSuccess) {
      return null;
    }

    if (draftQuery.data) {
      return {
        scope,
        kind: "draft",
        revision: draftQuery.data.revision,
        config: draftQuery.data.config,
        changeSummary: draftQuery.data.changeSummary,
        sourceToken: `draft:${draftQuery.data.revision}:${JSON.stringify(draftQuery.data.config)}:${draftQuery.data.changeSummary}`,
      };
    }

    if (currentQuery.data) {
      return {
        scope,
        kind: "current",
        revision: 0,
        config: currentQuery.data.config,
        changeSummary: "",
        sourceToken: `current:${currentQuery.data.version}:${JSON.stringify(currentQuery.data.config)}`,
      };
    }

    return null;
  }, [scope, currentQuery.data, draftQuery.data, draftQuery.isSuccess]);

  useEffect(() => {
    if (editorSnapshot?.scope !== scope) {
      setEditorSnapshot(desiredEditorSnapshot);
      setFieldErrors({});
      setDirty(false);
      setAttempted(false);
      setConflict(null);
      setNotice(null);

      return;
    }

    if (!dirty) {
      setEditorSnapshot(desiredEditorSnapshot);
      setFieldErrors({});
      setAttempted(false);
    }
  }, [scope, desiredEditorSnapshot, dirty, editorSnapshot?.scope]);

  const localConfig = editorSnapshot?.config ?? null;
  const changeSummary = editorSnapshot?.changeSummary ?? "";
  const boundRevision = editorSnapshot?.revision ?? null;

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!domain || !localConfig) {
        throw new Error("配置表单无效");
      }

      if (boundRevision === null) {
        throw new Error("草稿修订版尚未确认");
      }

      return saveDomainDraft(domain, serviceType, {
        revision: boundRevision,
        config: localConfig,
        changeSummary: changeSummary.trim(),
      });
    },
    onSuccess: (draft) => {
      setEditorSnapshot({
        scope,
        kind: "draft",
        revision: draft.revision,
        config: draft.config,
        changeSummary: draft.changeSummary,
        sourceToken: `draft:${draft.revision}:${JSON.stringify(draft.config)}:${draft.changeSummary}`,
      });
      queryClient.setQueryData(settingsQueryKeys.draft(domain!, serviceType), draft);
      setDirty(false);
      setConflict(null);
      setNotice({ kind: "success", message: `草稿已保存，当前修订版为 ${draft.revision}。` });
      void queryClient.invalidateQueries({ queryKey: settingsQueryKeys.overview() });
      void queryClient.invalidateQueries({
        queryKey: settingsQueryKeys.diff(domain!, serviceType),
      });
    },
    onError: async (error) => {
      if (isSystemConfigVersionConflict(error)) {
        setConflict(
          "服务端草稿已更新。你的本地输入和原修订版仍保留；已读取服务端最新状态，请协调后重试。",
        );
        await draftQuery.refetch();

        return;
      }

      setNotice({ kind: "error", message: errorMessage(error) });
    },
  });

  const publishMutation = useMutation({
    onMutate: () => {
      setPublishTransitionLocked(true);
    },
    mutationFn: async () => {
      if (!domain || !draftQuery.data) {
        throw new Error("没有可发布草稿");
      }

      return publishDomainDraft(domain, serviceType, {
        revision: draftQuery.data.revision,
        idempotencyKey: globalThis.crypto.randomUUID(),
      });
    },
    onSuccess: async (published) => {
      setDialogOpen(false);
      setDirty(false);
      setNotice({ kind: "success", message: `版本 v${published.version} 已发布。` });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: settingsQueryKeys.overview() }),
        queryClient.invalidateQueries({
          queryKey: settingsQueryKeys.current(domain!, serviceType),
        }),
        queryClient.invalidateQueries({ queryKey: settingsQueryKeys.draft(domain!, serviceType) }),
        queryClient.invalidateQueries({
          queryKey: settingsQueryKeys.history(domain!, serviceType),
        }),
        queryClient.invalidateQueries({ queryKey: settingsQueryKeys.diff(domain!, serviceType) }),
      ]);
      setEditorSnapshot({
        scope,
        kind: "current",
        revision: 0,
        config: published.config,
        changeSummary: "",
        sourceToken: `current:${published.version}:${JSON.stringify(published.config)}`,
      });
    },
    onError: async (error) => {
      setDialogOpen(false);

      if (isSystemConfigVersionConflict(error)) {
        setDirty(true);
        setConflict(
          "发布确认已过期并关闭。你的本地输入和原修订版仍保留；已读取服务端最新状态，请协调后重试。",
        );
        await draftQuery.refetch();

        return;
      }

      setNotice({ kind: "error", message: errorMessage(error) });
    },
    onSettled: () => {
      setPublishTransitionLocked(false);
    },
  });

  const editorLocked = publishTransitionLocked || publishMutation.isPending;

  if (!domain || !meta) {
    return <PageMessage title="配置领域不存在" message="请返回系统设置并选择有效的配置领域。" />;
  }

  if (!canEdit) {
    return (
      <PageMessage
        title="没有编辑权限"
        message={`请联系管理员授予 ${meta.editPermission} 权限。`}
      />
    );
  }

  const loading =
    !localConfig &&
    (draftQuery.isPending || (draftQuery.isSuccess && !draftQuery.data && currentQuery.isPending));
  const revision = boundRevision ?? "不可用";
  const summaryError = attempted && !changeSummary.trim() ? "请填写本次变更摘要" : null;
  const hasErrors = Object.keys(fieldErrors).length > 0 || Boolean(summaryError) || !localConfig;

  function submitDraft() {
    setAttempted(true);
    setNotice(null);

    if (hasErrors) {
      globalThis.requestAnimationFrame(() => errorSummaryRef.current?.focus());

      return;
    }

    saveMutation.mutate();
  }

  function handleEditorChange(value: SettingsConfig | null, errors: SettingsFieldErrors) {
    if (editorLocked) {
      return;
    }

    if (value) {
      setEditorSnapshot((snapshot) => (snapshot ? { ...snapshot, config: value } : snapshot));
    }

    setFieldErrors(errors);
    setDirty(true);
    setNotice(null);
  }

  function focusSettingsField(path: string) {
    document.getElementById(settingsFieldId(path))?.focus();
  }

  return (
    <section className="mx-auto w-full max-w-[1280px]">
      <Link
        to="/settings"
        className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-lg px-2 font-medium text-blue-800 outline-none transition-colors duration-200 hover:bg-blue-50 focus-visible:ring-2 focus-visible:ring-blue-800 motion-reduce:transition-none"
      >
        <ArrowLeft aria-hidden="true" className="h-4 w-4" />
        返回系统设置
      </Link>
      <header className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="font-medium text-blue-800">配置编辑器</p>
          <h1 className="mt-1 text-2xl font-bold text-slate-950 sm:text-3xl">编辑{meta.label}</h1>
          <p className="mt-2 text-slate-600">
            当前草稿修订版：<span className="font-semibold text-slate-900">{revision}</span>
            {dirty ? " · 有未保存变更" : " · 已与服务端同步"}
          </p>
        </div>
        <Link
          to={`/settings/${domain}/history/${currentQuery.data?.id ?? "latest"}${domain === "sop" ? `?serviceType=${serviceType}` : ""}`}
          className="inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-lg border border-slate-300 px-4 py-2 font-semibold text-slate-800 outline-none transition-colors duration-200 hover:bg-white focus-visible:ring-2 focus-visible:ring-blue-800 motion-reduce:transition-none"
        >
          <History aria-hidden="true" className="h-4 w-4" />
          历史版本
        </Link>
      </header>

      {domain === "sop" ? (
        <nav
          aria-label="SOP 服务类型"
          className="mt-6 grid grid-cols-3 gap-2 rounded-xl border border-slate-200 bg-white p-2"
        >
          {SERVICE_TYPES.map((item) => (
            <Link
              key={item.value}
              to={`/settings/sop/edit?serviceType=${item.value}`}
              aria-current={serviceType === item.value ? "page" : undefined}
              className={`flex min-h-11 cursor-pointer items-center justify-center rounded-lg px-3 py-2 font-semibold outline-none transition-colors duration-200 focus-visible:ring-2 focus-visible:ring-blue-800 motion-reduce:transition-none ${serviceType === item.value ? "bg-blue-800 text-white" : "text-slate-700 hover:bg-slate-100"}`}
            >
              {item.label}
            </Link>
          ))}
        </nav>
      ) : null}

      <div aria-live="polite" className="mt-5 space-y-3">
        {notice ? (
          <div
            role={notice.kind === "error" ? "alert" : "status"}
            className={`flex items-start gap-3 rounded-lg border p-4 ${notice.kind === "success" ? "border-emerald-200 bg-emerald-50 text-emerald-950" : "border-red-200 bg-red-50 text-red-950"}`}
          >
            {notice.kind === "success" ? (
              <CheckCircle2 aria-hidden="true" className="h-5 w-5 shrink-0" />
            ) : (
              <AlertCircle aria-hidden="true" className="h-5 w-5 shrink-0" />
            )}
            <span>{notice.message}</span>
          </div>
        ) : null}
        {conflict ? (
          <div
            role="alert"
            className="flex items-start gap-3 rounded-lg border border-amber-300 bg-amber-50 p-4 text-amber-950"
          >
            <AlertCircle aria-hidden="true" className="h-5 w-5 shrink-0" />
            <div>
              <p className="font-semibold">检测到版本冲突</p>
              <p className="mt-1 leading-6">{conflict}</p>
              <p className="mt-1 text-sm">
                服务端当前修订版：{draftQuery.data?.revision ?? "正在刷新"}
              </p>
            </div>
          </div>
        ) : null}
      </div>

      {attempted && hasErrors ? (
        <div
          ref={errorSummaryRef}
          tabIndex={-1}
          role="alert"
          className="mt-5 rounded-lg border-2 border-red-300 bg-red-50 p-4 text-red-950 outline-none focus-visible:ring-2 focus-visible:ring-red-700"
        >
          <h2 className="font-semibold">请先修正表单问题</h2>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            {summaryError ? (
              <li>
                <button
                  type="button"
                  onClick={() => focusSettingsField("changeSummary")}
                  className="min-h-11 cursor-pointer text-left font-medium underline underline-offset-2 outline-none focus-visible:ring-2 focus-visible:ring-red-700"
                >
                  {summaryError}
                </button>
              </li>
            ) : null}
            {Object.entries(fieldErrors).map(([path, error]) => (
              <li key={path}>
                <button
                  type="button"
                  onClick={() => focusSettingsField(path)}
                  className="min-h-11 cursor-pointer text-left font-medium underline underline-offset-2 outline-none focus-visible:ring-2 focus-visible:ring-red-700"
                >
                  {error}
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {loading ? (
        <p
          aria-live="polite"
          className="mt-8 rounded-xl border border-slate-200 bg-white p-8 text-center text-slate-600"
        >
          正在加载配置…
        </p>
      ) : null}
      {currentQuery.isError ? (
        <div
          role="alert"
          aria-label="当前生效版本加载失败"
          className="mt-8 rounded-xl border border-red-200 bg-red-50 p-5 text-red-950"
        >
          <p className="font-semibold">当前生效版本加载失败</p>
          <p className="mt-1">草稿与编辑区不受影响，可单独重试当前版本查询。</p>
          <button
            type="button"
            disabled={currentQuery.isFetching}
            onClick={() => {
              void currentQuery.refetch();
            }}
            className="mt-4 min-h-11 cursor-pointer rounded-lg border border-red-700 px-4 py-2 font-semibold outline-none focus-visible:ring-2 focus-visible:ring-red-700 disabled:cursor-not-allowed disabled:opacity-40"
          >
            重新加载当前版本
          </button>
        </div>
      ) : null}
      {draftQuery.isError ? (
        <div
          role="alert"
          aria-label="草稿状态加载失败"
          className="mt-4 rounded-xl border border-red-200 bg-red-50 p-5 text-red-950"
        >
          <p className="font-semibold">草稿状态加载失败</p>
          <p className="mt-1">
            {currentQuery.data
              ? "当前版本已加载；草稿状态确认前编辑器保持关闭。"
              : "草稿状态确认前编辑器保持关闭；可分别重试当前版本和草稿查询。"}
          </p>
          <button
            type="button"
            disabled={draftQuery.isFetching}
            onClick={() => {
              void draftQuery.refetch();
            }}
            className="mt-4 min-h-11 cursor-pointer rounded-lg border border-red-700 px-4 py-2 font-semibold outline-none focus-visible:ring-2 focus-visible:ring-red-700 disabled:cursor-not-allowed disabled:opacity-40"
          >
            重新加载草稿状态
          </button>
        </div>
      ) : null}

      {!loading && localConfig ? (
        <fieldset disabled={editorLocked} role="presentation" className="mt-6 min-w-0 border-0 p-0">
          {domain === "sop" ? (
            <SopEditor
              key={editorSnapshot?.sourceToken}
              initialValue={localConfig as SopConfig}
              onChange={handleEditorChange}
            />
          ) : null}
          {domain === "rating_threshold" ? (
            <RatingThresholdEditor
              key={editorSnapshot?.sourceToken}
              initialValue={localConfig as RatingThresholdConfig}
              onChange={handleEditorChange}
            />
          ) : null}
          {domain === "fee" ? (
            <FeeEditor
              key={editorSnapshot?.sourceToken}
              initialValue={localConfig as FeeConfig}
              onChange={handleEditorChange}
            />
          ) : null}

          <section className="mt-5 rounded-xl border border-slate-200 bg-white p-4 sm:p-6">
            <label className="font-medium text-slate-800">
              变更摘要{" "}
              <span aria-hidden="true" className="text-red-700">
                *
              </span>
              <textarea
                id={settingsFieldId("changeSummary")}
                rows={3}
                value={changeSummary}
                onChange={(event) => {
                  if (editorLocked) {
                    return;
                  }

                  setEditorSnapshot((snapshot) =>
                    snapshot ? { ...snapshot, changeSummary: event.target.value } : snapshot,
                  );
                  setDirty(true);
                }}
                aria-invalid={Boolean(summaryError)}
                aria-describedby="change-summary-help change-summary-error"
                className="mt-1.5 min-h-11 w-full resize-y rounded-lg border border-slate-300 px-3 py-2 text-[16px] text-slate-950 outline-none transition-colors duration-200 focus-visible:border-blue-800 focus-visible:ring-2 focus-visible:ring-blue-800/20 sm:text-sm"
              />
              <span
                id="change-summary-help"
                className="mt-1 block text-xs font-normal text-slate-500"
              >
                说明为什么调整，发布记录会永久保留这段内容。
              </span>
              {summaryError ? (
                <span id="change-summary-error" role="alert" className="mt-1 block text-red-700">
                  {summaryError}
                </span>
              ) : null}
            </label>
          </section>

          <div className="mt-5 flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
            <p className="text-slate-600">先保存草稿，再检查字段差异并发布。</p>
            <div className="flex flex-col-reverse gap-3 sm:flex-row">
              <PermissionGate all={[meta.editPermission]}>
                <button
                  type="button"
                  onClick={submitDraft}
                  disabled={
                    boundRevision === null || saveMutation.isPending || publishMutation.isPending
                  }
                  className="inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-lg border border-blue-700 px-4 py-2 font-semibold text-blue-800 outline-none transition-colors duration-200 hover:bg-blue-50 focus-visible:ring-2 focus-visible:ring-blue-800 disabled:cursor-not-allowed disabled:opacity-40 motion-reduce:transition-none"
                >
                  {saveMutation.isPending ? (
                    <LoaderCircle
                      aria-hidden="true"
                      className="h-4 w-4 animate-spin motion-reduce:animate-none"
                    />
                  ) : (
                    <Save aria-hidden="true" className="h-4 w-4" />
                  )}
                  {saveMutation.isPending ? "正在保存…" : "保存草稿"}
                </button>
              </PermissionGate>
              <PermissionGate
                all={["system.publish"]}
                fallback={
                  <p className="self-center text-sm text-slate-600">
                    需要 system.publish 权限才能发布。
                  </p>
                }
              >
                <button
                  type="button"
                  onClick={() => {
                    setNotice(null);
                    setDialogOpen(true);
                  }}
                  disabled={
                    !draftQuery.data || dirty || saveMutation.isPending || publishMutation.isPending
                  }
                  className="min-h-11 cursor-pointer rounded-lg bg-amber-700 px-5 py-2 font-semibold text-white outline-none transition-colors duration-200 hover:bg-amber-800 focus-visible:ring-2 focus-visible:ring-amber-700 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-40 motion-reduce:transition-none"
                >
                  检查并发布
                </button>
              </PermissionGate>
            </div>
          </div>
        </fieldset>
      ) : null}

      <section
        className="mt-6 rounded-xl border border-slate-200 bg-white p-4 sm:p-6"
        aria-labelledby="recent-history-heading"
      >
        <h2 id="recent-history-heading" className="text-xl font-semibold text-slate-950">
          最近发布历史
        </h2>
        {historyQuery.isPending ? <p className="mt-3 text-slate-600">正在加载历史…</p> : null}
        {historyQuery.isError ? (
          <div
            role="alert"
            aria-label="最近发布历史加载失败"
            className="mt-3 rounded-lg border border-red-200 bg-red-50 p-4 text-red-950"
          >
            <p className="font-semibold">最近发布历史加载失败</p>
            <p className="mt-1 text-sm">配置编辑不受影响，可稍后单独重试历史查询。</p>
            <button
              type="button"
              disabled={historyQuery.isFetching}
              onClick={() => {
                void historyQuery.refetch();
              }}
              className="mt-3 min-h-11 cursor-pointer rounded-lg border border-red-700 px-4 py-2 font-semibold outline-none hover:bg-red-100 focus-visible:ring-2 focus-visible:ring-red-800 disabled:cursor-not-allowed disabled:opacity-40"
            >
              重新加载发布历史
            </button>
          </div>
        ) : null}
        {historyQuery.isSuccess && historyQuery.data.list.length === 0 ? (
          <p className="mt-3 rounded-lg bg-slate-50 p-4 text-slate-600">暂无已发布版本。</p>
        ) : null}
        <ul className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {historyQuery.data?.list.map((item) => (
            <li key={item.id}>
              <Link
                to={`/settings/${domain}/history/${item.id}${domain === "sop" ? `?serviceType=${serviceType}` : ""}`}
                className="block min-h-11 cursor-pointer rounded-lg border border-slate-200 p-3 outline-none transition-colors duration-200 hover:border-blue-300 hover:bg-blue-50 focus-visible:ring-2 focus-visible:ring-blue-800 motion-reduce:transition-none"
              >
                <span className="font-semibold text-slate-950">版本 v{item.version}</span>
                <span className="mt-1 block text-sm text-slate-600">{item.changeSummary}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <PublishDialog
        open={dialogOpen}
        title={meta.label}
        impact={meta.impact}
        diff={diffQuery.data ?? []}
        diffLoading={diffQuery.isFetching}
        diffError={diffQuery.isError}
        pending={publishMutation.isPending}
        onOpenChange={setDialogOpen}
        onRetryDiff={() => {
          void diffQuery.refetch();
        }}
        onPublish={() => publishMutation.mutate()}
      />
    </section>
  );
}

function PageMessage({ title, message }: { title: string; message: string }) {
  return (
    <section
      className="mx-auto max-w-[448px] rounded-xl border border-amber-200 bg-amber-50 p-6 text-amber-950"
      role="alert"
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
    </section>
  );
}
