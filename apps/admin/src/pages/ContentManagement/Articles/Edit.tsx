import {
  CLASSROOM_ARTICLE_CATEGORY,
  CLASSROOM_ARTICLE_CATEGORY_LABELS,
  type ClassroomArticleCategory,
  type UploadAdminClassroomArticleMediaResponse,
} from "@petcare/shared-types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertCircle, ArrowLeft, ImagePlus, RefreshCw, Trash2 } from "lucide-react";
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
import { Badge, Button, Input, Select, StatePanel, Textarea } from "../../../components/ui";
import { useUnsavedChanges } from "../../../hooks/useUnsavedChanges";
import { showApiError } from "../../../lib/global-error";
import { RichTextEditor } from "./RichTextEditor";

const categoryOptions = Object.values(CLASSROOM_ARTICLE_CATEGORY).map((value) => ({
  value,
  label: CLASSROOM_ARTICLE_CATEGORY_LABELS[value],
}));

/** Creates a classroom article draft or edits an existing draft or offline article. */
export default function ContentArticleEdit() {
  const { id: articleId } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const initializedId = useRef<string | null>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);
  const [category, setCategory] = useState<ClassroomArticleCategory | "">("");
  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const [bodyHtml, setBodyHtml] = useState("");
  const [coverUrl, setCoverUrl] = useState<string | null>(null);
  const [coverAssetId, setCoverAssetId] = useState<string | null | undefined>(undefined);
  const [categoryError, setCategoryError] = useState<string | null>(null);
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
      if (!category) {
        throw new Error("文章分类不能为空");
      }

      if (!articleId) {
        return createAdminClassroomArticle({
          category,
          title: title.trim(),
          summary: summary.trim(),
          bodyHtml,
          coverAssetId,
        });
      }

      return updateAdminClassroomArticle(articleId, {
        category,
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
    setCategory(article.category ?? "");
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
    const nextCategoryError = category ? null : "请选择文章分类";
    const nextTitleError = title.trim() ? null : "标题不能为空";
    const nextSummaryError = summary.trim() ? null : "摘要不能为空";

    setCategoryError(nextCategoryError);
    setTitleError(nextTitleError);
    setSummaryError(nextSummaryError);

    if (nextCategoryError || nextTitleError || nextSummaryError) {
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
    return (
      <StatePanel
        aria-live="polite"
        className="mx-auto w-full max-w-[var(--editor-width-default)]"
        title="正在加载文章…"
        description="正在读取文章内容和编辑状态，请稍候。"
      />
    );
  }

  if (articleId && articleQuery.isError) {
    return (
      <StatePanel
        role="alert"
        tone="danger"
        className="mx-auto w-full max-w-[var(--editor-width-default)]"
        icon={<AlertCircle aria-hidden="true" className="h-5 w-5" />}
        title="文章加载失败"
        description="请检查服务连接后重试，加载成功前不会展示空白编辑表单。"
        action={
          <Button intent="dangerOutline" onClick={() => void articleQuery.refetch()}>
            <RefreshCw aria-hidden="true" className="h-4 w-4" />
            重新加载
          </Button>
        }
      />
    );
  }

  if (articleQuery.data?.status === "published") {
    return (
      <StatePanel
        role="alert"
        className="mx-auto w-full max-w-[var(--editor-width-default)]"
        title="已发布文章暂不可编辑"
        description="已发布文章需先下线后编辑，以免绕过现有发布流程。"
        action={
          <Button asChild intent="secondary">
            <Link to="/content/articles">返回文章列表</Link>
          </Button>
        }
      />
    );
  }

  if (articleId && !articleQuery.data) {
    return (
      <StatePanel
        aria-live="polite"
        className="mx-auto w-full max-w-[var(--editor-width-default)]"
        title="正在加载文章…"
      />
    );
  }

  const isLocked = saveMutation.isPending || mediaUploading;
  const statusLabel = articleQuery.data?.status === "offline" ? "已下线" : "草稿";

  return (
    <EditorPageLayout
      width="wide"
      title={articleId ? "编辑文章" : "新建文章"}
      description="创建宠物护理知识内容并发布至 PetCare 课堂。"
      back={
        <Button asChild intent="ghost">
          <Link to="/content/articles">
            <ArrowLeft aria-hidden="true" className="h-4 w-4" />
            返回文章列表
          </Link>
        </Button>
      }
      status={
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={articleQuery.data?.status === "offline" ? "warning" : "neutral"}>
            {statusLabel}
          </Badge>
          <span aria-live="polite" className="text-sm font-medium">
            {dirty ? (
              <span className="inline-flex items-center gap-1.5 text-amber-700">
                <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-current" />
                <span>有未保存修改</span>
              </span>
            ) : null}
            {!dirty && saveNotice ? <span className="text-emerald-700">{saveNotice}</span> : null}
          </span>
        </div>
      }
      actions={
        <>
          <Button asChild intent="secondary">
            <Link to="/content/articles">取消</Link>
          </Button>
          <Button
            type="submit"
            form="article-form"
            disabled={isLocked}
            loading={saveMutation.isPending}
          >
            {articleId ? "保存修改" : "保存草稿"}
          </Button>
        </>
      }
      unsavedChanges={unsavedChanges}
    >
      <form id="article-form" className="space-y-6" noValidate onSubmit={submitForm}>
        {saveMutation.isError ? (
          <div
            role="alert"
            className="rounded-xl border border-danger-border bg-danger-soft p-4 text-sm text-danger-strong"
          >
            保存文章失败，请检查内容或服务状态后重试。
          </div>
        ) : null}

        <FormSection title="基础信息" description="设置文章标题、摘要和列表封面。">
          <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
            <div className="space-y-5">
              <div>
                <label htmlFor="article-category" className="font-medium text-slate-900">
                  分类{" "}
                  <span aria-hidden="true" className="text-red-600">
                    *
                  </span>
                </label>
                <Select
                  id="article-category"
                  aria-label="分类"
                  value={category}
                  disabled={isLocked}
                  aria-invalid={Boolean(categoryError)}
                  aria-describedby={categoryError ? "article-category-error" : undefined}
                  onChange={(event) => {
                    setCategory(event.target.value as ClassroomArticleCategory);
                    setCategoryError(null);
                    markDirty();
                  }}
                  className="mt-2"
                >
                  <option value="" disabled>
                    请选择文章分类
                  </option>
                  {categoryOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </Select>
                {categoryError ? (
                  <p id="article-category-error" className="mt-1 text-sm text-red-700">
                    {categoryError}
                  </p>
                ) : null}
              </div>

              <div>
                <label htmlFor="article-title" className="font-medium text-slate-900">
                  标题{" "}
                  <span aria-hidden="true" className="text-red-600">
                    *
                  </span>
                </label>
                <Input
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
                  className="mt-2"
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
                <Textarea
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
                  className="mt-2"
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
            </div>

            <aside className="rounded-xl border border-border bg-surface-subtle p-4">
              <p className="font-medium text-text-primary">列表封面</p>
              <p className="mt-1 text-xs leading-5 text-text-secondary">
                推荐 16:9，图片将在文章列表与分享场景中展示。
              </p>
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
                  className="relative mt-3 aspect-video w-full overflow-hidden rounded-xl border border-border bg-surface-muted"
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
                      className={`inline-flex h-10 items-center rounded-lg bg-white px-3 text-sm font-semibold text-slate-800 ${
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
                      className="inline-flex h-10 cursor-pointer items-center gap-1 rounded-lg bg-white px-3 text-sm font-semibold text-red-700 outline-none hover:bg-red-50 focus-visible:ring-2 focus-visible:ring-red-600 disabled:cursor-not-allowed disabled:opacity-60"
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
                  className={`mt-3 flex aspect-video w-full flex-col items-center justify-center rounded-xl border border-dashed bg-surface px-6 text-center outline-none transition-colors ${
                    isLocked
                      ? "cursor-not-allowed border-slate-200 text-slate-400"
                      : "cursor-pointer border-slate-300 text-slate-600 hover:border-blue-500 hover:bg-blue-50/50 focus-visible:border-blue-700 focus-visible:ring-2 focus-visible:ring-blue-700/15"
                  }`}
                >
                  <ImagePlus aria-hidden="true" className="h-7 w-7" />
                  <span className="mt-3 font-semibold text-slate-800">上传文章封面</span>
                  <span className="mt-1 text-sm">点击或拖拽图片到此区域</span>
                  <span className="mt-2 text-xs text-slate-400">
                    推荐比例 16:9，JPG / PNG / WebP
                  </span>
                </label>
              )}
              {mediaUploading ? (
                <p aria-live="polite" className="mt-2 text-sm text-blue-700">
                  正在上传封面…
                </p>
              ) : null}
            </aside>
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
