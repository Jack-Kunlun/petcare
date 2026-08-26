import type { AdminContentPostDetail } from "@petcare/shared-types";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  approveAdminContentPost,
  fetchAdminContentPost,
  fetchAdminContentPostComments,
  fetchAdminContentPostReports,
  offlineAdminContentPost,
  offlineAdminContentPostComment,
  rejectAdminContentPost,
} from "../../../api/content/posts";
import ContentPostDetail from "./Detail";

const permissionMocks = vi.hoisted(() => ({ allowed: true }));

vi.mock("../../../api/content/posts", () => ({
  postQueryKeys: {
    all: ["admin-content-posts"],
    detail: (id: string) => ["admin-content-posts", "detail", id],
    reports: (id: string) => ["admin-content-posts", "reports", id],
    comments: (id: string) => ["admin-content-posts", "comments", id],
  },
  fetchAdminContentPost: vi.fn(),
  fetchAdminContentPostReports: vi.fn(),
  fetchAdminContentPostComments: vi.fn(),
  approveAdminContentPost: vi.fn(),
  rejectAdminContentPost: vi.fn(),
  offlineAdminContentPost: vi.fn(),
  offlineAdminContentPostComment: vi.fn(),
}));

vi.mock("../../../auth/permissions", () => ({
  usePermission: () => permissionMocks.allowed,
}));

