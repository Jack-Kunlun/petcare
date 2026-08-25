import type {
  WebsiteContentVersion,
  WebsiteHomeExperienceSection,
  WebsiteRichTextSection,
} from "@petcare/shared-types";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as websiteContentApi from "../../api/website-content";
import { AuthContext, type AuthContextValue } from "../../auth/auth.context";
import WebsiteContentEdit from "./Edit";

vi.mock("../../api/website-content", async () => {
  const actual = await vi.importActual<typeof import("../../api/website-content")>(
    "../../api/website-content",
  );

  return {
    ...actual,
    fetchWebsiteContentDraft: vi.fn(),
    saveWebsiteContentDraft: vi.fn(),
    fetchWebsiteMediaAssets: vi.fn(),
    fetchWebsiteContentDiff: vi.fn(),
    fetchWebsiteContentHistory: vi.fn(),
    createWebsiteContentPreview: vi.fn(),
    publishWebsiteContent: vi.fn(),
    uploadWebsiteMediaAsset: vi.fn(),
    archiveWebsiteMediaAsset: vi.fn(),
  };
});

const homeExperienceSection: WebsiteHomeExperienceSection = {
  sectionKey: "home_experience",
  sectionType: "home_experience",
  sortOrder: 3,
  isEnabled: true,
  schemaVersion: 1,
  content: {
    services: {
      eyebrow: "服务眉题",
      title: "服务标题",
      description: "服务说明",
      action: null,
      items: [
        {
          itemKey: "feeding",
          label: "01",
          title: "上门喂养",
          description: "服务项目说明",
          image: { assetId: null, altText: "喂养场景" },
        },
      ],
    },
    journey: {
      eyebrow: "流程眉题",
      title: "流程标题",
      description: "流程说明",
      action: null,
      items: [{ itemKey: "publish", title: "发布需求", description: "流程项目说明" }],
    },
    record: {
      eyebrow: "记录眉题",
      title: "记录标题",
      description: "记录说明",
      action: null,
      demoTitle: "照护记录",
      statusLabel: "服务进行中",
      steps: [
        { itemKey: "sanitize", time: "14:02", label: "进门消毒", state: "complete" },
        { itemKey: "service", time: "14:12", label: "执行服务", state: "current" },
      ],
      images: [{ assetId: null, altText: "照护记录" }],
      extraImageCount: 0,
      evidence: [{ itemKey: "visible", title: "过程可见", description: "记录证据" }],
    },
    trust: {
      eyebrow: "信任眉题",
      title: "信任标题",
      description: "信任说明",
      action: null,
      items: [{ itemKey: "identity", title: "身份与资料", description: "信任细节" }],
    },
    community: {
      eyebrow: "社区眉题",
      title: "社区标题",
      description: "社区说明",
      action: null,
      items: [
        {
          itemKey: "story",
          label: "宠物日常",
          title: "社区故事",
          description: "社区故事说明",
          image: { assetId: null, altText: "社区故事" },
        },
      ],
    },
    brand: {
      eyebrow: "品牌眉题",
      title: "品牌标题",
      description: "品牌说明",
      image: { assetId: null, altText: "品牌故事" },
    },
  },
  settings: {},
};

const draft: WebsiteContentVersion = {
  id: "draft-home-r2",
  contentKey: "home",
  revision: 2,
  businessVersion: 1,
  status: "draft",
  changeSummary: "调整首页说明",
  seo: {
    title: "PetCare 宠伴",
    description: "可信赖的宠物照护服务。",
    canonicalPath: "/",
    image: null,
  },
  sections: [
    {
      sectionKey: "hero",
      sectionType: "hero",
      sortOrder: 1,
      isEnabled: true,
      schemaVersion: 1,
      content: {
        eyebrow: "PetCare",
        title: "陪伴每一次托付",
        description: "让照护更透明。",
        primaryAction: { label: "了解服务", href: "/services" },
        secondaryAction: null,
        image: { assetId: null, altText: "宠物与照护者" },
      },
      settings: { alignment: "left", imagePosition: "right" },
    },
    {
      sectionKey: "trust_evidence",
      sectionType: "trust_grid",
      sortOrder: 2,
      isEnabled: false,
      schemaVersion: 1,
      content: {
        title: "信任保障",
        description: "透明服务。",
        items: [
          { itemKey: "verified", title: "认证", description: "核验身份", icon: "certificate" },
        ],
      },
      settings: { columns: 3 },
    },
    homeExperienceSection,
  ],
  sourceVersionId: null,
  createdBy: { id: "admin-1", displayName: "运营主管" },
  createdAt: "2026-08-13T00:00:00.000Z",
  publishedBy: null,
  publishedAt: null,
};

