import type {
  AdminClassroomArticleDetail,
  UploadAdminClassroomArticleMediaResponse,
} from "@petcare/shared-types";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ContentArticleEdit from "./Edit";

const apiMocks = vi.hoisted(() => ({
  createAdminClassroomArticle: vi.fn(),
  fetchAdminClassroomArticle: vi.fn(),
  publishAdminClassroomArticle: vi.fn(),
  updateAdminClassroomArticle: vi.fn(),
  uploadAdminClassroomArticleMedia: vi.fn(),
}));
const globalErrorMocks = vi.hoisted(() => ({ showApiError: vi.fn() }));

vi.mock("../../../api/content/articles", () => ({
  articleQueryKeys: {
    all: ["admin-content-articles"],
    detail: (id: string) => ["admin-content-articles", "detail", id],
  },
  ...apiMocks,
}));

vi.mock("./RichTextEditor", () => ({
  RichTextEditor: ({
    value,
    disabled,
    onChange,
  }: {
    value: string;
    disabled?: boolean;
    onChange: (nextValue: string) => void;
  }) => (
    <textarea
      aria-label="文章正文"
      value={value}
      disabled={disabled}
      onChange={(event) => onChange(event.target.value)}
    />
  ),
}));

vi.mock("../../../lib/global-error", () => globalErrorMocks);

const articleDetail: AdminClassroomArticleDetail = {
  id: "article-1",
  title: "幼犬喂养课堂",
  summary: "基础喂养知识",
  coverUrl: null,
  publicUrl: "https://website.example/articles/article-1",
  bodyHtml: "<p>正文</p>",
  status: "draft",
  author: null,
  publishedAt: null,
  createdAt: "2026-08-24T00:00:00.000Z",
  updatedAt: "2026-08-24T00:00:00.000Z",
};

const publicAsset: UploadAdminClassroomArticleMediaResponse = {
  id: "asset-1",
  url: "https://cdn.example/article-cover.png",
  width: 800,
  height: 600,
  mimeType: "image/png",
};

function renderEdit(path: string) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const router = createMemoryRouter(
    [
      { path: "/content/articles", element: <p>文章列表占位</p> },
      { path: "/content/articles/new", element: <ContentArticleEdit /> },
      { path: "/content/articles/:id/edit", element: <ContentArticleEdit /> },
    ],
    { initialEntries: [path] },
  );

  render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );

  return router;
}

