import {
  COMMUNITY_POST_REPORT_REASON_LABELS,
  type AdminContentPostStatus,
  type ApiErrorResponse,
  type CommunityPostCommentStatus,
  type CommunityPostModerationAction,
} from "@petcare/shared-types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  Clock3,
  Flag,
  ImageIcon,
  MessageSquare,
  ShieldAlert,
  UserRound,
  XCircle,
} from "lucide-react";
import { useState, type FormEvent } from "react";
import { Link, useParams } from "react-router-dom";
import {
  approveAdminContentPost,
  fetchAdminContentPost,
  fetchAdminContentPostComments,
  fetchAdminContentPostReports,
  offlineAdminContentPost,
  offlineAdminContentPostComment,
  postQueryKeys,
  rejectAdminContentPost,
} from "../../../api/content/posts";
import { usePermission } from "../../../auth/permissions";
import { EditorPageLayout, FormSection } from "../../../components/EditorPageLayout";
import { Badge, Button, StatePanel } from "../../../components/ui";

type ActionMode = CommunityPostModerationAction | null;

const statusLabels: Record<AdminContentPostStatus, string> = {
  pending: "待审核",
  published: "已发布",
  rejected: "已驳回",
  offline: "已下架",
  deleted: "已删除",
};

const statusTones: Record<AdminContentPostStatus, "warning" | "success" | "danger" | "neutral"> = {
  pending: "warning",
  published: "success",
  rejected: "danger",
  offline: "warning",
  deleted: "neutral",
};

const actionLabels: Record<CommunityPostModerationAction, string> = {
  approve: "审核通过",
  reject: "驳回",
  offline: "下架",
};

const commentStatusLabels: Record<CommunityPostCommentStatus, string> = {
  published: "公开",
  offline: "已下架",
  deleted: "已删除",
};

function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat("zh-CN", {
    dateStyle: "medium",
    timeStyle: "short",
    hour12: false,
  }).format(new Date(value));
}

function moderationErrorMessage(error: unknown): string {
  if (axios.isAxiosError<ApiErrorResponse>(error)) {
    return error.response?.data.message ?? "审核操作失败，请稍后重试。";
  }

  return "审核操作失败，请稍后重试。";
}

