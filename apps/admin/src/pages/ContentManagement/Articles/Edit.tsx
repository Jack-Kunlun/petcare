import type { UploadAdminClassroomArticleMediaResponse } from "@petcare/shared-types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, ImagePlus, Trash2 } from "lucide-react";
import {
  type DragEvent,
  type FormEvent,
  type KeyboardEvent,
  useEffect,
  useRef,
  useState,
} from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  articleQueryKeys,
  createAdminClassroomArticle,
  fetchAdminClassroomArticle,
  updateAdminClassroomArticle,
  uploadAdminClassroomArticleMedia,
} from "../../../api/content/articles";
import { EditorPageLayout, FormSection } from "../../../components/EditorPageLayout";
import { useUnsavedChanges } from "../../../hooks/useUnsavedChanges";
import { showApiError } from "../../../lib/global-error";
import { RichTextEditor } from "./RichTextEditor";

/** Creates a classroom article draft or edits an existing draft or offline article. */
export default function ContentArticleEdit() {
  const { id: articleId } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const initializedId = useRef<string | null>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);
  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const [bodyHtml, setBodyHtml] = useState("");
  const [coverUrl, setCoverUrl] = useState<string | null>(null);
  const [coverAssetId, setCoverAssetId] = useState<string | null | undefined>(undefined);
  const [titleError, setTitleError] = useState<string | null>(null);
  const [summaryError, setSummaryError] = useState<string | null>(null);
  const [pendingUploadCount, setPendingUploadCount] = useState(0);
  const [dirty, setDirty] = useState(false);
  const [saveNotice, setSaveNotice] = useState<string | null>(null);
  const [createdArticleId, setCreatedArticleId] = useState<string | null>(null);
  const unsavedChanges = useUnsavedChanges(dirty);

  const articleQuery = useQuery({
    queryKey: articleQueryKeys.detail(articleId ?? "new"),
    queryFn: () => fetchAdminClassroomArticle(articleId!),
    enabled: Boolean(articleId),
  });
  const mediaUploading = pendingUploadCount > 0;
  const saveMutation = useMutation({
    mutationFn: () => {
      if (!articleId) {
        return createAdminClassroomArticle({
          title: title.trim(),
          summary: summary.trim(),
          bodyHtml,
          coverAssetId,
        });
      }

      return updateAdminClassroomArticle(articleId, {
        title: title.trim(),
        summary: summary.trim(),
        bodyHtml,
        coverAssetId,
        expectedUpdatedAt: articleQuery.data!.updatedAt,
      });
    },
    onSuccess: async (saved) => {
      setDirty(false);
      setSaveNotice(articleId ? "修改已保存" : "草稿已保存");
      await queryClient.invalidateQueries({ queryKey: articleQueryKeys.all });
      queryClient.setQueryData(articleQueryKeys.detail(saved.id), saved);

      if (!articleId) {
        setCreatedArticleId(saved.id);
      }
    },
  });

  useEffect(() => {
    const article = articleQuery.data;

    if (!article || initializedId.current === article.id) {
      return;
    }

    initializedId.current = article.id;
    setTitle(article.title);
    setSummary(article.summary);
    setBodyHtml(article.bodyHtml);
    setCoverUrl(article.coverUrl);
    setCoverAssetId(undefined);
    setDirty(false);
  }, [articleQuery.data]);

  useEffect(() => {
    if (createdArticleId && !dirty) {
      navigate(`/content/articles/${createdArticleId}/edit`, { replace: true });
    }
  }, [createdArticleId, dirty, navigate]);

  function markDirty(): void {
    setDirty(true);
    setSaveNotice(null);
  }

  async function uploadMedia(file: File): Promise<UploadAdminClassroomArticleMediaResponse> {
    setPendingUploadCount((count) => count + 1);

    try {
      return await uploadAdminClassroomArticleMedia(file);
    } finally {
      setPendingUploadCount((count) => count - 1);
    }
  }

  async function uploadCover(file: File): Promise<void> {
    try {
      const asset = await uploadMedia(file);

      setCoverAssetId(asset.id);
      setCoverUrl(asset.url);
      markDirty();
    } catch (error) {
      showApiError(error);
    }
  }

  function submitForm(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    const nextTitleError = title.trim() ? null : "标题不能为空";
    const nextSummaryError = summary.trim() ? null : "摘要不能为空";

    setTitleError(nextTitleError);
    setSummaryError(nextSummaryError);

    if (nextTitleError || nextSummaryError) {
      return;
    }

    saveMutation.mutate();
  }

  function handleCoverDrop(event: DragEvent<HTMLElement>): void {
    event.preventDefault();

    if (saveMutation.isPending || mediaUploading) {
      return;
    }

    const file = event.dataTransfer.files[0];

    if (file) {
      void uploadCover(file);
    }
  }

  function handleCoverKeyDown(event: KeyboardEvent<HTMLLabelElement>): void {
    if (
      (event.key === "Enter" || event.key === " ") &&
      !saveMutation.isPending &&
      !mediaUploading
    ) {
      event.preventDefault();
      coverInputRef.current?.click();
    }
  }

  if (articleId && articleQuery.isPending) {
    return <p aria-live="polite">正在加载文章…</p>;
  }

  if (articleId && articleQuery.isError) {
    return (
      <section role="alert">
        <p>文章加载失败，请重试后再编辑。</p>
        <button
          type="button"
          onClick={() => void articleQuery.refetch()}
          className="min-h-10 cursor-pointer rounded-md border border-slate-300 px-3 font-medium hover:bg-slate-50"
        >
          重新加载
        </button>
      </section>
    );
  }

  if (articleQuery.data?.status === "published") {
    return (
      <section role="alert">
        <p>已发布文章需先下线后编辑。</p>
        <Link to="/content/articles">返回文章列表</Link>
      </section>
    );
  }

  if (articleId && !articleQuery.data) {
    return <p aria-live="polite">正在加载文章…</p>;
  }

  const isLocked = saveMutation.isPending || mediaUploading;
  const statusLabel = articleQuery.data?.status === "offline" ? "已下线" : "草稿";

  return (
    <EditorPageLayout
      width="default"
      title={articleId ? "编辑文章" : "新建文章"}
      description="创建宠物护理知识内容并发布至 PetCare 课堂。"
      back={
        <Link
          to="/content/articles"
          className="inline-flex h-10 cursor-pointer items-center gap-1 rounded-md px-2 text-sm font-medium text-blue-700 outline-none hover:text-blue-900 focus-visible:ring-2 focus-visible:ring-blue-700"
        >
          <ArrowLeft aria-hidden="true" className="h-4 w-4" />
          返回文章列表
        </Link>
      }
      status={
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">
            {statusLabel}
          </span>
          <span aria-live="polite" className="text-sm font-medium">
            {dirty ? (
              <span className="inline-flex items-center gap-1.5 text-amber-700">
                <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-current" />
                <span>有未保存修改</span>
              </span>
            ) : saveNotice ? (
              <span className="text-emerald-700">{saveNotice}</span>
            ) : null}
          </span>
        </div>
      }
      actions={
        <>
          <Link
            to="/content/articles"
            className="inline-flex h-10 cursor-pointer items-center justify-center rounded-lg border border-border bg-white px-4 font-semibold text-slate-700 outline-none transition-colors hover:bg-slate-50 focus-visible:ring-2 focus-visible:ring-blue-700"
          >
            取消
          </Link>
          <button
            type="submit"
            form="article-form"
            disabled={isLocked}
            className="inline-flex h-10 cursor-pointer items-center justify-center rounded-lg bg-blue-700 px-4 font-semibold text-white outline-none transition-colors hover:bg-blue-800 focus-visible:ring-2 focus-visible:ring-blue-700 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:bg-slate-400"
          >
            {articleId ? "保存修改" : "保存草稿"}
          </button>
        </>
      }
      unsavedChanges={unsavedChanges}
    >
      <form id="article-form" className="space-y-6" noValidate onSubmit={submitForm}>
        <FormSection
          title="基础信息"
          description="设置文章标题、摘要和列表封面。"
          className="space-y-6"
        >
          <div>
            <label htmlFor="article-title" className="font-medium text-slate-900">
              标题{" "}
              <span aria-hidden="true" className="text-red-600">
                *
              </span>
            </label>
            <input
              id="article-title"
              aria-label="标题"
              value={title}
              maxLength={120}
              placeholder="请输入文章标题"
              disabled={isLocked}
              aria-invalid={Boolean(titleError)}
              aria-describedby={`${titleError ? "article-title-error " : ""}article-title-count`}
              onChange={(event) => {
                setTitle(event.target.value);
                setTitleError(null);
                markDirty();
              }}
              className="mt-2 h-10 w-full rounded-lg border border-border bg-white px-3 text-slate-900 outline-none transition-colors placeholder:text-slate-400 hover:border-blue-400 focus-visible:border-blue-700 focus-visible:ring-2 focus-visible:ring-blue-700/15 disabled:cursor-not-allowed disabled:bg-slate-100"
            />
            <div className="mt-1 flex min-h-5 items-start justify-between gap-3 text-sm">
              {titleError ? (
                <p id="article-title-error" className="text-red-700">
                  {titleError}
                </p>
              ) : (
                <span />
              )}
              <span id="article-title-count" className="shrink-0 text-slate-400">
                {title.length} / 120
              </span>
            </div>
          </div>

          <div>
            <label htmlFor="article-summary" className="font-medium text-slate-900">
              摘要{" "}
              <span aria-hidden="true" className="text-red-600">
                *
              </span>
            </label>
            <textarea
              id="article-summary"
              aria-label="摘要"
              value={summary}
              maxLength={500}
              placeholder="请输入文章摘要，用于文章列表和分享场景展示"
              disabled={isLocked}
              aria-invalid={Boolean(summaryError)}
              aria-describedby={`${summaryError ? "article-summary-error " : ""}article-summary-count`}
              onChange={(event) => {
                setSummary(event.target.value);
                setSummaryError(null);
                markDirty();
              }}
              className="mt-2 min-h-28 w-full resize-y rounded-lg border border-border bg-white px-3 py-2 text-slate-900 outline-none transition-colors placeholder:text-slate-400 hover:border-blue-400 focus-visible:border-blue-700 focus-visible:ring-2 focus-visible:ring-blue-700/15 disabled:cursor-not-allowed disabled:bg-slate-100"
            />
            <div className="mt-1 flex min-h-5 items-start justify-between gap-3 text-sm">
              {summaryError ? (
                <p id="article-summary-error" className="text-red-700">
                  {summaryError}
                </p>
              ) : (
                <span />
              )}
              <span id="article-summary-count" className="shrink-0 text-slate-400">
                {summary.length} / 500
              </span>
            </div>
          </div>

          <div>
            <p className="font-medium text-slate-900">封面</p>
            <input
              ref={coverInputRef}
              id="article-cover"
              type="file"
              aria-label="上传封面"
              accept="image/jpeg,image/png,image/webp"
              disabled={isLocked}
              className="sr-only"
              onChange={(event) => {
                const file = event.currentTarget.files?.[0];

                event.currentTarget.value = "";

                if (file) {
                  void uploadCover(file);
                }
              }}
            />
            {coverUrl ? (
              <div
                className="relative mt-2 aspect-video w-full max-w-96 overflow-hidden rounded-xl border border-border bg-slate-100"
                onDragOver={(event) => event.preventDefault()}
                onDrop={handleCoverDrop}
              >
                <img src={coverUrl} alt="文章封面预览" className="h-full w-full object-cover" />
                <div className="absolute inset-x-0 bottom-0 flex items-center justify-end gap-2 bg-slate-950/65 p-3">
                  <label
                    htmlFor="article-cover"
                    role="button"
                    aria-label="更换文章封面"
                    aria-disabled={isLocked}
                    tabIndex={isLocked ? -1 : 0}
                    onKeyDown={handleCoverKeyDown}
                    className={`inline-flex h-9 items-center rounded-lg bg-white px-3 text-sm font-semibold text-slate-800 ${
                      isLocked
                        ? "cursor-not-allowed opacity-60"
                        : "cursor-pointer hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                    }`}
                  >
                    更换封面
                  </label>
                  <button
                    type="button"
                    aria-label="移除封面"
                    disabled={isLocked}
                    onClick={() => {
                      setCoverAssetId(null);
                      setCoverUrl(null);
                      markDirty();
                    }}
                    className="inline-flex h-9 cursor-pointer items-center gap-1 rounded-lg bg-white px-3 text-sm font-semibold text-red-700 outline-none hover:bg-red-50 focus-visible:ring-2 focus-visible:ring-red-600 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <Trash2 aria-hidden="true" className="h-4 w-4" />
                    删除
                  </button>
                </div>
              </div>
            ) : (
              <label
                htmlFor="article-cover"
                role="button"
                aria-label="上传文章封面"
                aria-disabled={isLocked}
                tabIndex={isLocked ? -1 : 0}
                onKeyDown={handleCoverKeyDown}
                onDragOver={(event) => event.preventDefault()}
                onDrop={handleCoverDrop}
                className={`mt-2 flex aspect-video w-full max-w-96 flex-col items-center justify-center rounded-xl border border-dashed bg-slate-50 px-6 text-center outline-none transition-colors ${
                  isLocked
                    ? "cursor-not-allowed border-slate-200 text-slate-400"
                    : "cursor-pointer border-slate-300 text-slate-600 hover:border-blue-500 hover:bg-blue-50/50 focus-visible:border-blue-700 focus-visible:ring-2 focus-visible:ring-blue-700/15"
                }`}
              >
                <ImagePlus aria-hidden="true" className="h-7 w-7" />
                <span className="mt-3 font-semibold text-slate-800">上传文章封面</span>
                <span className="mt-1 text-sm">点击或拖拽图片到此区域</span>
                <span className="mt-2 text-xs text-slate-400">推荐比例 16:9，JPG / PNG / WebP</span>
              </label>
            )}
            {mediaUploading ? (
              <p aria-live="polite" className="mt-2 text-sm text-blue-700">
                正在上传封面…
              </p>
            ) : null}
          </div>
        </FormSection>

        <FormSection title="文章正文" description="使用标题、列表与图片组织正文内容。">
          <RichTextEditor
            value={bodyHtml}
            disabled={isLocked}
            onChange={(value) => {
              setBodyHtml(value);
              markDirty();
            }}
            onUpload={uploadMedia}
          />
        </FormSection>
      </form>
    </EditorPageLayout>
  );
}