function helpSection(sectionKey: string, sortOrder: number, title: string): WebsiteRichTextSection {
  return {
    sectionKey,
    sectionType: "rich_text",
    sortOrder,
    isEnabled: true,
    schemaVersion: 1,
    content: {
      title,
      effectiveDate: null,
      parts: [
        {
          partKey: `question_${sortOrder}`,
          heading: `Question ${sortOrder}`,
          paragraphs: [`Answer ${sortOrder}`],
        },
      ],
    },
    settings: { width: "normal" },
  };
}

const helpDraft: WebsiteContentVersion = {
  ...draft,
  id: "draft-help-r2",
  contentKey: "help",
  seo: { ...draft.seo, canonicalPath: "/help" },
  sections: [
    helpSection("account_and_identity", 1, "Account and identity"),
    helpSection("bounty_and_orders", 2, "Bounties and orders"),
    helpSection("care_records", 3, "Care records"),
    helpSection("fees_and_benefits", 4, "Fees and benefits"),
  ],
};

const authenticated: AuthContextValue = {
  status: "authenticated",
  user: {
    id: "admin-1",
    username: "operator",
    phone: "13800138000",
    nickname: "运营主管",
    avatar: null,
    roles: ["operator"],
    permissions: ["website.view", "website.edit"],
  },
  loginWithPassword: vi.fn(),
  loginWithSms: vi.fn(),
  getCaptcha: vi.fn(),
  sendSmsCode: vi.fn(),
  logout: vi.fn(),
  updateUserSummary: vi.fn(),
  invalidateLocalSession: vi.fn(),
};

