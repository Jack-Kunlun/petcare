import { isCurrentWebsiteContentKey } from "@petcare/shared-types";
import * as Dialog from "@radix-ui/react-dialog";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertCircle, ArrowLeft, Copy, History, LoaderCircle, X } from "lucide-react";
import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  fetchWebsiteContentDraft,
  fetchWebsiteContentHistoryVersion,
  restoreWebsiteContent,
  websiteContentQueryKeys,
} from "../../api/website-content";
import { PermissionGate } from "../../auth/PermissionGate";
import { EditorPageLayout, FormSection } from "../../components/EditorPageLayout";
import {
  getContentAreaLabel,
  getContentEditPath,
  getContentOverviewPath,
} from "./content-registry";

function formatDate(value: string | null): string {
  if (!value) {
    return "未记录";
  }

  return new Intl.DateTimeFormat("zh-CN", { dateStyle: "medium", timeStyle: "short" }).format(
    new Date(value),
  );
}

/** Displays one immutable Website Content history version and restores it only as a new draft. */
export default function WebsiteContentDetail() {
  const { contentKey: contentKeyParam, versionId } = useParams();
  const contentKey = isCurrentWebsiteContentKey(contentKeyParam) ? contentKeyParam : null;
  const overviewPath = contentKey ? getContentOverviewPath(contentKey) : "/website-content";
  const areaLabel = contentKey ? getContentAreaLabel(contentKey) : "官网管理";
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [changeSummary, setChangeSummary] = useState("");
  const [error, setError] = useState<string | null>(null);

  const versionQuery = useQuery({
    queryKey: websiteContentQueryKeys.historyVersion(contentKey ?? "home", versionId ?? "invalid"),
    queryFn: () => fetchWebsiteContentHistoryVersion(contentKey!, versionId!),
    enabled: Boolean(contentKey && versionId),
  });
  const draftQuery = useQuery({
    queryKey: websiteContentQueryKeys.draft(contentKey ?? "home"),
    queryFn: () => fetchWebsiteContentDraft(contentKey!),
    enabled: Boolean(contentKey),
  });
  const version = versionQuery.data;

  const restoreMutation = useMutation({
    mutationFn: async () => {
      if (!contentKey || !version || !draftQuery.data) {
        throw new Error("当前草稿不可用");
      }

      return restoreWebsiteContent(contentKey, {
        versionId: version.id,
        revision: draftQuery.data.revision,
        changeSummary: changeSummary.trim(),
      });
    },
    onSuccess: async () => {
      if (!contentKey) {
        return;
      }

      setDialogOpen(false);
      setChangeSummary("");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: websiteContentQueryKeys.overview() }),
        queryClient.invalidateQueries({ queryKey: websiteContentQueryKeys.draft(contentKey!) }),
        queryClient.invalidateQueries({ queryKey: websiteContentQueryKeys.diff(contentKey!) }),
        queryClient.invalidateQueries({ queryKey: ["website-content", contentKey!, "history"] }),
      ]);
      navigate(getContentEditPath(contentKey));
    },
    onError: () => {
      setDialogOpen(false);
      setError("恢复历史版本失败，请刷新当前草稿后重试。");
    },
  });

  if (!contentKey || !versionId) {
    return <Message title="历史版本路径无效" message="请返回内容列表并选择一个有效的历史版本。" />;
  }

  const backLink = (
    <Link
      to={getContentEditPath(contentKey)}
      className="inline-flex min-h-11 items-center gap-2 rounded-lg px-2 font-medium text-blue-800 outline-none hover:bg-blue-50 focus-visible:ring-2 focus-visible:ring-blue-800"
    >
      <ArrowLeft aria-hidden="true" className="h-4 w-4" />
      返回{areaLabel}编辑
    </Link>
  );
  const restoreDisabled = draftQuery.isPending || draftQuery.isError || !draftQuery.data;

  function openRestoreDialog() {
    if (!version) {
      return;
    }

    setChangeSummary(`从历史版本创建恢复草稿 v${version.businessVersion ?? version.revision}`);
    setDialogOpen(true);
  }

  function renderRestoreAction(top = false) {
    return (
      <PermissionGate
        all={["website.publish"]}
        fallback={
          top ? undefined : <p className="text-sm text-slate-600">需要 website.publish 权限。</p>
        }
      >
        <button
          type="button"
          aria-label={top ? "顶部恢复为新草稿" : undefined}
          disabled={restoreDisabled}
          onClick={openRestoreDialog}
          className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-lg bg-amber-700 px-5 font-semibold text-white outline-none hover:bg-amber-800 focus-visible:ring-2 focus-visible:ring-amber-700 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Copy aria-hidden="true" className="h-4 w-4" />
          恢复为新草稿
        </button>
      </PermissionGate>
    );
  }

  if (!version) {
    return (
      <section className="mx-auto w-full max-w-[1024px]">
        {backLink}
        {versionQuery.isPending ? (
          <p
            aria-live="polite"
            className="mt-6 rounded-xl border border-slate-200 bg-white p-8 text-center text-slate-600"
          >
            正在加载历史版本…
          </p>
        ) : null}
        {versionQuery.isError ? (
          <Message
            title="历史版本加载失败"
            message="请检查网络连接后重试。"
            returnPath={overviewPath}
            returnLabel={`返回${areaLabel}`}
          />
        ) : null}
      </section>
    );
  }

  return (
    <>
      <EditorPageLayout
        width="narrow"
        title={`历史版本 ${version.businessVersion === null ? `r${version.revision}` : `v${version.businessVersion}`}`}
        description={
          <>
            <span className="mr-2 inline-flex items-center gap-2 font-medium text-blue-800">
              <History aria-hidden="true" className="h-4 w-4" />
              只读历史详情
            </span>
            {version.changeSummary}
          </>
        }
        status={
          <span className="self-start rounded-full border border-slate-300 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700">
            {version.status === "published" ? "当前生效" : "历史版本"}
          </span>
        }
        back={backLink}
        actions={renderRestoreAction(true)}
      >
        <FormSection title="版本元数据">
          <dl className="grid gap-3 sm:grid-cols-2">
            <div>
              <dt className="text-xs font-medium text-slate-500">创建人</dt>
              <dd className="mt-1 text-slate-900">{version.createdBy.displayName}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-slate-500">创建时间</dt>
              <dd className="mt-1 text-slate-900">{formatDate(version.createdAt)}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-slate-500">发布人</dt>
              <dd className="mt-1 text-slate-900">
                {version.publishedBy?.displayName ?? "未发布"}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-slate-500">发布时间</dt>
              <dd className="mt-1 text-slate-900">{formatDate(version.publishedAt)}</dd>
            </div>
          </dl>
        </FormSection>

        {error ? (
          <div
            role="alert"
            className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-4 text-red-950"
          >
            <AlertCircle aria-hidden="true" className="h-5 w-5 shrink-0" />
            {error}
          </div>
        ) : null}

        <FormSection title="SEO 快照">
          <dl className="grid gap-3 sm:grid-cols-2">
            <div>
              <dt className="text-xs font-medium text-slate-500">标题</dt>
              <dd className="mt-1 text-slate-900">{version.seo.title}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-slate-500">Canonical</dt>
              <dd className="mt-1 font-mono text-sm text-slate-900">{version.seo.canonicalPath}</dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-xs font-medium text-slate-500">描述</dt>
              <dd className="mt-1 text-slate-900">{version.seo.description}</dd>
            </div>
          </dl>
        </FormSection>

        <FormSection title={`区块快照（${version.sections.length}）`}>
          <ol className="space-y-2">
            {version.sections.map((section) => (
              <li
                key={section.sectionKey}
                className="flex items-center justify-between gap-3 rounded-lg bg-slate-50 p-3"
              >
                <span className="font-medium text-slate-900">{section.sectionKey}</span>
                <span className="text-sm text-slate-600">
                  {section.sectionType} · {section.isEnabled ? "启用" : "隐藏"}
                </span>
              </li>
            ))}
          </ol>
        </FormSection>

        <FormSection title="恢复为新草稿" actions={renderRestoreAction()}>
          <p className="text-sm leading-6 text-slate-600">
            恢复只会创建新的不可变草稿，不会直接发布或修改历史记录。
          </p>
          {draftQuery.isError ? (
            <p role="alert" className="mt-2 text-sm text-red-700">
              当前草稿加载失败，暂时不能恢复。
            </p>
          ) : null}
        </FormSection>
      </EditorPageLayout>

      <Dialog.Root
        open={dialogOpen}
        onOpenChange={(open) => !restoreMutation.isPending && setDialogOpen(open)}
      >
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-40 bg-slate-950/55 backdrop-blur-[2px]" />
          <Dialog.Content className="fixed inset-x-4 top-1/2 z-50 max-h-[90dvh] -translate-y-1/2 overflow-y-auto rounded-2xl bg-white p-5 shadow-2xl outline-none focus-visible:ring-2 focus-visible:ring-blue-800 sm:left-1/2 sm:right-auto sm:w-[min(512px,calc(100vw-32px))] sm:-translate-x-1/2 sm:p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <Dialog.Title className="text-xl font-semibold text-slate-950">
                  确认创建恢复草稿
                </Dialog.Title>
                <Dialog.Description className="mt-2 leading-6 text-slate-600">
                  该操作不会直接发布，创建后请在编辑页重新预览并显式发布。
                </Dialog.Description>
              </div>
              <Dialog.Close asChild>
                <button
                  type="button"
                  aria-label="关闭恢复确认"
                  disabled={restoreMutation.isPending}
                  className="flex h-11 w-11 items-center justify-center rounded-lg outline-none hover:bg-slate-100 focus-visible:ring-2 focus-visible:ring-blue-800 disabled:opacity-40"
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
                aria-label="恢复变更摘要"
                rows={3}
                value={changeSummary}
                onChange={(event) => setChangeSummary(event.target.value)}
                className="mt-2 w-full resize-y rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-blue-700 focus:ring-2 focus:ring-blue-700/20"
              />
            </label>
            <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <Dialog.Close asChild>
                <button
                  type="button"
                  disabled={restoreMutation.isPending}
                  className="min-h-11 rounded-lg border border-slate-300 px-4 py-2 font-semibold text-slate-800 outline-none hover:bg-slate-50 focus-visible:ring-2 focus-visible:ring-blue-800 disabled:opacity-40"
                >
                  取消
                </button>
              </Dialog.Close>
              <button
                type="button"
                disabled={restoreMutation.isPending || !changeSummary.trim()}
                onClick={() => restoreMutation.mutate()}
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-amber-700 px-5 py-2 font-semibold text-white outline-none hover:bg-amber-800 focus-visible:ring-2 focus-visible:ring-amber-700 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {restoreMutation.isPending ? (
                  <LoaderCircle aria-hidden="true" className="h-4 w-4 animate-spin" />
                ) : null}
                {restoreMutation.isPending ? "正在创建…" : "确认创建草稿"}
              </button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </>
  );
}

function Message({
  title,
  message,
  returnPath = "/website-content",
  returnLabel = "返回官网管理",
}: {
  title: string;
  message: string;
  returnPath?: string;
  returnLabel?: string;
}) {
  return (
    <div
      role="alert"
      className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-6 text-amber-950"
    >
      <AlertCircle aria-hidden="true" className="h-8 w-8" />
      <h1 className="mt-3 text-xl font-semibold">{title}</h1>
      <p className="mt-2">{message}</p>
      <Link
        to={returnPath}
        className="mt-4 inline-flex min-h-11 items-center rounded-lg border border-amber-700 px-4 py-2 font-semibold outline-none focus-visible:ring-2 focus-visible:ring-amber-800"
      >
        {returnLabel}
      </Link>
    </div>
  );
}
