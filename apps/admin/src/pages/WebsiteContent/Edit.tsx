import {
  isCurrentWebsiteContentKey,
  type ApiErrorResponse,
  type CurrentWebsiteContentKey,
  type WebsiteContentKey,
  type WebsiteContentSection,
  type WebsiteContentVersion,
  type WebsiteMediaListQuery,
  type WebsiteSeoContent,
} from "@petcare/shared-types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  ChevronDown,
  Eye,
  History,
  Images,
  RefreshCw,
  Save,
  Send,
} from "lucide-react";
import { type FormEvent, useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  archiveWebsiteMediaAsset,
  createWebsiteContentPreview,
  fetchWebsiteContentDiff,
  fetchWebsiteContentDraft,
  fetchWebsiteContentHistory,
  fetchWebsiteMediaAssets,
  publishWebsiteContent,
  saveWebsiteContentDraft,
  uploadWebsiteMediaAsset,
  websiteContentQueryKeys,
} from "../../api/website-content";
import { useAuth } from "../../auth/auth.context";
import { PermissionGate } from "../../auth/PermissionGate";
import { EditorPageLayout, FormSection } from "../../components/EditorPageLayout";
import { Badge, Button, StatePanel } from "../../components/ui";
import { useUnsavedChanges } from "../../hooks/useUnsavedChanges";
import {
  getContentAreaLabel,
  getContentOverviewPath,
  MANAGED_CONTENT_LABELS,
} from "./content-registry";
import { ContentHistory } from "./ContentHistory";
import { TextField } from "./editors/fields";
import { WebsiteSectionEditor } from "./editors/WebsiteSectionEditor";
import { MediaAssetPicker } from "./MediaAssetPicker";
import { PublishDialog } from "./PublishDialog";
import { WebsiteMediaLibrary } from "./WebsiteMediaLibrary";

const REQUIRED_SECTION_KEYS: Record<CurrentWebsiteContentKey, readonly string[]> = {
  site_shell: ["site_header", "site_footer"],
  home: ["hero", "home_experience"],
  about: ["hero"],
  contact: ["hero", "contact_channels"],
  help: [],
  privacy: ["legal_content"],
  terms: ["legal_content"],
};

interface DraftEditorState {
  contentKey: WebsiteContentKey;
  revision: number;
  seo: WebsiteSeoContent;
  sections: WebsiteContentSection[];
  changeSummary: string;
}

function isRevisionConflict(error: unknown): boolean {
  if (
    typeof error === "object" &&
    error !== null &&
    "response" in error &&
    typeof error.response === "object" &&
    error.response !== null &&
    "status" in error.response &&
    "data" in error.response &&
    error.response.status === 409 &&
    typeof error.response.data === "object" &&
    error.response.data !== null &&
    "code" in error.response.data &&
    error.response.data.code === "WEBSITE_CONTENT_REVISION_CONFLICT"
  ) {
    return true;
  }

  return (
    axios.isAxiosError<ApiErrorResponse>(error) &&
    error.response?.status === 409 &&
    error.response.data?.code === "WEBSITE_CONTENT_REVISION_CONFLICT"
  );
}

function isSafeLinkDestination(value: string): boolean {
  if (value.startsWith("/")) {
    return true;
  }

  return /^(https:\/\/|mailto:|tel:)/u.test(value);
}

function findReferenceValidationError(sections: readonly WebsiteContentSection[]): string | null {
  const visit = (value: unknown): string | null => {
    if (Array.isArray(value)) {
      for (const item of value) {
        const issue = visit(item);

        if (issue) {
          return issue;
        }
      }

      return null;
    }

    if (typeof value !== "object" || value === null) {
      return null;
    }

    const record = value as Record<string, unknown>;

    if (
      "altText" in record &&
      (!record.altText || typeof record.altText !== "string" || !record.altText.trim())
    ) {
      return "请为每张图片填写有意义的替代文本。";
    }

    if (
      "href" in record &&
      (typeof record.href !== "string" || !isSafeLinkDestination(record.href))
    ) {
      return "请使用站内路径、HTTPS、mailto 或 tel 链接。";
    }

    for (const child of Object.values(record)) {
      const issue = visit(child);

      if (issue) {
        return issue;
      }
    }

    return null;
  };

  return visit(sections);
}

