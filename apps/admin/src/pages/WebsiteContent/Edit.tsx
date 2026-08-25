import {
  WEBSITE_CONTENT_KEY,
  type ApiErrorResponse,
  type WebsiteContentKey,
  type WebsiteContentSection,
  type WebsiteContentVersion,
  type WebsiteMediaListQuery,
  type WebsiteSeoContent,
} from "@petcare/shared-types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { AlertCircle, ArrowLeft, CheckCircle2, RefreshCw, Save } from "lucide-react";
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
import { useUnsavedChanges } from "../../hooks/useUnsavedChanges";
import { ContentHistory } from "./ContentHistory";
import { TextField } from "./editors/fields";
import { WebsiteSectionEditor } from "./editors/WebsiteSectionEditor";
import { MediaAssetPicker } from "./MediaAssetPicker";
import { PublishDialog } from "./PublishDialog";
import { WebsiteMediaLibrary } from "./WebsiteMediaLibrary";

const WEBSITE_CONTENT_KEYS = new Set<WebsiteContentKey>(Object.values(WEBSITE_CONTENT_KEY));

const REQUIRED_SECTION_KEYS: Record<WebsiteContentKey, readonly string[]> = {
  site_shell: ["site_header", "site_footer"],
  home: ["hero", "home_experience"],
  services: ["hero"],
  trust: ["hero"],
  companions: ["hero"],
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

function isWebsiteContentKey(value: string | undefined): value is WebsiteContentKey {
  return value !== undefined && WEBSITE_CONTENT_KEYS.has(value as WebsiteContentKey);
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
  const contentKey = isWebsiteContentKey(contentKeyParam) ? contentKeyParam : null;
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
        throw new Error("官网内容草稿不可用");
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
    return <PageMessage title="官网内容不存在" message="请从官网内容列表选择有效的内容单元。" />;
  }

  if (!canReadDraft) {
    return (
      <PageMessage title="没有官网内容编辑权限" message="请联系管理员授予 website.edit 权限。" />
    );
  }

  if (draftQuery.isPending) {
    return (
      <section
        aria-label="正在加载官网内容草稿"
        className="mx-auto h-96 w-full max-w-[1080px] animate-pulse rounded-xl bg-slate-200 motion-reduce:animate-none"
      />
    );
  }

  if (draftQuery.isError) {
    return (
      <section
        role="alert"
        className="mx-auto w-full max-w-[960px] rounded-xl border border-red-200 bg-red-50 p-6 text-red-950"
      >
        <h1 className="font-bold">官网内容草稿加载失败</h1>
        <p className="mt-2">无法读取当前草稿，请重试后再编辑。</p>
        <button
          type="button"
          onClick={() => void draftQuery.refetch()}
          className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-lg border border-red-700 px-4 font-semibold outline-none hover:bg-red-100 focus-visible:ring-2 focus-visible:ring-red-700"
        >
          <RefreshCw aria-hidden="true" className="h-4 w-4" />
          重新加载
        </button>
      </section>
    );
  }

  if (!editorState) {
    return (
      <section
        aria-label="正在加载官网内容草稿"
        className="mx-auto h-96 w-full max-w-[1080px] animate-pulse rounded-xl bg-slate-200 motion-reduce:animate-none"
      />
    );
  }

  return (
    <EditorPageLayout
      width="default"
      title={`编辑 ${contentKey}`}
      description="预设区块编辑：仅可编辑预设区块的内容、有限展示设置和允许的显示状态。保存会创建新的不可变草稿，不会直接发布。"
      back={
        <Link
          to="/website-content"
          className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-lg px-2 font-medium text-blue-800 outline-none hover:bg-blue-50 focus-visible:ring-2 focus-visible:ring-blue-800"
        >
          <ArrowLeft aria-hidden="true" className="h-4 w-4" />
          返回官网内容
        </Link>
      }
      status={
        dirty ? (
          <span
            aria-live="polite"
            className="inline-flex items-center gap-2 text-sm font-medium text-amber-800"
          >
            <AlertCircle aria-hidden="true" className="h-4 w-4" />
            有未保存变更
          </span>
        ) : notice ? (
          <span
            aria-live="polite"
            className="inline-flex items-center gap-2 text-sm font-medium text-emerald-800"
          >
            <CheckCircle2 aria-hidden="true" className="h-4 w-4" />
            {notice}
          </span>
        ) : null
      }
      actions={
        <>
          <a
            href="#website-content-history"
            className="inline-flex h-10 cursor-pointer items-center justify-center rounded-lg border border-slate-300 bg-white px-4 font-semibold text-slate-700 outline-none transition-colors hover:bg-slate-50 focus-visible:ring-2 focus-visible:ring-blue-800"
          >
            查看历史
          </a>
          <PermissionGate all={["website.edit"]}>
            <button
              type="button"
              aria-label="preview-saved-draft"
              disabled={dirty || previewMutation.isPending}
              onClick={handlePreview}
              className="inline-flex h-10 cursor-pointer items-center justify-center rounded-lg border border-blue-700 px-4 font-semibold text-blue-800 outline-none hover:bg-blue-50 focus-visible:ring-2 focus-visible:ring-blue-800 disabled:cursor-not-allowed disabled:opacity-40"
            >
              预览已保存草稿
            </button>
          </PermissionGate>
          <PermissionGate all={["website.edit"]}>
            <button
              type="submit"
              form="website-content-form"
              disabled={saveMutation.isPending}
              className="inline-flex h-10 cursor-pointer items-center justify-center gap-2 rounded-lg bg-blue-700 px-4 font-semibold text-white outline-none transition-colors hover:bg-blue-800 focus-visible:ring-2 focus-visible:ring-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Save aria-hidden="true" className="h-4 w-4" />
              保存草稿
            </button>
          </PermissionGate>
          <PermissionGate all={["website.publish"]}>
            <button
              type="button"
              aria-label="publish-saved-draft"
              disabled={dirty || publishMutation.isPending}
              onClick={() => setPublishDialogOpen(true)}
              className="inline-flex h-10 cursor-pointer items-center justify-center rounded-lg bg-red-700 px-4 font-semibold text-white outline-none hover:bg-red-800 focus-visible:ring-2 focus-visible:ring-red-700 disabled:cursor-not-allowed disabled:opacity-40"
            >
              发布已保存草稿
            </button>
          </PermissionGate>
        </>
      }
      unsavedChanges={unsavedChanges}
    >
      {serverRevision !== null ? (
        <div
          role="alert"
          className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-4 text-amber-950"
        >
          <h2 className="font-semibold">检测到版本冲突</h2>
          <p className="mt-1">服务端草稿已更新。本地输入仍保留，请根据最新草稿协调后重新保存。</p>
          <p className="mt-2 font-medium">服务端当前修订版：r{serverRevision}</p>
        </div>
      ) : null}
      {validationError ? (
        <div
          role="alert"
          className="mt-5 rounded-xl border border-red-200 bg-red-50 p-4 text-red-950"
        >
          {validationError}
        </div>
      ) : null}
      {saveMutation.isError && !isRevisionConflict(saveMutation.error) ? (
        <div
          role="alert"
          className="mt-5 rounded-xl border border-red-200 bg-red-50 p-4 text-red-950"
        >
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

        <PermissionGate all={["website.edit"]}>
          <button
            type="submit"
            disabled={saveMutation.isPending}
            className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-lg bg-blue-700 px-5 font-semibold text-white outline-none transition-colors hover:bg-blue-800 focus-visible:ring-2 focus-visible:ring-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Save aria-hidden="true" className="h-4 w-4" />
            保存草稿
          </button>
        </PermissionGate>
      </form>

      <FormSection
        title="预览与发布"
        description="预览和发布始终使用最近一次保存的不可变草稿修订版。"
      >
        <div className="flex flex-wrap gap-3">
          <PermissionGate all={["website.edit"]}>
            <button
              type="button"
              aria-label="preview-saved-draft"
              disabled={dirty || previewMutation.isPending}
              onClick={handlePreview}
              className="h-10 cursor-pointer rounded-lg border border-blue-700 px-4 font-semibold text-blue-800 outline-none hover:bg-blue-50 focus-visible:ring-2 focus-visible:ring-blue-800 disabled:cursor-not-allowed disabled:opacity-40"
            >
              预览已保存草稿
            </button>
          </PermissionGate>
          <PermissionGate all={["website.publish"]}>
            <button
              type="button"
              aria-label="publish-saved-draft"
              disabled={dirty || publishMutation.isPending}
              onClick={() => setPublishDialogOpen(true)}
              className="h-10 cursor-pointer rounded-lg bg-red-700 px-4 font-semibold text-white outline-none hover:bg-red-800 focus-visible:ring-2 focus-visible:ring-red-700 disabled:cursor-not-allowed disabled:opacity-40"
            >
              发布已保存草稿
            </button>
          </PermissionGate>
        </div>
        {dirty ? (
          <p className="mt-3 text-sm text-amber-800">请先保存当前变更，再预览或发布。</p>
        ) : null}
        {previewMutation.isError ? (
          <p role="alert" className="mt-3 text-sm text-red-700">
            无法为当前已保存修订创建预览。
          </p>
        ) : null}
        {publishMutation.isError ? (
          <p role="alert" className="mt-3 text-sm text-red-700">
            无法发布当前已保存修订。
          </p>
        ) : null}
      </FormSection>

      <section id="website-content-history" aria-label="website-content-history">
        <FormSection title="已发布历史">
          <ContentHistory
            contentKey={contentKey}
            items={historyQuery.data?.list ?? []}
            loading={historyQuery.isPending}
            error={historyQuery.isError}
            onRetry={() => void historyQuery.refetch()}
          />
        </FormSection>
      </section>

      <PermissionGate all={["website.edit"]}>
        <div aria-label="website-media-library" className="mt-6">
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

/** Presents a route-level Website Content editor error with a safe return link. */
function PageMessage({ title, message }: { title: string; message: string }) {
  return (
    <section className="mx-auto w-full max-w-[960px] rounded-xl border border-slate-200 bg-white p-6">
      <h1 className="text-xl font-bold text-slate-950">{title}</h1>
      <p className="mt-2 text-slate-600">{message}</p>
      <Link
        to="/website-content"
        className="mt-5 inline-flex min-h-11 items-center rounded-lg px-3 font-semibold text-blue-800 outline-none hover:bg-blue-50 focus-visible:ring-2 focus-visible:ring-blue-800"
      >
        返回官网内容
      </Link>
    </section>
  );
}