const post: AdminContentPostDetail = {
  id: "post-1",
  author: {
    id: "user-1",
    phone: "13800138000",
    username: "owner",
    nickname: "小明",
    avatar: null,
  },
  contentExcerpt: "今天带旺财散步",
  mediaCount: 1,
  likesCount: 3,
  commentsCount: 2,
  sharesCount: 1,
  reportsCount: 1,
  status: "pending",
  createdAt: "2026-08-26T08:00:00.000Z",
  updatedAt: "2026-08-26T08:00:00.000Z",
  content: "今天带旺财散步，天气很好。",
  mediaUrls: ["https://cdn.example/community.png"],
  moderationReason: null,
  moderationHistory: [
    {
      id: "event-1",
      action: "approve",
      previousStatus: "pending",
      nextStatus: "published",
      reason: null,
      operator: {
        id: "admin-1",
        phone: "17679141879",
        username: "operator",
        nickname: "运营",
        avatar: null,
      },
      createdAt: "2026-08-26T08:01:00.000Z",
    },
  ],
};

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={["/content/posts/post-1"]}>
        <Routes>
          <Route path="/content/posts/:id" element={<ContentPostDetail />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("ContentPostDetail", () => {
  afterEach(cleanup);

  beforeEach(() => {
    vi.clearAllMocks();
    permissionMocks.allowed = true;
    vi.mocked(fetchAdminContentPost).mockResolvedValue(post);
    vi.mocked(fetchAdminContentPostReports).mockResolvedValue({
      list: [
        {
          id: "report-1",
          reporter: {
            id: "reporter-1",
            phone: "17679141880",
            username: null,
            nickname: "举报用户",
            avatar: null,
          },
          post: { id: "post-1", status: "published" },
          reason: "spam",
          description: "重复广告",
          status: "pending",
          createdAt: "2026-08-26T09:00:00.000Z",
          resolvedAt: null,
        },
      ],
      total: 1,
    });
    vi.mocked(fetchAdminContentPostComments).mockResolvedValue({
      list: [
        {
          id: "comment-1",
          postId: "post-1",
          commenter: {
            id: "commenter-1",
            phone: "17679141881",
            username: null,
            nickname: "评论用户",
            avatar: null,
          },
          content: "好可爱",
          status: "published",
          moderationReason: null,
          createdAt: "2026-08-26T09:10:00.000Z",
          updatedAt: "2026-08-26T09:10:00.000Z",
        },
      ],
      total: 1,
      page: 1,
      pageSize: 50,
    });
    vi.mocked(offlineAdminContentPostComment).mockResolvedValue({
      id: "comment-1",
      postId: "post-1",
      commenter: {
        id: "commenter-1",
        phone: "17679141881",
        username: null,
        nickname: "评论用户",
        avatar: null,
      },
      content: "好可爱",
      status: "offline",
      moderationReason: "违反社区规范",
      createdAt: "2026-08-26T09:10:00.000Z",
      updatedAt: "2026-08-26T09:11:00.000Z",
    });
    vi.mocked(approveAdminContentPost).mockResolvedValue({ ...post, status: "published" });
    vi.mocked(rejectAdminContentPost).mockResolvedValue({
      ...post,
      status: "rejected",
      moderationReason: "包含联系方式",
    });
    vi.mocked(offlineAdminContentPost).mockResolvedValue({ ...post, status: "offline" });
  });

  it("shows full content, managed media, history, and submits a required reject reason", async () => {
    const user = userEvent.setup();
    let finishReject: ((value: AdminContentPostDetail) => void) | undefined;

    vi.mocked(rejectAdminContentPost).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finishReject = resolve;
        }),
    );

    renderPage();

    expect(await screen.findByText("今天带旺财散步，天气很好。")).toBeInTheDocument();
    expect(screen.getByAltText("帖子图片 1")).toHaveAttribute(
      "src",
      "https://cdn.example/community.png",
    );
    expect(screen.getByText(/运营/u)).toBeInTheDocument();
    expect(await screen.findByText("垃圾广告或诈骗")).toBeInTheDocument();
    expect(await screen.findByText("好可爱")).toBeInTheDocument();
    expect(screen.getByText(/举报用户/u)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "审核通过" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "驳回" }));
    const confirm = screen.getByRole("button", { name: "确认驳回" });
    const reasonInput = screen.getByLabelText(/驳回原因/u);

    expect(confirm).toBeDisabled();
    await user.type(reasonInput, "包含联系方式");
    expect(confirm).toBeEnabled();
    await user.click(confirm);

    await waitFor(() =>
      expect(rejectAdminContentPost).toHaveBeenCalledWith("post-1", {
        expectedUpdatedAt: post.updatedAt,
        reason: "包含联系方式",
      }),
    );
    expect(screen.getByRole("button", { name: "提交中" })).toBeDisabled();
    expect(reasonInput).toBeDisabled();
    finishReject?.({ ...post, status: "rejected", moderationReason: "包含联系方式" });
    expect(await screen.findByRole("status")).toHaveTextContent("驳回成功");
  });

  it("keeps details readable while hiding every moderation action from read-only operators", async () => {
    permissionMocks.allowed = false;

    renderPage();

    expect(await screen.findByText("今天带旺财散步，天气很好。")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "审核通过" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "驳回" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "下架帖子" })).not.toBeInTheDocument();
    expect(screen.queryByText("举报记录")).not.toBeInTheDocument();
    expect(screen.queryByText("评论管理")).not.toBeInTheDocument();
    expect(fetchAdminContentPostReports).not.toHaveBeenCalled();
    expect(fetchAdminContentPostComments).not.toHaveBeenCalled();
  });

  it("requires a reason before taking a visible comment offline", async () => {
    const user = userEvent.setup();

    renderPage();

    await user.click(await screen.findByRole("button", { name: "下架评论" }));
    const confirm = screen.getByRole("button", { name: "确认下架评论" });

    expect(confirm).toBeDisabled();
    await user.type(screen.getByLabelText(/评论下架原因/u), "违反社区规范");
    await user.click(confirm);

    await waitFor(() =>
      expect(offlineAdminContentPostComment).toHaveBeenCalledWith("post-1", "comment-1", {
        reason: "违反社区规范",
      }),
    );
    expect(await screen.findByRole("status")).toHaveTextContent("评论下架成功");
  });

  it("requires a reason before taking a published post offline", async () => {
    const user = userEvent.setup();

    vi.mocked(fetchAdminContentPost).mockResolvedValue({ ...post, status: "published" });

    renderPage();

    await user.click(await screen.findByRole("button", { name: "从举报下架帖子" }));
    const confirm = screen.getByRole("button", { name: "确认下架" });

    expect(confirm).toBeDisabled();
    await user.type(screen.getByLabelText(/下架原因/u), "违反社区规范");
    await user.click(confirm);

    await waitFor(() =>
      expect(offlineAdminContentPost).toHaveBeenCalledWith("post-1", {
        expectedUpdatedAt: post.updatedAt,
        reason: "违反社区规范",
      }),
    );
  });

  it("shows a retryable error state when detail loading fails", async () => {
    vi.mocked(fetchAdminContentPost).mockRejectedValue(new Error("offline"));

    renderPage();

    expect(await screen.findByRole("alert")).toHaveTextContent("帖子详情加载失败");
    expect(screen.getByRole("button", { name: "重新加载" })).toBeInTheDocument();
  });
});