function errorMessage(error: unknown): string {
  if (axios.isAxiosError<ApiErrorResponse>(error)) {
    return error.response?.data?.message ?? "保存草稿失败，请稍后重试。";
  }

  return "保存草稿失败，请稍后重试。";
}

function stateFromDraft(draft: WebsiteContentVersion): DraftEditorState {
  return {
    contentKey: draft.contentKey,
    revision: draft.revision,
    seo: structuredClone(draft.seo),
    sections: structuredClone(draft.sections).sort(
      (left, right) => left.sortOrder - right.sortOrder,
    ),
    changeSummary: draft.changeSummary,
  };
}

/** Edits one fixed Website Content template and saves complete immutable draft snapshots. */
export default function WebsiteContentEdit() {
  const { contentKey: contentKeyParam } = useParams();
  const auth = useAuth();
  const queryClient = useQueryClient();
  const contentKey = isCurrentWebsiteContentKey(contentKeyParam) ? contentKeyParam : null;
  const overviewPath = contentKey ? getContentOverviewPath(contentKey) : "/website-content";
  const areaLabel = contentKey ? getContentAreaLabel(contentKey) : "官网管理";
  const canEdit = auth.user?.permissions.includes("website.edit") ?? false;
  const canPublish = auth.user?.permissions.includes("website.publish") ?? false;
  const canReadDraft = canEdit || canPublish;
  const [editorState, setEditorState] = useState<DraftEditorState | null>(null);
  const [dirty, setDirty] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [serverRevision, setServerRevision] = useState<number | null>(null);
  const [publishDialogOpen, setPublishDialogOpen] = useState(false);
  const [mediaQuery, setMediaQuery] = useState<WebsiteMediaListQuery>({ page: 1, pageSize: 20 });
  const unsavedChanges = useUnsavedChanges(dirty);

  const draftQuery = useQuery({
    queryKey: websiteContentQueryKeys.draft(contentKey ?? "home"),
    queryFn: () => fetchWebsiteContentDraft(contentKey!),
    enabled: Boolean(contentKey && canReadDraft),
  });

  const historyQuery = useQuery({
    queryKey: websiteContentQueryKeys.history(contentKey ?? "home", { page: 1, pageSize: 20 }),
    queryFn: () => fetchWebsiteContentHistory(contentKey!, { page: 1, pageSize: 20 }),
    enabled: Boolean(contentKey && canReadDraft),
  });

  const diffQuery = useQuery({
    queryKey: websiteContentQueryKeys.diff(contentKey ?? "home"),
    queryFn: () => fetchWebsiteContentDiff(contentKey!),
    enabled: Boolean(contentKey && canPublish && publishDialogOpen && !dirty),
  });

  const mediaAssetsQuery = useQuery({
    queryKey: websiteContentQueryKeys.media(mediaQuery),
    queryFn: () => fetchWebsiteMediaAssets(mediaQuery),
    enabled: canEdit,
  });

  const remoteState = useMemo(
    () => (draftQuery.data ? stateFromDraft(draftQuery.data) : null),
    [draftQuery.data],
  );

  useEffect(() => {
    if (remoteState && !dirty) {
      setEditorState(remoteState);
      setValidationError(null);
    }
  }, [remoteState, dirty]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!contentKey || !editorState) {
        throw new Error("页面内容草稿不可用");
      }

      return saveWebsiteContentDraft(contentKey, {
        revision: editorState.revision,
        changeSummary: editorState.changeSummary.trim(),
        seo: editorState.seo,
        sections: editorState.sections,
      });
    },
    onSuccess: (savedDraft) => {
      const next = stateFromDraft(savedDraft);

      setEditorState(next);
      setDirty(false);
      setServerRevision(null);
      setNotice(`草稿已保存，当前修订版为 r${savedDraft.revision}。`);
      queryClient.setQueryData(websiteContentQueryKeys.draft(savedDraft.contentKey), savedDraft);
      void queryClient.invalidateQueries({ queryKey: websiteContentQueryKeys.overview() });
      void queryClient.invalidateQueries({
        queryKey: websiteContentQueryKeys.diff(savedDraft.contentKey),
      });
    },
    onError: async (error) => {
      if (isRevisionConflict(error)) {
        const result = await draftQuery.refetch();

        setServerRevision(result.data?.revision ?? null);

        return;
      }
    },
  });

  const previewMutation = useMutation({
    mutationFn: async (previewWindow: Window | null) => {
      if (!contentKey || !editorState || dirty) {
        throw new Error("预览必须使用已保存草稿。");
      }

      if (!previewWindow) {
        throw new Error("浏览器阻止了预览窗口，请允许弹窗后重试。");
      }

      return createWebsiteContentPreview(contentKey, { revision: editorState.revision });
    },
    onSuccess: (preview, previewWindow) => {
      previewWindow?.location.replace(preview.previewUrl);
    },
    onError: (_error, previewWindow) => {
      previewWindow?.close();
    },
  });

  const handlePreview = () => {
    const previewWindow = globalThis.open("about:blank", "_blank");

    if (previewWindow) {
      previewWindow.opener = null;
    }

    previewMutation.mutate(previewWindow);
  };

  const publishMutation = useMutation({
    mutationFn: async (request: Parameters<typeof publishWebsiteContent>[1]) => {
      if (!contentKey || dirty) {
        throw new Error("发布必须使用已保存草稿。");
      }

      return publishWebsiteContent(contentKey, request);
    },
    onSuccess: (result) => {
      const next = stateFromDraft(result.draft);

      setEditorState(next);
      setDirty(false);
      setPublishDialogOpen(false);
      setNotice(`已发布业务版本 v${result.published.businessVersion}。`);
      queryClient.setQueryData(
        websiteContentQueryKeys.draft(result.draft.contentKey),
        result.draft,
      );
      void Promise.all([
        queryClient.invalidateQueries({ queryKey: websiteContentQueryKeys.overview() }),
        queryClient.invalidateQueries({
          queryKey: websiteContentQueryKeys.draft(result.draft.contentKey),
        }),
        queryClient.invalidateQueries({
          queryKey: websiteContentQueryKeys.diff(result.draft.contentKey),
        }),
        queryClient.invalidateQueries({
          queryKey: ["website-content", result.draft.contentKey, "history"],
        }),
      ]);
    },
  });

  const uploadMediaMutation = useMutation({
    mutationFn: uploadWebsiteMediaAsset,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["website-content", "media-assets"] });
    },
  });

  const archiveMediaMutation = useMutation({
    mutationFn: archiveWebsiteMediaAsset,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["website-content", "media-assets"] });
    },
  });

  const updateState = (updater: (current: DraftEditorState) => DraftEditorState) => {
    setEditorState((current) => (current ? updater(current) : current));
    setDirty(true);
    setValidationError(null);
    setNotice(null);
  };

  const updateSection = (sectionIndex: number, section: WebsiteContentSection) => {
    updateState((current) => ({
      ...current,
      sections: current.sections.map((candidate, index) =>
        index === sectionIndex ? section : candidate,
      ),
    }));
  };

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (
      !editorState?.seo.title.trim() ||
      !editorState.seo.description.trim() ||
      !editorState.changeSummary.trim()
    ) {
      setValidationError("请填写 SEO 标题、SEO 描述和变更摘要后再保存草稿。");

      return;
    }

    if (!event.currentTarget.checkValidity()) {
      setValidationError("请填写所有区块中的必填字段后再保存草稿。");

      return;
    }

    const referenceValidationError = findReferenceValidationError(editorState.sections);

    if (referenceValidationError) {
      setValidationError(referenceValidationError);

      return;
    }

    saveMutation.mutate();
  }

  if (!contentKey) {
    return <PageMessage title="页面内容不存在" message="请从内容列表选择有效的内容单元。" />;
  }

  if (!canReadDraft) {
    return (
      <PageMessage title="没有页面内容编辑权限" message="请联系管理员授予 website.edit 权限。" />
    );
  }

  if (draftQuery.isPending) {
    return (
      <StatePanel
        aria-label="正在加载页面内容草稿"
        className="mx-auto w-full max-w-[1080px]"
        title="正在加载页面内容草稿"
        description="正在读取草稿修订、预设区块和发布历史。"
      />
    );
  }

  if (draftQuery.isError) {
    return (
      <StatePanel
        role="alert"
        tone="danger"
        className="mx-auto w-full max-w-[960px]"
        icon={<AlertCircle aria-hidden="true" className="h-5 w-5" />}
        title="页面内容草稿加载失败"
        description="无法读取当前草稿，请重试后再编辑。"
        action={
          <Button intent="dangerOutline" onClick={() => void draftQuery.refetch()}>
            <RefreshCw aria-hidden="true" className="h-4 w-4" />
            重新加载
          </Button>
        }
      />
    );
  }

  if (!editorState) {
    return (
      <StatePanel
        aria-label="正在加载页面内容草稿"
        className="mx-auto w-full max-w-[1080px]"
        title="正在加载页面内容草稿"
      />
    );
  }

  return (
    <EditorPageLayout
      width="wide"
      title={`编辑 ${MANAGED_CONTENT_LABELS[contentKey]}`}
      description="预设区块编辑：仅可编辑预设区块的内容、有限展示设置和允许的显示状态。保存会创建新的不可变草稿，不会直接发布；预览和发布始终使用最近一次保存的草稿修订版。"
      back={
        <Button asChild intent="ghost">
          <Link to={overviewPath}>
            <ArrowLeft aria-hidden="true" className="h-4 w-4" />
            返回{areaLabel}
          </Link>
        </Button>
      }
      status={
        (dirty && (
          <Badge aria-live="polite" tone="warning">
            <AlertCircle aria-hidden="true" className="h-3.5 w-3.5" />
            有未保存变更
          </Badge>
        )) ||
        (notice && (
          <Badge aria-live="polite" tone="success">
            <CheckCircle2 aria-hidden="true" className="h-3.5 w-3.5" />
            {notice}
          </Badge>
        ))
      }
      actions={
        <>
          <Button asChild intent="secondary">
            <a href="#website-content-history">
              <History aria-hidden="true" className="h-4 w-4" />
              查看历史
            </a>
          </Button>
          <PermissionGate all={["website.edit"]}>
            <Button
              type="button"
              aria-label="preview-saved-draft"
              disabled={dirty || previewMutation.isPending}
              onClick={handlePreview}
              intent="secondary"
            >
              <Eye aria-hidden="true" className="h-4 w-4" />
              预览已保存草稿
            </Button>
          </PermissionGate>
          <PermissionGate all={["website.edit"]}>
            <Button
              type="submit"
              aria-label="顶部保存草稿"
              form="website-content-form"
              disabled={saveMutation.isPending}
              loading={saveMutation.isPending}
            >
              <Save aria-hidden="true" className="h-4 w-4" />
              保存草稿
            </Button>
          </PermissionGate>
        </>
      }
      footerActions={
        canEdit || canPublish ? (
          <>
            <PermissionGate all={["website.edit"]}>
              <Button
                type="submit"
                form="website-content-form"
                disabled={saveMutation.isPending}
                loading={saveMutation.isPending}
              >
                <Save aria-hidden="true" className="h-4 w-4" />
                保存草稿
              </Button>
            </PermissionGate>
            <PermissionGate all={["website.publish"]}>
              <Button
                type="button"
                aria-label="publish-saved-draft"
                disabled={dirty || publishMutation.isPending}
                onClick={() => setPublishDialogOpen(true)}
                intent="secondary"
              >
                <Send aria-hidden="true" className="h-4 w-4" />
                发布已保存草稿
              </Button>
            </PermissionGate>
          </>
        ) : undefined
      }
      unsavedChanges={unsavedChanges}
    >
      {serverRevision !== null ? (
        <div
          role="alert"
          className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-amber-950"
        >
          <h2 className="font-semibold">检测到版本冲突</h2>
          <p className="mt-1">服务端草稿已更新。本地输入仍保留，请根据最新草稿协调后重新保存。</p>
          <p className="mt-2 font-medium">服务端当前修订版：r{serverRevision}</p>
        </div>
      ) : null}
      {validationError ? (
        <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-950">
          {validationError}
        </div>
      ) : null}
      {saveMutation.isError && !isRevisionConflict(saveMutation.error) ? (
        <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-950">
          {errorMessage(saveMutation.error)}
        </div>
      ) : null}

      <form id="website-content-form" className="space-y-6" noValidate onSubmit={submit}>
        <FormSection title="SEO 元数据">
          <div className="grid gap-4">
            <TextField
              label="SEO 标题"
              value={editorState.seo.title}
              required
              disabled={!canEdit}
              onChange={(title) =>
                updateState((current) => ({ ...current, seo: { ...current.seo, title } }))
              }
            />
            <TextField
              label="SEO 描述"
              value={editorState.seo.description}
              required
              multiline
              disabled={!canEdit}
              onChange={(description) =>
                updateState((current) => ({ ...current, seo: { ...current.seo, description } }))
              }
            />
            <TextField
              label="规范路径"
              value={editorState.seo.canonicalPath}
              required
              disabled={!canEdit}
              onChange={(canonicalPath) =>
                updateState((current) => ({
                  ...current,
                  seo: {
                    ...current.seo,
                    canonicalPath: canonicalPath as WebsiteSeoContent["canonicalPath"],
                  },
                }))
              }
            />
            {editorState.seo.image ? (
              <MediaAssetPicker
                label="Open Graph 图片"
                value={editorState.seo.image}
                disabled={!canEdit}
                onChange={(image) =>
                  updateState((current) => ({ ...current, seo: { ...current.seo, image } }))
                }
              />
            ) : null}
          </div>
        </FormSection>

        {editorState.sections.map((section, index) => (
          <WebsiteSectionEditor
            key={section.sectionKey}
            section={section}
            onChange={(nextSection) => updateSection(index, nextSection)}
            canDisable={!REQUIRED_SECTION_KEYS[contentKey].includes(section.sectionKey)}
            disabled={!canEdit}
          />
        ))}

        <FormSection>
          <TextField
            label="变更摘要"
            value={editorState.changeSummary}
            required
            multiline
            disabled={!canEdit}
            onChange={(changeSummary) => updateState((current) => ({ ...current, changeSummary }))}
          />
          <p className="mt-2 text-sm text-slate-500">
            每次保存都必须说明本次不可变草稿的业务变更。
          </p>
        </FormSection>
      </form>

      {previewMutation.isError || publishMutation.isError ? (
        <div aria-live="polite" className="space-y-3">
          {previewMutation.isError ? (
            <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-700">
              无法为当前已保存修订创建预览。
            </p>
          ) : null}
          {publishMutation.isError ? (
            <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-700">
              无法发布当前已保存修订。
            </p>
          ) : null}
        </div>
      ) : null}

      <details
        id="website-content-history"
        aria-label="website-content-history"
        className="group overflow-hidden rounded-xl border border-border bg-surface shadow-panel"
      >
        <summary className="flex cursor-pointer list-none items-center gap-3 px-6 py-5 outline-none hover:bg-surface-subtle focus-visible:ring-2 focus-visible:ring-brand-primary [&::-webkit-details-marker]:hidden">
          <History aria-hidden="true" className="h-5 w-5 text-brand-primary" />
          <span className="min-w-0 flex-1">
            <span className="block font-semibold text-text-primary">已发布历史</span>
            <span className="mt-1 block text-sm text-text-secondary">
              {historyQuery.data?.total ?? 0} 个不可变发布版本
            </span>
          </span>
          <ChevronDown
            aria-hidden="true"
            className="h-5 w-5 text-text-muted transition-transform group-open:rotate-180"
          />
        </summary>
        <div className="border-t border-border p-6">
          <ContentHistory
            contentKey={contentKey}
            items={historyQuery.data?.list ?? []}
            loading={historyQuery.isPending}
            error={historyQuery.isError}
            onRetry={() => void historyQuery.refetch()}
          />
        </div>
      </details>

      <PermissionGate all={["website.edit"]}>
        <details
          aria-label="website-media-library"
          className="group overflow-hidden rounded-xl border border-border bg-surface shadow-panel"
        >
          <summary className="flex cursor-pointer list-none items-center gap-3 px-6 py-5 outline-none hover:bg-surface-subtle focus-visible:ring-2 focus-visible:ring-brand-primary [&::-webkit-details-marker]:hidden">
            <Images aria-hidden="true" className="h-5 w-5 text-brand-primary" />
            <span className="min-w-0 flex-1">
              <span className="block font-semibold text-text-primary">媒体资源库</span>
              <span className="mt-1 block text-sm text-text-secondary">
                {mediaAssetsQuery.data?.total ?? 0} 个当前可选资源
              </span>
            </span>
            <ChevronDown
              aria-hidden="true"
              className="h-5 w-5 text-text-muted transition-transform group-open:rotate-180"
            />
          </summary>
          <div className="border-t border-border p-6">
            <WebsiteMediaLibrary
              assets={mediaAssetsQuery.data?.list ?? []}
              total={mediaAssetsQuery.data?.total ?? 0}
              query={mediaQuery}
              loading={mediaAssetsQuery.isPending}
              error={mediaAssetsQuery.isError}
              pendingAssetId={
                archiveMediaMutation.isPending ? (archiveMediaMutation.variables ?? null) : null
              }
              onQueryChange={setMediaQuery}
              onUpload={async (file) => {
                await uploadMediaMutation.mutateAsync(file);
              }}
              onArchive={async (asset) => {
                await archiveMediaMutation.mutateAsync(asset.id);
              }}
            />
          </div>
        </details>
      </PermissionGate>

      <PermissionGate all={["website.publish"]}>
        <PublishDialog
          open={publishDialogOpen}
          contentKey={contentKey}
          revision={editorState.revision}
          diff={diffQuery.data ?? []}
          diffLoading={diffQuery.isPending}
          diffError={diffQuery.isError}
          pending={publishMutation.isPending}
          canPublish={!dirty}
          onOpenChange={setPublishDialogOpen}
          onRetryDiff={() => void diffQuery.refetch()}
          onPublish={(request) => publishMutation.mutate(request)}
        />
      </PermissionGate>
    </EditorPageLayout>
  );
}

/** Presents a route-level managed-content editor error with a safe return link. */
function PageMessage({ title, message }: { title: string; message: string }) {
  return (
    <section className="mx-auto w-full max-w-[960px] rounded-xl border border-slate-200 bg-white p-6">
      <h1 className="text-xl font-bold text-slate-950">{title}</h1>
      <p className="mt-2 text-slate-600">{message}</p>
      <Link
        to="/website-content"
        className="mt-5 inline-flex h-10 cursor-pointer items-center rounded-lg px-3 font-semibold text-blue-800 outline-none hover:bg-blue-50 focus-visible:ring-2 focus-visible:ring-blue-800"
      >
        返回官网管理
      </Link>
    </section>
  );
}
