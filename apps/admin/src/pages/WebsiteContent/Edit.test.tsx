import type { WebsiteContentVersion } from "@petcare/shared-types";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
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
  };
});

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
  ],
  sourceVersionId: null,
  createdBy: { id: "admin-1", displayName: "运营主管" },
  createdAt: "2026-08-13T00:00:00.000Z",
  publishedBy: null,
  publishedAt: null,
};

const authenticated: AuthContextValue = {
  status: "authenticated",
  user: {
    id: "admin-1",
    username: "operator",
    phone: "17679141878",
    nickname: "运营主管",
    roles: ["operator"],
    permissions: ["website.view", "website.edit"],
  },
  loginWithPassword: vi.fn(),
  loginWithSms: vi.fn(),
  getCaptcha: vi.fn(),
  sendSmsCode: vi.fn(),
  logout: vi.fn(),
};

function renderEditor(permissions = authenticated.user?.permissions ?? []) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const context: AuthContextValue = {
    ...authenticated,
    user: authenticated.user ? { ...authenticated.user, permissions } : null,
  };

  render(
    <AuthContext.Provider value={context}>
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={["/website-content/home/edit"]}>
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
    ]);
    expect(screen.getByText("区块已隐藏，保存草稿后不会在官网中渲染；其预设顺序和类型仍保持不变。")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /新增区块|删除区块|更换区块类型|拖拽排序/ })).toBeNull();

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

  it("blocks save until required SEO and change-summary fields are present", async () => {
    const user = userEvent.setup();

    vi.mocked(websiteContentApi.fetchWebsiteContentDraft).mockResolvedValue(draft);
    renderEditor();

    await screen.findByRole("textbox", { name: "主标题" });
    await user.clear(screen.getByRole("textbox", { name: "SEO 标题" }));
    await user.click(screen.getByRole("button", { name: "保存草稿" }));

    expect(screen.getByText("请填写 SEO 标题、SEO 描述和变更摘要后再保存草稿。")).toBeInTheDocument();
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
    await user.type(screen.getByRole("textbox", { name: "主要行动按钮链接" }), "javascript:alert(1)");
    await user.click(screen.getByRole("button", { name: "保存草稿" }));

    expect(screen.getByRole("alert")).toHaveTextContent("请使用站内路径、HTTPS、mailto 或 tel 链接。");
    expect(websiteContentApi.saveWebsiteContentDraft).not.toHaveBeenCalled();
  });

  it("allows only optional template sections to be hidden and warns before leaving dirty work", async () => {
    const user = userEvent.setup();
    const confirmSpy = vi.spyOn(globalThis, "confirm").mockReturnValue(false);

    vi.mocked(websiteContentApi.fetchWebsiteContentDraft).mockResolvedValue(draft);
    renderEditor();

    await screen.findByRole("textbox", { name: "主标题" });
    expect(screen.getByText("此区块为页面必需区块")).toBeInTheDocument();
    expect(screen.queryByRole("checkbox", { name: "显示 首屏介绍" })).toBeNull();

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

    await waitFor(() => expect(websiteContentApi.fetchWebsiteContentDraft).toHaveBeenCalledTimes(2));
  });

  it("does not render editable controls without the website.edit button permission", async () => {
    vi.mocked(websiteContentApi.fetchWebsiteContentDraft).mockResolvedValue(draft);
    renderEditor(["website.view"]);

    expect(await screen.findByText("没有官网内容编辑权限")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "保存草稿" })).toBeNull();
    expect(websiteContentApi.fetchWebsiteContentDraft).not.toHaveBeenCalled();
  });
});