describe("ContentArticleEdit", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    apiMocks.fetchAdminClassroomArticle.mockResolvedValue(articleDetail);
    apiMocks.createAdminClassroomArticle.mockResolvedValue(articleDetail);
    apiMocks.updateAdminClassroomArticle.mockResolvedValue(articleDetail);
    apiMocks.uploadAdminClassroomArticleMedia.mockResolvedValue(publicAsset);
  });

  it("creates a draft without publishing it", async () => {
    const user = userEvent.setup();

    renderEdit("/content/articles/new");
    await user.type(screen.getByLabelText("标题"), "  幼犬喂养课堂  ");
    await user.type(screen.getByLabelText("摘要"), "  基础喂养知识  ");
    fireEvent.change(screen.getByLabelText("文章正文"), { target: { value: "<p>正文</p>" } });
    await user.click(screen.getByRole("button", { name: "保存草稿" }));

    expect(apiMocks.createAdminClassroomArticle).toHaveBeenCalledWith({
      title: "幼犬喂养课堂",
      summary: "基础喂养知识",
      bodyHtml: "<p>正文</p>",
      coverAssetId: undefined,
    });
    expect(apiMocks.publishAdminClassroomArticle).not.toHaveBeenCalled();
    expect(await screen.findByRole("heading", { name: "编辑文章" })).toBeInTheDocument();
    expect(screen.getByText("草稿已保存")).toBeInTheDocument();
  });

  it("renders inline required-field errors without sending an invalid draft", async () => {
    const user = userEvent.setup();

    renderEdit("/content/articles/new");
    await user.click(screen.getByRole("button", { name: "保存草稿" }));

    expect(screen.getByText("标题不能为空")).toBeInTheDocument();
    expect(screen.getByText("摘要不能为空")).toBeInTheDocument();
    expect(apiMocks.createAdminClassroomArticle).not.toHaveBeenCalled();
  });

  it("updates an offline article with its observed timestamp and retains an omitted cover", async () => {
    apiMocks.fetchAdminClassroomArticle.mockResolvedValue({
      ...articleDetail,
      status: "offline",
      coverUrl: "https://cdn.example/old-cover.png",
    });
    const user = userEvent.setup();

    renderEdit("/content/articles/article-1/edit");
    await screen.findByDisplayValue("幼犬喂养课堂");
    await user.click(screen.getByRole("button", { name: "保存修改" }));

    expect(apiMocks.updateAdminClassroomArticle).toHaveBeenCalledWith(
      "article-1",
      expect.objectContaining({
        coverAssetId: undefined,
        expectedUpdatedAt: articleDetail.updatedAt,
      }),
    );
  });

  it("saves a selected managed cover id", async () => {
    const user = userEvent.setup();

    renderEdit("/content/articles/article-1/edit");
    await screen.findByDisplayValue("幼犬喂养课堂");
    await user.upload(
      screen.getByLabelText("上传封面"),
      new File(["png"], "cover.png", { type: "image/png" }),
    );
    await screen.findByRole("img", { name: "文章封面预览" });
    await user.click(screen.getByRole("button", { name: "保存修改" }));

    expect(apiMocks.updateAdminClassroomArticle).toHaveBeenCalledWith(
      "article-1",
      expect.objectContaining({ coverAssetId: publicAsset.id }),
    );
  });

  it("sends null after removing an existing cover", async () => {
    apiMocks.fetchAdminClassroomArticle.mockResolvedValue({
      ...articleDetail,
      status: "offline",
      coverUrl: "https://cdn.example/old-cover.png",
    });
    const user = userEvent.setup();

    renderEdit("/content/articles/article-1/edit");
    await screen.findByRole("img", { name: "文章封面预览" });
    expect(screen.getByRole("button", { name: "更换文章封面" })).toHaveClass("h-10");
    expect(screen.getByRole("button", { name: "移除封面" })).toHaveClass("h-10");
    await user.click(screen.getByRole("button", { name: "移除封面" }));
    await user.click(screen.getByRole("button", { name: "保存修改" }));

    expect(apiMocks.updateAdminClassroomArticle).toHaveBeenCalledWith(
      "article-1",
      expect.objectContaining({ coverAssetId: null }),
    );
  });

  it("does not expose an edit form for a published article", async () => {
    apiMocks.fetchAdminClassroomArticle.mockResolvedValue({
      ...articleDetail,
      status: "published",
    });

    renderEdit("/content/articles/article-1/edit");

    expect(await screen.findByRole("alert")).toHaveTextContent("已发布文章需先下线后编辑");
    expect(screen.queryByRole("button", { name: "保存修改" })).not.toBeInTheDocument();
  });

  it("does not expose a submit control while an edit detail is loading", () => {
    apiMocks.fetchAdminClassroomArticle.mockReturnValue(new Promise(() => undefined));

    renderEdit("/content/articles/article-1/edit");

    expect(screen.getByText("正在加载文章…")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "保存修改" })).not.toBeInTheDocument();
  });

  it("offers a retry instead of an empty form when loading an edit fails", async () => {
    apiMocks.fetchAdminClassroomArticle.mockRejectedValue(new Error("offline"));
    const user = userEvent.setup();

    renderEdit("/content/articles/article-1/edit");

    expect(await screen.findByRole("alert")).toHaveTextContent("文章加载失败");
    expect(screen.queryByRole("button", { name: "保存修改" })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "重新加载" }));
    await waitFor(() => expect(apiMocks.fetchAdminClassroomArticle).toHaveBeenCalledTimes(2));
  });

  it("reports a failed cover upload only through the global error seam", async () => {
    const error = new Error("cover upload failed");

    apiMocks.uploadAdminClassroomArticleMedia.mockRejectedValue(error);
    const user = userEvent.setup();

    renderEdit("/content/articles/new");
    expect(screen.getByLabelText("上传封面")).toHaveClass("sr-only");
    expect(screen.getByRole("button", { name: "上传文章封面" })).toHaveClass("cursor-pointer");
    expect(screen.getByRole("button", { name: "保存草稿" })).toHaveClass("cursor-pointer");
    await user.upload(
      screen.getByLabelText("上传封面"),
      new File(["png"], "cover.png", { type: "image/png" }),
    );

    await waitFor(() => expect(globalErrorMocks.showApiError).toHaveBeenCalledWith(error));
    expect(screen.queryByText("cover upload failed")).not.toBeInTheDocument();
  });

  it("locks every editing control while a media upload is pending", async () => {
    let resolveUpload!: (asset: UploadAdminClassroomArticleMediaResponse) => void;

    apiMocks.uploadAdminClassroomArticleMedia.mockReturnValue(
      new Promise<UploadAdminClassroomArticleMediaResponse>((resolve) => {
        resolveUpload = resolve;
      }),
    );
    const user = userEvent.setup();

    renderEdit("/content/articles/new");
    await user.upload(
      screen.getByLabelText("上传封面"),
      new File(["png"], "cover.png", { type: "image/png" }),
    );

    await waitFor(() => expect(screen.getByLabelText("标题")).toBeDisabled());
    expect(screen.getByLabelText("摘要")).toBeDisabled();
    expect(screen.getByLabelText("上传封面")).toBeDisabled();
    expect(screen.getByLabelText("文章正文")).toBeDisabled();
    expect(screen.getByRole("button", { name: "保存草稿" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "保存草稿" })).toHaveClass(
      "disabled:cursor-not-allowed",
    );

    resolveUpload(publicAsset);

    await waitFor(() => expect(screen.getByLabelText("标题")).toBeEnabled());
  });

  it("locks every editing control while saving a draft", async () => {
    let resolveSave!: (article: AdminClassroomArticleDetail) => void;

    apiMocks.createAdminClassroomArticle.mockReturnValue(
      new Promise<AdminClassroomArticleDetail>((resolve) => {
        resolveSave = resolve;
      }),
    );
    const user = userEvent.setup();

    renderEdit("/content/articles/new");
    await user.type(screen.getByLabelText("标题"), "幼犬喂养课堂");
    await user.type(screen.getByLabelText("摘要"), "基础喂养知识");
    await user.click(screen.getByRole("button", { name: "保存草稿" }));

    await waitFor(() => expect(screen.getByLabelText("标题")).toBeDisabled());
    expect(screen.getByLabelText("摘要")).toBeDisabled();
    expect(screen.getByLabelText("上传封面")).toBeDisabled();
    expect(screen.getByLabelText("文章正文")).toBeDisabled();
    expect(screen.getByRole("button", { name: "保存草稿" })).toBeDisabled();

    resolveSave(articleDetail);

    expect(await screen.findByRole("heading", { name: "编辑文章" })).toBeInTheDocument();
  });

  it("uses the shared editor layout with its existing status and actions", () => {
    renderEdit("/content/articles/new");

    expect(document.querySelector("section.editor-page")).toBeInTheDocument();
    expect(document.querySelector("header.editor-page__header")).toBeInTheDocument();
    expect(document.querySelector("div.editor-page__content")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "新建文章" })).toBeInTheDocument();
    expect(screen.getByText("草稿")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "返回文章列表" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "取消" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "保存草稿" })).toHaveAttribute(
      "form",
      "article-form",
    );
    expect(screen.getByLabelText("标题")).toHaveAttribute("placeholder", "请输入文章标题");
    expect(screen.getByText("0 / 120")).toBeInTheDocument();
    expect(screen.getByLabelText("摘要")).toHaveAttribute(
      "placeholder",
      "请输入文章摘要，用于文章列表和分享场景展示",
    );
    expect(screen.getByText("0 / 500")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "基础信息" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "文章正文" })).toBeInTheDocument();
    expect(screen.getByLabelText("上传封面")).toHaveClass("sr-only");
  });

  it("uploads a cover dropped onto the custom upload area", async () => {
    renderEdit("/content/articles/new");
    const file = new File(["png"], "dropped-cover.png", { type: "image/png" });

    fireEvent.drop(screen.getByRole("button", { name: "上传文章封面" }), {
      dataTransfer: { files: [file] },
    });

    await waitFor(() =>
      expect(apiMocks.uploadAdminClassroomArticleMedia).toHaveBeenCalledWith(file),
    );
    expect(await screen.findByRole("img", { name: "文章封面预览" })).toHaveAttribute(
      "src",
      publicAsset.url,
    );
  });

  it("blocks dirty navigation and lets the editor stay or discard changes", async () => {
    const user = userEvent.setup();

    const router = renderEdit("/content/articles/new");

    await user.type(screen.getByLabelText("标题"), "未保存标题");

    expect(screen.getByText("有未保存修改")).toBeInTheDocument();
    const beforeUnload = new Event("beforeunload", { cancelable: true });

    window.dispatchEvent(beforeUnload);
    expect(beforeUnload.defaultPrevented).toBe(true);

    await user.click(screen.getByRole("link", { name: "取消" }));
    expect(await screen.findByRole("dialog")).toHaveTextContent("放弃未保存的修改？");
    expect(router.state.location.pathname).toBe("/content/articles/new");

    await user.click(screen.getByRole("button", { name: "继续编辑" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "新建文章" })).toBeInTheDocument();

    await user.click(screen.getByRole("link", { name: "取消" }));
    await user.click(await screen.findByRole("button", { name: "放弃修改" }));
    expect(await screen.findByText("文章列表占位")).toBeInTheDocument();
  });

  it("clears dirty state after saving so later navigation does not prompt", async () => {
    const user = userEvent.setup();

    renderEdit("/content/articles/new");
    await user.type(screen.getByLabelText("标题"), "幼犬喂养课堂");
    await user.type(screen.getByLabelText("摘要"), "基础喂养知识");
    await user.click(screen.getByRole("button", { name: "保存草稿" }));

    expect(await screen.findByText("草稿已保存")).toBeInTheDocument();
    await user.click(screen.getByRole("link", { name: "取消" }));
    expect(await screen.findByText("文章列表占位")).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
