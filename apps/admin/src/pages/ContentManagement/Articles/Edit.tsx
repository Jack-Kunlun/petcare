import type { UploadAdminClassroomArticleMediaResponse } from "@petcare/shared-types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { type FormEvent, useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  articleQueryKeys,
  createAdminClassroomArticle,
  fetchAdminClassroomArticle,
  updateAdminClassroomArticle,
  uploadAdminClassroomArticleMedia,
} from "../../../api/content/articles";
import { showApiError } from "../../../lib/global-error";
import { RichTextEditor } from "./RichTextEditor";

/** Creates a classroom article draft or edits an existing draft or offline article. */
export default function ContentArticleEdit() {
  const { id: articleId } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const initializedId = useRef<string | null>(null);
  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const [bodyHtml, setBodyHtml] = useState("");
  const [coverUrl, setCoverUrl] = useState<string | null>(null);
  const [coverAssetId, setCoverAssetId] = useState<string | null | undefined>(undefined);
  const [titleError, setTitleError] = useState<string | null>(null);
  const [summaryError, setSummaryError] = useState<string | null>(null);
  const [pendingUploadCount, setPendingUploadCount] = useState(0);

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
      await queryClient.invalidateQueries({ queryKey: articleQueryKeys.all });
      queryClient.setQueryData(articleQueryKeys.detail(saved.id), saved);

      if (!articleId) {
        navigate(`/content/articles/${saved.id}/edit`, { replace: true });
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
  }, [articleQuery.data]);

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

  return (
    <section className="mx-auto w-full max-w-[896px]">
      <Link
        to="/content/articles"
        className="inline-flex min-h-10 items-center rounded-md px-2 font-medium text-blue-800 hover:bg-blue-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-800"
      >
        返回文章列表
      </Link>
      <h1 className="mt-4 text-2xl font-bold text-slate-950">
        {articleId ? "编辑课堂文章" : "新建课堂文章"}
      </h1>
      <form className="mt-6 space-y-5" noValidate onSubmit={submitForm}>
        <div>
          <label htmlFor="article-title" className="font-medium text-slate-900">
            标题
          </label>
          <input
            id="article-title"
            value={title}
            maxLength={120}
            disabled={isLocked}
            aria-invalid={Boolean(titleError)}
            aria-describedby={titleError ? "article-title-error" : undefined}
            onChange={(event) => {
              setTitle(event.target.value);
              setTitleError(null);
            }}
            className="mt-2 min-h-10 w-full rounded-md border border-slate-300 px-3 disabled:cursor-not-allowed disabled:bg-slate-100"
          />
          {titleError ? (
            <p id="article-title-error" className="mt-1 text-sm text-red-700">
              {titleError}
            </p>
          ) : null}
        </div>
        <div>
          <label htmlFor="article-summary" className="font-medium text-slate-900">
            摘要
          </label>
          <textarea
            id="article-summary"
            value={summary}
            maxLength={500}
            disabled={isLocked}
            aria-invalid={Boolean(summaryError)}
            aria-describedby={summaryError ? "article-summary-error" : undefined}
            onChange={(event) => {
              setSummary(event.target.value);
              setSummaryError(null);
            }}
            className="mt-2 min-h-28 w-full rounded-md border border-slate-300 px-3 py-2 disabled:cursor-not-allowed disabled:bg-slate-100"
          />
          {summaryError ? (
            <p id="article-summary-error" className="mt-1 text-sm text-red-700">
              {summaryError}
            </p>
          ) : null}
        </div>
        <div>
          <label htmlFor="article-cover" className="font-medium text-slate-900">
            上传封面
          </label>
          <input
            id="article-cover"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            disabled={isLocked}
            className="mt-2 block cursor-pointer disabled:cursor-not-allowed"
            onChange={(event) => {
              const file = event.currentTarget.files?.[0];

              event.currentTarget.value = "";

              if (file) {
                void uploadCover(file);
              }
            }}
          />
          {coverUrl ? (
            <img src={coverUrl} alt="文章封面预览" className="mt-3 max-h-64 rounded-md" />
          ) : null}
          {coverUrl ? (
            <button
              type="button"
              disabled={isLocked}
              onClick={() => {
                setCoverAssetId(null);
                setCoverUrl(null);
              }}
              className="mt-3 min-h-10 cursor-pointer rounded-md border border-slate-300 px-3 font-medium hover:bg-slate-50 disabled:cursor-not-allowed disabled:bg-slate-100"
            >
              移除封面
            </button>
          ) : null}
        </div>
        <RichTextEditor
          value={bodyHtml}
          disabled={isLocked}
          onChange={setBodyHtml}
          onUpload={uploadMedia}
        />
        <button
          type="submit"
          disabled={isLocked}
          className="min-h-10 cursor-pointer rounded-md bg-blue-800 px-4 font-semibold text-white hover:bg-blue-900 disabled:cursor-not-allowed disabled:bg-slate-400"
        >
          {articleId ? "保存修改" : "保存草稿"}
        </button>
      </form>
    </section>
  );
}