function renderEditor(
  permissions = authenticated.user?.permissions ?? [],
  queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } }),
  initialEntry = "/website-content/home/edit",
) {
  const context: AuthContextValue = {
    ...authenticated,
    user: authenticated.user ? { ...authenticated.user, permissions } : null,
  };

  render(
    <AuthContext.Provider value={context}>
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={[initialEntry]}>
          <Routes>
            <Route path="/website-content/:contentKey/edit" element={<WebsiteContentEdit />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    </AuthContext.Provider>,
  );
}

describe("WebsiteContentEdit", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(websiteContentApi.fetchWebsiteMediaAssets).mockResolvedValue({
      list: [],
      total: 0,
      page: 1,
      pageSize: 100,
    });
    vi.mocked(websiteContentApi.fetchWebsiteContentHistory).mockResolvedValue({
      list: [],
      total: 0,
      page: 1,
      pageSize: 20,
    });
    vi.mocked(websiteContentApi.fetchWebsiteContentDiff).mockResolvedValue([
      { path: "seo.title", before: "before", after: "after", changeType: "modified" },
    ]);
  });

  it("edits all four fixed Help categories and allows each category to be disabled", async () => {
    const user = userEvent.setup();
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

    vi.mocked(websiteContentApi.fetchWebsiteContentDraft).mockResolvedValue(helpDraft);
    renderEditor(authenticated.user?.permissions, queryClient, "/website-content/help/edit");

    expect(await screen.findAllByRole("textbox", { name: "正文标题" })).toHaveLength(4);

    const accountSection = screen.getByText(/account_and_identity/u).closest("section");

    expect(accountSection).not.toBeNull();
    const toggle = within(accountSection!).getByRole("checkbox");

    expect(toggle).toBeEnabled();
    await user.click(toggle);
    expect(toggle).not.toBeChecked();
  });

  it("keeps fixed sections ordered and saves a complete immutable draft snapshot", async () => {
    const user = userEvent.setup();

    vi.mocked(websiteContentApi.fetchWebsiteContentDraft).mockResolvedValue(draft);
    vi.mocked(websiteContentApi.saveWebsiteContentDraft).mockResolvedValue({
      ...draft,
      id: "draft-home-r3",
      revision: 3,
      changeSummary: "更新首页主标题",
    });

    renderEditor();

    const title = await screen.findByRole("textbox", { name: "主标题" });

    expect(screen.getAllByText(/区块 \d/).map((element) => element.textContent)).toEqual([
      "区块 1",
      "区块 2",
      "区块 3",
    ]);
    expect(
      screen.getByText("区块已隐藏，保存草稿后不会在官网中渲染；其预设顺序和类型仍保持不变。"),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /新增区块|删除区块|更换区块类型|拖拽排序/ }),
    ).toBeNull();

    await user.clear(title);
    await user.type(title, "更新后的首页标题");
    await user.clear(screen.getByRole("textbox", { name: "变更摘要" }));
    await user.type(screen.getByRole("textbox", { name: "变更摘要" }), "更新首页主标题");
    await user.click(screen.getByRole("button", { name: "保存草稿" }));

    await waitFor(() =>
      expect(websiteContentApi.saveWebsiteContentDraft).toHaveBeenCalledWith("home", {
        revision: 2,
        changeSummary: "更新首页主标题",
        seo: draft.seo,
        sections: expect.arrayContaining([
          expect.objectContaining({
            sectionKey: "hero",
            sectionType: "hero",
            sortOrder: 1,
            content: expect.objectContaining({ title: "更新后的首页标题" }),
          }),
          expect.objectContaining({
            sectionKey: "trust_evidence",
            sectionType: "trust_grid",
            sortOrder: 2,
            isEnabled: false,
          }),
        ]),
      }),
    );
    expect(await screen.findByText("草稿已保存，当前修订版为 r3。")).toBeInTheDocument();
  });

  it("saves homepage experience fields as part of complete sections", async () => {
    const user = userEvent.setup();

    vi.mocked(websiteContentApi.fetchWebsiteContentDraft).mockResolvedValue(draft);
    vi.mocked(websiteContentApi.saveWebsiteContentDraft).mockResolvedValue({
      ...draft,
      id: "draft-home-r3",
      revision: 3,
      changeSummary: "更新首页体验服务",
    });

    renderEditor();

    const serviceTitle = await screen.findByRole("textbox", { name: "服务标题" });

    await user.clear(serviceTitle);
    await user.type(serviceTitle, "更新后的服务标题");
    await user.clear(screen.getByRole("textbox", { name: "变更摘要" }));
    await user.type(screen.getByRole("textbox", { name: "变更摘要" }), "更新首页体验服务");
    await user.click(screen.getByRole("button", { name: "保存草稿" }));

    await waitFor(() =>
      expect(websiteContentApi.saveWebsiteContentDraft).toHaveBeenCalledWith(
        "home",
        expect.objectContaining({
          sections: expect.arrayContaining([
            expect.objectContaining({
              sectionKey: "home_experience",
              sectionType: "home_experience",
              sortOrder: 3,
              content: expect.objectContaining({
                services: expect.objectContaining({ title: "更新后的服务标题" }),
              }),
            }),
          ]),
        }),
      ),
    );
  });

  it("blocks save until required SEO and change-summary fields are present", async () => {
    const user = userEvent.setup();

    vi.mocked(websiteContentApi.fetchWebsiteContentDraft).mockResolvedValue(draft);
    renderEditor();

    await screen.findByRole("textbox", { name: "主标题" });
    await user.clear(screen.getByRole("textbox", { name: "SEO 标题" }));
    await user.click(screen.getByRole("button", { name: "保存草稿" }));

    expect(
      screen.getByText("请填写 SEO 标题、SEO 描述和变更摘要后再保存草稿。"),
    ).toBeInTheDocument();
    expect(websiteContentApi.saveWebsiteContentDraft).not.toHaveBeenCalled();
  });

  it("validates image alt text and managed action destinations before saving", async () => {
    const user = userEvent.setup();

    vi.mocked(websiteContentApi.fetchWebsiteContentDraft).mockResolvedValue(draft);
    renderEditor();

    await screen.findByRole("textbox", { name: "主标题" });
    await user.clear(screen.getByRole("textbox", { name: "首屏图片替代文本" }));
    await user.click(screen.getByRole("button", { name: "保存草稿" }));

    expect(screen.getByRole("alert")).toHaveTextContent("请填写所有区块中的必填字段后再保存草稿。");
    expect(websiteContentApi.saveWebsiteContentDraft).not.toHaveBeenCalled();

    await user.type(screen.getByRole("textbox", { name: "首屏图片替代文本" }), "宠物与照护者");
    await user.clear(screen.getByRole("textbox", { name: "主要行动按钮链接" }));
    await user.type(
      screen.getByRole("textbox", { name: "主要行动按钮链接" }),
      "javascript:alert(1)",
    );
    await user.click(screen.getByRole("button", { name: "保存草稿" }));

    expect(screen.getByRole("alert")).toHaveTextContent(
      "请使用站内路径、HTTPS、mailto 或 tel 链接。",
    );
    expect(websiteContentApi.saveWebsiteContentDraft).not.toHaveBeenCalled();
  });

  it("allows only optional template sections to be hidden and warns before leaving dirty work", async () => {
    const user = userEvent.setup();
    const confirmSpy = vi.spyOn(globalThis, "confirm").mockReturnValue(false);

    vi.mocked(websiteContentApi.fetchWebsiteContentDraft).mockResolvedValue(draft);
    renderEditor();

    await screen.findByRole("textbox", { name: "主标题" });
    expect(screen.getAllByText("此区块为页面必需区块")).toHaveLength(2);
    expect(screen.queryByRole("checkbox", { name: "显示 首屏介绍" })).toBeNull();
    expect(screen.queryByRole("checkbox", { name: "显示 首页体验内容" })).toBeNull();

    expect(screen.queryByRole("textbox", { name: "区块标题" })).toBeNull();
    await user.click(screen.getByRole("checkbox", { name: "显示 信任说明网格" }));
    expect(screen.getByRole("textbox", { name: "区块标题" })).toBeInTheDocument();
    await user.click(screen.getByRole("checkbox", { name: "显示 信任说明网格" }));
    expect(screen.queryByRole("textbox", { name: "区块标题" })).toBeNull();

    await user.click(screen.getByRole("link", { name: "返回官网内容" }));
    expect(confirmSpy).toHaveBeenCalledWith("当前有未保存变更，确定离开编辑页吗？");
    confirmSpy.mockRestore();
  });

  it("retains local work and reports the server revision after an optimistic-lock conflict", async () => {
    const user = userEvent.setup();

    vi.mocked(websiteContentApi.fetchWebsiteContentDraft)
      .mockResolvedValueOnce(draft)
      .mockResolvedValueOnce({ ...draft, revision: 4, changeSummary: "其他管理员已保存" });
    vi.mocked(websiteContentApi.saveWebsiteContentDraft).mockRejectedValue({
      response: { status: 409, data: { code: "WEBSITE_CONTENT_REVISION_CONFLICT" } },
    });
    renderEditor();

    const title = await screen.findByRole("textbox", { name: "主标题" });

    fireEvent.change(title, { target: { value: "本地待协调标题" } });
    await user.clear(screen.getByRole("textbox", { name: "变更摘要" }));
    await user.type(screen.getByRole("textbox", { name: "变更摘要" }), "协调后保存");
    await user.click(screen.getByRole("button", { name: "保存草稿" }));

    expect(await screen.findByText("检测到版本冲突")).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "主标题" })).toHaveValue("本地待协调标题");
    expect(screen.getByText("服务端当前修订版：r4")).toBeInTheDocument();
  });

  it("shows a retryable draft-load error instead of leaving the editor in a loading state", async () => {
    const user = userEvent.setup();

    vi.mocked(websiteContentApi.fetchWebsiteContentDraft).mockRejectedValue(new Error("offline"));
    renderEditor();

    expect(await screen.findByRole("alert")).toHaveTextContent("官网内容草稿加载失败");
    await user.click(screen.getByRole("button", { name: "重新加载" }));

    await waitFor(() =>
      expect(websiteContentApi.fetchWebsiteContentDraft).toHaveBeenCalledTimes(2),
    );
  });

  it("does not render editable controls without the website.edit button permission", async () => {
    vi.mocked(websiteContentApi.fetchWebsiteContentDraft).mockResolvedValue(draft);
    renderEditor(["website.view"]);

    expect(await screen.findByText("没有官网内容编辑权限")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "保存草稿" })).toBeNull();
    expect(websiteContentApi.fetchWebsiteContentDraft).not.toHaveBeenCalled();
  });

  it("only previews saved revisions, keeps dirty work out of publish, and exposes publish and history separately", async () => {
    const user = userEvent.setup();
    const replace = vi.fn();
    const open = vi.spyOn(globalThis, "open").mockReturnValue({
      opener: null,
      location: { replace },
      close: vi.fn(),
    } as unknown as Window);

    vi.mocked(websiteContentApi.fetchWebsiteContentDraft).mockResolvedValue(draft);
    vi.mocked(websiteContentApi.saveWebsiteContentDraft).mockResolvedValue({
      ...draft,
      id: "draft-home-r3",
      revision: 3,
    });
    vi.mocked(websiteContentApi.createWebsiteContentPreview).mockResolvedValue({
      previewUrl: "https://website.example/preview#token=opaque-token",
      expiresAt: "2026-08-13T00:10:00.000Z",
      revision: 3,
    });

    renderEditor(["website.view", "website.edit", "website.publish"]);

    const title = await screen.findByRole("textbox", { name: "主标题" });

    const previewButton = screen.getByRole("button", { name: "preview-saved-draft" });
    const publishButton = screen.getByRole("button", { name: "publish-saved-draft" });
    const saveButton = screen.getByRole("button", { name: "保存草稿" });

    for (const button of [previewButton, publishButton, saveButton]) {
      expect(button).toHaveClass("cursor-pointer", "disabled:cursor-not-allowed");
    }

    expect(previewButton).toBeEnabled();
    expect(publishButton).toBeEnabled();
    expect(screen.getByLabelText("website-media-library")).toBeInTheDocument();
    expect(screen.getByLabelText("website-content-history")).toBeInTheDocument();

    await user.clear(title);
    await user.type(title, "dirty title");
    expect(screen.getByRole("button", { name: "preview-saved-draft" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "publish-saved-draft" })).toBeDisabled();
    expect(websiteContentApi.createWebsiteContentPreview).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "保存草稿" }));
    await screen.findByText("草稿已保存，当前修订版为 r3。", { exact: false });
    await user.click(screen.getByRole("button", { name: "preview-saved-draft" }));

    await waitFor(() =>
      expect(websiteContentApi.createWebsiteContentPreview).toHaveBeenCalledWith("home", {
        revision: 3,
      }),
    );
    expect(open).toHaveBeenCalledWith("about:blank", "_blank");
    expect(replace).toHaveBeenCalledWith("https://website.example/preview#token=opaque-token");
    open.mockRestore();
  });

  it("opens the preview window during the click before waiting for the preview API", async () => {
    const user = userEvent.setup();
    let resolvePreview!: (
      value: Awaited<ReturnType<typeof websiteContentApi.createWebsiteContentPreview>>,
    ) => void;
    const previewRequest = new Promise<
      Awaited<ReturnType<typeof websiteContentApi.createWebsiteContentPreview>>
    >((resolve) => {
      resolvePreview = resolve;
    });
    const replace = vi.fn();
    const previewWindow = {
      opener: globalThis,
      location: { replace },
      close: vi.fn(),
    } as unknown as Window;
    const open = vi.spyOn(globalThis, "open").mockReturnValue(previewWindow);

    vi.mocked(websiteContentApi.fetchWebsiteContentDraft).mockResolvedValue(draft);
    vi.mocked(websiteContentApi.createWebsiteContentPreview).mockReturnValue(previewRequest);
    renderEditor(["website.view", "website.edit"]);

    const previewButton = await screen.findByRole("button", { name: "preview-saved-draft" });

    await user.click(previewButton);
    expect(open).toHaveBeenCalledWith("about:blank", "_blank");
    expect(previewWindow.opener).toBeNull();
    expect(replace).not.toHaveBeenCalled();

    resolvePreview({
      previewUrl: "http://localhost:8080/preview?contentKey=home#token=opaque-token",
      expiresAt: "2026-08-15T11:10:00.000Z",
      revision: 2,
    });
    await waitFor(() =>
      expect(replace).toHaveBeenCalledWith(
        "http://localhost:8080/preview?contentKey=home#token=opaque-token",
      ),
    );
    open.mockRestore();
  });

  it("makes publisher-only access read-only while retaining publish and history", async () => {
    vi.mocked(websiteContentApi.fetchWebsiteContentDraft).mockResolvedValue(draft);
    renderEditor(["website.view", "website.publish"]);

    expect(await screen.findByRole("button", { name: "publish-saved-draft" })).toBeEnabled();
    expect(screen.queryByRole("button", { name: "preview-saved-draft" })).toBeNull();
    expect(screen.queryByLabelText("website-media-library")).toBeNull();
    expect(screen.queryByRole("button", { name: "保存草稿" })).toBeNull();
    expect(screen.getByRole("textbox", { name: "SEO 标题" })).toBeDisabled();
  });

  it("publishes a saved revision, reports its business version, and invalidates affected content queries", async () => {
    const user = userEvent.setup();
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const invalidateQueries = vi.spyOn(queryClient, "invalidateQueries");

    vi.mocked(websiteContentApi.fetchWebsiteContentDraft).mockResolvedValue(draft);
    vi.mocked(websiteContentApi.publishWebsiteContent).mockResolvedValue({
      published: {
        ...draft,
        status: "published",
        businessVersion: 2,
        publishedAt: "2026-08-13T01:00:00.000Z",
      },
      draft: { ...draft, id: "draft-home-r3", revision: 3, businessVersion: 2 },
    });
    renderEditor(["website.view", "website.edit", "website.publish"], queryClient);

    await screen.findByRole("button", { name: "publish-saved-draft" });
    await user.click(screen.getByRole("button", { name: "publish-saved-draft" }));
    await screen.findByText("before");
    await user.type(screen.getByRole("textbox", { name: "变更摘要" }), "发布首页更新");
    await user.click(screen.getByRole("button", { name: "继续发布" }));
    await user.click(screen.getByRole("button", { name: "确认发布" }));

    await waitFor(() =>
      expect(websiteContentApi.publishWebsiteContent).toHaveBeenCalledWith(
        "home",
        expect.objectContaining({
          revision: 2,
          changeSummary: "发布首页更新",
          idempotencyKey: expect.any(String),
        }),
      ),
    );
    expect(await screen.findByText("已发布业务版本 v2。", { exact: false })).toBeInTheDocument();
    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: websiteContentApi.websiteContentQueryKeys.overview(),
    });
    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: websiteContentApi.websiteContentQueryKeys.draft("home"),
    });
    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: websiteContentApi.websiteContentQueryKeys.diff("home"),
    });
    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: ["website-content", "home", "history"],
    });
  });
});