export default function ContentPostDetail() {
  const { id = "" } = useParams();
  const queryClient = useQueryClient();
  const canModerate = usePermission("content.post.moderate");
  const [actionMode, setActionMode] = useState<ActionMode>(null);
  const [reason, setReason] = useState("");
  const [formError, setFormError] = useState("");
  const [actionError, setActionError] = useState("");
  const [actionSuccess, setActionSuccess] = useState("");
  const [commentActionId, setCommentActionId] = useState("");
  const [commentReason, setCommentReason] = useState("");
  const [commentFormError, setCommentFormError] = useState("");
  const [commentActionError, setCommentActionError] = useState("");
  const [commentActionSuccess, setCommentActionSuccess] = useState("");
  const query = useQuery({
    queryKey: postQueryKeys.detail(id),
    queryFn: () => fetchAdminContentPost(id),
    enabled: Boolean(id),
  });
  const reportsQuery = useQuery({
    queryKey: postQueryKeys.reports(id),
    queryFn: () => fetchAdminContentPostReports(id),
    enabled: Boolean(id) && canModerate,
  });
  const commentsQuery = useQuery({
    queryKey: postQueryKeys.comments(id),
    queryFn: () => fetchAdminContentPostComments(id),
    enabled: Boolean(id) && canModerate,
  });

  const moderationMutation = useMutation({
    mutationFn: async (command: {
      action: CommunityPostModerationAction;
      expectedUpdatedAt: string;
      reason?: string;
    }) => {
      const request = {
        expectedUpdatedAt: command.expectedUpdatedAt,
        ...(command.reason ? { reason: command.reason } : {}),
      };

      if (command.action === "approve") {
        return approveAdminContentPost(id, request);
      }

      if (command.action === "reject") {
        return rejectAdminContentPost(id, request);
      }

      return offlineAdminContentPost(id, request);
    },
    onSuccess: async (post, command) => {
      queryClient.setQueryData(postQueryKeys.detail(id), post);
      setActionMode(null);
      setReason("");
      setFormError("");
      setActionError("");
      setActionSuccess(`${actionLabels[command.action]}成功`);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: postQueryKeys.all }),
        queryClient.invalidateQueries({ queryKey: postQueryKeys.reports(id) }),
      ]);
    },
    onError: async (error) => {
      setActionSuccess("");
      setActionError(moderationErrorMessage(error));

      if (axios.isAxiosError(error) && error.response?.status === 409) {
        setActionMode(null);
        await query.refetch();
      }
    },
  });
  const commentMutation = useMutation({
    mutationFn: ({ commentId, reason }: { commentId: string; reason: string }) =>
      offlineAdminContentPostComment(id, commentId, { reason }),
    onSuccess: async () => {
      setCommentActionId("");
      setCommentReason("");
      setCommentFormError("");
      setCommentActionError("");
      setCommentActionSuccess("评论下架成功");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: postQueryKeys.comments(id) }),
        queryClient.invalidateQueries({ queryKey: postQueryKeys.detail(id) }),
        queryClient.invalidateQueries({ queryKey: postQueryKeys.all }),
      ]);
    },
    onError: (error) => {
      setCommentActionSuccess("");
      setCommentActionError(moderationErrorMessage(error));
    },
  });

  const post = query.data;
  const needsReason = actionMode === "reject" || actionMode === "offline";
  const reasonValid = !needsReason || reason.trim().length > 0;

  function openAction(action: CommunityPostModerationAction) {
    setActionMode(action);
    setReason("");
    setFormError("");
    setActionError("");
    setActionSuccess("");
    setCommentActionSuccess("");
  }

  function closeAction() {
    if (moderationMutation.isPending) {
      return;
    }

    setActionMode(null);
    setReason("");
    setFormError("");
    setActionError("");
  }

  function submitAction(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!post || !actionMode || moderationMutation.isPending) {
      return;
    }

    const trimmedReason = reason.trim();

    if (needsReason && !trimmedReason) {
      setFormError(actionMode === "reject" ? "请填写驳回原因" : "请填写下架原因");

      return;
    }

    setFormError("");
    moderationMutation.mutate({
      action: actionMode,
      expectedUpdatedAt: post.updatedAt,
      ...(needsReason ? { reason: trimmedReason } : {}),
    });
  }

  function openCommentAction(commentId: string) {
    setCommentActionId(commentId);
    setCommentReason("");
    setCommentFormError("");
    setCommentActionError("");
    setCommentActionSuccess("");
    setActionSuccess("");
  }

  function closeCommentAction() {
    if (commentMutation.isPending) {
      return;
    }

    setCommentActionId("");
    setCommentReason("");
    setCommentFormError("");
    setCommentActionError("");
  }

  function submitCommentAction(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedReason = commentReason.trim();

    if (!commentActionId || commentMutation.isPending) {
      return;
    }

    if (!trimmedReason) {
      setCommentFormError("请填写评论下架原因");

      return;
    }

    setCommentFormError("");
    commentMutation.mutate({ commentId: commentActionId, reason: trimmedReason });
  }

  const backLink = (
    <Button asChild intent="ghost">
      <Link to="/content/posts">
        <ArrowLeft aria-hidden="true" className="h-4 w-4" />
        返回帖子管理
      </Link>
    </Button>
  );

  if (!post) {
    return (
      <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-6">
        {backLink}
        {query.isPending ? (
          <StatePanel
            aria-label="正在加载帖子详情"
            title="正在加载帖子详情"
            description="正在读取正文、互动数据和审核记录。"
          />
        ) : null}
        {query.isError ? (
          <StatePanel
            role="alert"
            tone="danger"
            icon={<AlertCircle aria-hidden="true" className="h-5 w-5" />}
            title="帖子详情加载失败"
            description="请检查服务端连接后重试。"
            action={
              <Button intent="dangerOutline" onClick={() => void query.refetch()}>
                重新加载
              </Button>
            }
          />
        ) : null}
      </div>
    );
  }

  const actions =
    canModerate && (post.status === "pending" || post.status === "published") ? (
      <div className="flex flex-wrap gap-3">
        {post.status === "pending" ? (
          <>
            <Button type="button" intent="dangerOutline" onClick={() => openAction("reject")}>
              驳回
            </Button>
            <Button type="button" onClick={() => openAction("approve")}>
              审核通过
            </Button>
          </>
        ) : null}
        {post.status === "published" ? (
          <Button type="button" intent="secondary" onClick={() => openAction("offline")}>
            下架帖子
          </Button>
        ) : null}
      </div>
    ) : undefined;

  return (
    <>
      <EditorPageLayout
        width="wide"
        title="社区帖子详情"
        description={
          <>
            <span className="mr-2 font-medium text-blue-700">帖子管理</span>
            提交于 {formatDateTime(post.createdAt)}
          </>
        }
        status={<Badge tone={statusTones[post.status]}>{statusLabels[post.status]}</Badge>}
        back={backLink}
        actions={actions}
      >
        {actionSuccess ? (
          <p
            role="status"
            className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800"
          >
            {actionSuccess}
          </p>
        ) : null}
        {actionError && !actionMode ? (
          <p
            role="alert"
            className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800"
          >
            {actionError}
          </p>
        ) : null}

        <nav
          aria-label="帖子详情分区"
          className="sticky top-[72px] z-[9] flex gap-1 overflow-x-auto rounded-xl border border-border bg-surface/95 p-1.5 shadow-panel backdrop-blur-sm"
        >
          {[
            ["#post-content", "内容"],
            ["#post-comments", "评论"],
            ["#post-reports", "举报"],
            ["#post-history", "审核历史"],
          ].map(([href, label]) => (
            <a
              key={href}
              href={href}
              className="whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium text-text-secondary outline-none hover:bg-surface-subtle hover:text-text-primary focus-visible:ring-2 focus-visible:ring-brand-primary"
            >
              {label}
            </a>
          ))}
        </nav>

        <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
          <main id="post-content" className="min-w-0 scroll-mt-32 space-y-6">
            <FormSection
              title={
                <span className="flex items-center gap-2">
                  <MessageSquare aria-hidden="true" className="h-5 w-5 text-blue-700" />
                  帖子正文
                </span>
              }
            >
              <p className="whitespace-pre-wrap break-words text-sm leading-7 text-slate-800">
                {post.content}
              </p>
            </FormSection>

            <div className="grid gap-6 lg:grid-cols-2">
              <FormSection
                title={
                  <span className="flex items-center gap-2">
                    <UserRound aria-hidden="true" className="h-5 w-5 text-blue-700" />
                    作者信息
                  </span>
                }
              >
                <dl className="grid gap-4 text-sm sm:grid-cols-2">
                  <div>
                    <dt className="text-slate-500">昵称</dt>
                    <dd className="mt-1 font-medium text-slate-900">{post.author.nickname}</dd>
                  </div>
                  <div>
                    <dt className="text-slate-500">手机号</dt>
                    <dd className="mt-1 font-medium tabular-nums text-slate-900">
                      {post.author.phone ?? "未设置"}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-slate-500">登录账号</dt>
                    <dd className="mt-1 font-medium text-slate-900">
                      {post.author.username ?? "未设置"}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-slate-500">用户 ID</dt>
                    <dd className="mt-1 break-all font-mono text-xs text-slate-700">
                      {post.author.id}
                    </dd>
                  </div>
                </dl>
              </FormSection>

              <FormSection
                title={
                  <span className="flex items-center gap-2">
                    <Clock3 aria-hidden="true" className="h-5 w-5 text-blue-700" />
                    帖子数据
                  </span>
                }
              >
                <dl className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <dt className="text-slate-500">获赞</dt>
                    <dd className="mt-1 font-medium tabular-nums text-slate-900">
                      {post.likesCount}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-slate-500">评论</dt>
                    <dd className="mt-1 font-medium tabular-nums text-slate-900">
                      {post.commentsCount}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-slate-500">分享</dt>
                    <dd className="mt-1 font-medium tabular-nums text-slate-900">
                      {post.sharesCount}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-slate-500">举报</dt>
                    <dd className="mt-1 font-medium tabular-nums text-slate-900">
                      {post.reportsCount}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-slate-500">最后更新</dt>
                    <dd className="mt-1 font-medium text-slate-900">
                      {formatDateTime(post.updatedAt)}
                    </dd>
                  </div>
                </dl>
              </FormSection>
            </div>

            <FormSection
              title={
                <span className="flex items-center gap-2">
                  <ImageIcon aria-hidden="true" className="h-5 w-5 text-blue-700" />
                  社区图片
                </span>
              }
            >
              {post.mediaUrls.length === 0 ? (
                <p className="text-sm text-slate-500">该帖子未上传图片。</p>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {post.mediaUrls.map((url, index) => (
                    <a
                      key={`${url}-${index}`}
                      href={url}
                      target="_blank"
                      rel="noreferrer"
                      className="overflow-hidden rounded-xl border border-slate-200 bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
                      aria-label={`查看原图 ${index + 1}`}
                    >
                      <img
                        src={url}
                        alt={`帖子图片 ${index + 1}`}
                        loading="lazy"
                        className="aspect-[4/3] w-full object-cover"
                      />
                    </a>
                  ))}
                </div>
              )}
            </FormSection>

            {canModerate ? (
              <div id="post-comments" className="scroll-mt-32">
                <FormSection
                  title={
                    <span className="flex items-center gap-2">
                      <MessageSquare aria-hidden="true" className="h-5 w-5 text-blue-700" />
                      评论管理
                    </span>
                  }
                >
                  {commentActionSuccess ? (
                    <p
                      role="status"
                      className="mb-3 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800"
                    >
                      {commentActionSuccess}
                    </p>
                  ) : null}
                  {commentsQuery.isPending ? (
                    <div
                      aria-label="正在加载评论记录"
                      className="h-20 animate-pulse rounded-lg bg-slate-100"
                    />
                  ) : null}
                  {commentsQuery.isError ? (
                    <div className="flex flex-wrap items-center justify-between gap-3" role="alert">
                      <p className="text-sm text-red-700">评论记录加载失败，请稍后重试。</p>
                      <button
                        type="button"
                        className="min-h-11 cursor-pointer rounded-lg border border-red-300 px-3 text-sm font-medium text-red-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-600"
                        onClick={() => void commentsQuery.refetch()}
                      >
                        重试
                      </button>
                    </div>
                  ) : null}
                  {commentsQuery.data?.list.length === 0 ? (
                    <p className="text-sm text-slate-500">暂无评论记录。</p>
                  ) : null}
                  {commentsQuery.data?.list.length ? (
                    <ol className="space-y-3">
                      {commentsQuery.data.list.map((comment) => (
                        <li
                          key={comment.id}
                          className="rounded-lg border border-slate-200 p-4 text-sm"
                        >
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div>
                              <p className="font-semibold text-slate-900">
                                {comment.commenter.nickname}
                              </p>
                              <p className="mt-1 text-xs text-slate-500">
                                {comment.commenter.phone ?? comment.commenter.id} ·{" "}
                                {formatDateTime(comment.createdAt)}
                              </p>
                            </div>
                            <span className="rounded-full bg-slate-100 px-2 py-1 text-xs text-slate-700">
                              {commentStatusLabels[comment.status]}
                            </span>
                          </div>
                          <p className="mt-3 whitespace-pre-wrap break-words text-slate-800">
                            {comment.content}
                          </p>
                          {comment.moderationReason ? (
                            <p className="mt-2 text-orange-800">
                              下架原因：{comment.moderationReason}
                            </p>
                          ) : null}

                          {comment.status === "published" && commentActionId !== comment.id ? (
                            <button
                              type="button"
                              className="mt-3 min-h-11 cursor-pointer rounded-lg border border-orange-300 px-3 text-sm font-semibold text-orange-800 hover:bg-orange-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-600"
                              disabled={commentMutation.isPending}
                              aria-disabled={commentMutation.isPending}
                              onClick={() => openCommentAction(comment.id)}
                            >
                              下架评论
                            </button>
                          ) : null}

                          {commentActionId === comment.id ? (
                            <form
                              className="mt-3 rounded-lg bg-slate-50 p-3"
                              onSubmit={submitCommentAction}
                            >
                              <label
                                htmlFor={`comment-offline-reason-${comment.id}`}
                                className="font-medium text-slate-800"
                              >
                                评论下架原因（必填）
                              </label>
                              <textarea
                                id={`comment-offline-reason-${comment.id}`}
                                autoFocus
                                value={commentReason}
                                rows={3}
                                maxLength={500}
                                disabled={commentMutation.isPending}
                                aria-invalid={Boolean(commentFormError)}
                                onChange={(event) => setCommentReason(event.target.value)}
                                className="mt-2 w-full resize-y rounded-lg border border-slate-300 p-3 text-sm outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20 disabled:cursor-not-allowed disabled:bg-slate-100"
                              />
                              {commentFormError || commentActionError ? (
                                <p role="alert" className="mt-1 text-xs text-red-700">
                                  {commentFormError || commentActionError}
                                </p>
                              ) : null}
                              <div className="mt-3 flex justify-end gap-2">
                                <button
                                  type="button"
                                  disabled={commentMutation.isPending}
                                  aria-disabled={commentMutation.isPending}
                                  className="min-h-11 cursor-pointer rounded-lg border border-slate-300 px-3 text-sm font-medium text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
                                  onClick={closeCommentAction}
                                >
                                  取消
                                </button>
                                <button
                                  type="submit"
                                  disabled={commentMutation.isPending || !commentReason.trim()}
                                  aria-disabled={commentMutation.isPending || !commentReason.trim()}
                                  className="min-h-11 cursor-pointer rounded-lg bg-orange-700 px-3 text-sm font-semibold text-white hover:bg-orange-800 disabled:cursor-not-allowed disabled:bg-slate-400"
                                >
                                  {commentMutation.isPending ? "下架中" : "确认下架评论"}
                                </button>
                              </div>
                            </form>
                          ) : null}
                        </li>
                      ))}
                    </ol>
                  ) : null}
                </FormSection>
              </div>
            ) : null}
          </main>

          <aside className="min-w-0 space-y-6 xl:sticky xl:top-32 xl:max-h-[calc(100dvh-144px)] xl:overflow-y-auto xl:pr-1">
            {canModerate ? (
              <div id="post-reports" className="scroll-mt-32">
                <FormSection
                  title={
                    <span className="flex items-center gap-2">
                      <Flag aria-hidden="true" className="h-5 w-5 text-red-700" />
                      举报记录
                    </span>
                  }
                >
                  {reportsQuery.isPending ? (
                    <div
                      aria-label="正在加载举报记录"
                      className="h-20 animate-pulse rounded-lg bg-slate-100"
                    />
                  ) : null}
                  {reportsQuery.isError ? (
                    <p role="alert" className="text-sm text-red-700">
                      举报记录加载失败，请稍后重试。
                    </p>
                  ) : null}
                  {reportsQuery.data?.list.length === 0 ? (
                    <p className="text-sm text-slate-500">暂无举报记录。</p>
                  ) : null}
                  {reportsQuery.data?.list.length ? (
                    <ol className="space-y-3">
                      {reportsQuery.data.list.map((report) => (
                        <li
                          key={report.id}
                          className="rounded-lg border border-red-100 bg-red-50/40 p-4 text-sm"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <span className="font-semibold text-slate-900">
                              {COMMUNITY_POST_REPORT_REASON_LABELS[report.reason]}
                            </span>
                            <span className="rounded-full bg-white px-2 py-1 text-xs text-slate-600 ring-1 ring-slate-200">
                              {report.status === "pending" ? "待处理" : "已解决"}
                            </span>
                          </div>
                          <p className="mt-2 text-slate-700">
                            举报人：{report.reporter.nickname}（
                            {report.reporter.phone ?? report.reporter.id}）
                          </p>
                          {report.description ? (
                            <p className="mt-2 whitespace-pre-wrap text-slate-800">
                              补充说明：{report.description}
                            </p>
                          ) : null}
                          <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                            <time className="text-xs text-slate-500" dateTime={report.createdAt}>
                              {formatDateTime(report.createdAt)} · 帖子 {report.post.id}
                            </time>
                            {report.status === "pending" && post.status === "published" ? (
                              <button
                                type="button"
                                className="min-h-11 cursor-pointer rounded-lg border border-red-300 px-3 text-sm font-semibold text-red-800 hover:bg-red-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-600"
                                onClick={() => openAction("offline")}
                              >
                                从举报下架帖子
                              </button>
                            ) : null}
                          </div>
                        </li>
                      ))}
                    </ol>
                  ) : null}
                </FormSection>
              </div>
            ) : null}

            <div id="post-history" className="scroll-mt-32">
              <FormSection
                title={
                  <span className="flex items-center gap-2">
                    <ShieldAlert aria-hidden="true" className="h-5 w-5 text-blue-700" />
                    审核历史
                  </span>
                }
              >
                {post.moderationReason ? (
                  <p className="mb-4 rounded-lg border border-orange-200 bg-orange-50 p-3 text-sm text-orange-900">
                    当前原因：{post.moderationReason}
                  </p>
                ) : null}
                {post.moderationHistory.length === 0 ? (
                  <p className="text-sm text-slate-500">暂无审核记录。</p>
                ) : (
                  <ol className="space-y-3">
                    {post.moderationHistory.map((event) => (
                      <li key={event.id} className="rounded-lg border border-slate-200 p-4 text-sm">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="font-semibold text-slate-900">
                            {actionLabels[event.action]}
                          </span>
                          <time className="text-xs text-slate-500" dateTime={event.createdAt}>
                            {formatDateTime(event.createdAt)}
                          </time>
                        </div>
                        <p className="mt-2 text-slate-600">
                          {event.operator.nickname} · {statusLabels[event.previousStatus]} →{" "}
                          {statusLabels[event.nextStatus]}
                        </p>
                        {event.reason ? (
                          <p className="mt-2 text-slate-800">原因：{event.reason}</p>
                        ) : null}
                      </li>
                    ))}
                  </ol>
                )}
              </FormSection>
            </div>
          </aside>
        </div>
      </EditorPageLayout>

      {actionMode ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="post-action-title"
            aria-busy={moderationMutation.isPending}
            className="w-full max-w-[512px] rounded-xl bg-white p-6 shadow-2xl"
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                closeAction();
              }
            }}
          >
            <h2 id="post-action-title" className="text-xl font-semibold text-slate-950">
              {actionMode === "approve" ? "确认通过帖子？" : `${actionLabels[actionMode]}帖子`}
            </h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              {actionMode === "approve"
                ? "通过后帖子将进入公开状态。"
                : "该原因会写入审核历史，提交后不能静默覆盖。"}
            </p>
            <form className="mt-4" onSubmit={submitAction}>
              {needsReason ? (
                <>
                  <label
                    htmlFor="post-action-reason"
                    className="text-sm font-medium text-slate-800"
                  >
                    {actionMode === "reject" ? "驳回原因（必填）" : "下架原因（必填）"}
                  </label>
                  <textarea
                    id="post-action-reason"
                    autoFocus
                    value={reason}
                    rows={5}
                    maxLength={500}
                    disabled={moderationMutation.isPending}
                    aria-invalid={Boolean(formError)}
                    aria-describedby={formError ? "post-action-form-error" : "post-action-help"}
                    onChange={(event) => setReason(event.target.value)}
                    className="mt-2 w-full resize-y rounded-lg border border-slate-300 p-3 text-sm outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20 disabled:cursor-not-allowed disabled:bg-slate-100"
                  />
                  <div className="mt-1 flex justify-between gap-4 text-xs">
                    <p
                      id={formError ? "post-action-form-error" : "post-action-help"}
                      className={formError ? "text-red-700" : "text-slate-500"}
                    >
                      {formError || "请填写清晰、可追溯的处理原因。"}
                    </p>
                    <span className="tabular-nums text-slate-500">{reason.length}/500</span>
                  </div>
                </>
              ) : null}

              {actionError ? (
                <p
                  role="alert"
                  className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800"
                >
                  {actionError}
                </p>
              ) : null}

              <div className="mt-6 flex justify-end gap-3">
                <button
                  type="button"
                  disabled={moderationMutation.isPending}
                  aria-disabled={moderationMutation.isPending}
                  className="min-h-11 cursor-pointer rounded-lg border border-slate-300 px-4 text-sm font-medium text-slate-700 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 disabled:cursor-not-allowed disabled:opacity-50"
                  onClick={closeAction}
                >
                  取消
                </button>
                <button
                  type="submit"
                  autoFocus={!needsReason}
                  disabled={moderationMutation.isPending || !reasonValid}
                  aria-disabled={moderationMutation.isPending || !reasonValid}
                  className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-lg bg-blue-700 px-4 text-sm font-semibold text-white hover:bg-blue-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 disabled:cursor-not-allowed disabled:bg-slate-400"
                >
                  {moderationMutation.isPending ? (
                    <Clock3
                      aria-hidden="true"
                      className="h-4 w-4 animate-spin motion-reduce:animate-none"
                    />
                  ) : null}
                  {!moderationMutation.isPending && actionMode === "approve" ? (
                    <CheckCircle2 aria-hidden="true" className="h-4 w-4" />
                  ) : null}
                  {!moderationMutation.isPending && actionMode !== "approve" ? (
                    <XCircle aria-hidden="true" className="h-4 w-4" />
                  ) : null}
                  {moderationMutation.isPending ? "提交中" : `确认${actionLabels[actionMode]}`}
                </button>
              </div>
            </form>
          </section>
        </div>
      ) : null}
    </>
  );
}
