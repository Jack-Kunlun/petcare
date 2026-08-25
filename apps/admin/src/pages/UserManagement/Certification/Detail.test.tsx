import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  approveAdminProviderCertification,
  fetchAdminProviderCertification,
  rejectAdminProviderCertification,
} from "../../../api/provider-certifications";
import { AuthContext, type AuthContextValue } from "../../../auth/auth.context";
import ProviderCertificationDetail from "./Detail";

vi.mock("../../../api/provider-certifications", () => ({
  approveAdminProviderCertification: vi.fn(),
  fetchAdminProviderCertification: vi.fn(),
  rejectAdminProviderCertification: vi.fn(),
}));

const pendingApplication = {
  id: "application-1",
  applicant: {
    id: "user-1",
    phone: "13800138000",
    username: "provider",
    nickname: "安心宠托",
    avatar: null,
  },
  realNameMasked: "张*",
  idCardVerified: true,
  idCardMasked: "3601********1234",
  idCardFrontUrl: "https://example.com/front",
  idCardBackUrl: "https://example.com/back",
  trainingPassed: true,
  wechatScore: 680,
  status: "pending",
  rejectReason: null,
  reviewedBy: null,
  createdAt: "2026-07-29T00:00:00.000Z",
  reviewedAt: null,
  updatedAt: "2026-07-29T00:00:00.000Z",
} as const;

function renderPage(permissions = ["user.approve_provider", "user.reject_provider"]) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const auth: AuthContextValue = {
    status: "authenticated",
    user: {
      id: "admin-1",
      username: "operator",
      phone: "13800138000",
      nickname: "运营主管",
      avatar: null,
      roles: ["operator"],
      permissions,
    },
    loginWithPassword: vi.fn(),
    loginWithSms: vi.fn(),
    getCaptcha: vi.fn(),
    sendSmsCode: vi.fn(),
    logout: vi.fn(),
    updateUserSummary: vi.fn(),
    invalidateLocalSession: vi.fn(),
  };

  return render(
    <AuthContext.Provider value={auth}>
      <MemoryRouter initialEntries={["/users/certifications/application-1"]}>
        <QueryClientProvider client={queryClient}>
          <Routes>
            <Route path="/users/certifications/:id" element={<ProviderCertificationDetail />} />
          </Routes>
        </QueryClientProvider>
      </MemoryRouter>
    </AuthContext.Provider>,
  );
}

describe("ProviderCertificationDetail", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(fetchAdminProviderCertification).mockResolvedValue(pendingApplication);
  });

  it("uses the shared layout and repeats pending review actions in the header and footer", async () => {
    const user = userEvent.setup();

    renderPage();

    await screen.findByText("安心宠托");
    const page = document.querySelector("section.editor-page");

    expect(page).toHaveClass("max-w-[var(--editor-width-default)]");
    const header = within(page?.querySelector("header.editor-page__header") as HTMLElement);
    const footer = within(page?.querySelector("footer.editor-page__footer") as HTMLElement);

    expect(header.getByRole("link", { name: "返回认证审核" })).toBeInTheDocument();
    expect(header.getByRole("heading", { name: "安心宠托" })).toBeInTheDocument();
    expect(header.getByText("待审核")).toBeInTheDocument();
    expect(header.getByRole("button", { name: "顶部驳回申请" })).toBeInTheDocument();
    expect(header.getByRole("button", { name: "顶部审核通过" })).toBeInTheDocument();

    await user.click(header.getByRole("button", { name: "顶部驳回申请" }));
    expect(screen.getByRole("dialog", { name: "驳回认证申请" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "取消" }));
    await user.click(footer.getByRole("button", { name: "驳回申请" }));
    expect(screen.getByRole("dialog", { name: "驳回认证申请" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "取消" }));

    await user.click(header.getByRole("button", { name: "顶部审核通过" }));
    expect(screen.getByRole("dialog", { name: "确认通过认证？" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "取消" }));
    await user.click(footer.getByRole("button", { name: "审核通过" }));
    expect(screen.getByRole("dialog", { name: "确认通过认证？" })).toBeInTheDocument();
  });

  it("does not expose review actions after the application leaves pending", async () => {
    vi.mocked(fetchAdminProviderCertification).mockResolvedValue({
      ...pendingApplication,
      status: "approved",
    });

    renderPage();

    await screen.findByText("安心宠托");
    const header = within(document.querySelector("header.editor-page__header") as HTMLElement);

    expect(header.queryByRole("button", { name: "顶部审核通过" })).not.toBeInTheDocument();
    expect(header.queryByRole("button", { name: "顶部驳回申请" })).not.toBeInTheDocument();
    expect(document.querySelector("footer.editor-page__footer")).not.toBeInTheDocument();
  });

  it("requires a reject reason between 2 and 500 characters", async () => {
    const user = userEvent.setup();

    renderPage();

    await screen.findByText("安心宠托");
    await user.click(screen.getByRole("button", { name: "驳回申请" }));
    await user.type(screen.getByLabelText("驳回原因"), "a");
    await user.click(screen.getByRole("button", { name: "确认驳回" }));

    expect(screen.getByText("驳回原因需填写 2 至 500 个字符")).toBeInTheDocument();
    expect(rejectAdminProviderCertification).not.toHaveBeenCalled();
  });

  it("approves after explicit confirmation", async () => {
    const user = userEvent.setup();

    vi.mocked(approveAdminProviderCertification).mockResolvedValue(
      await fetchAdminProviderCertification("application-1"),
    );
    renderPage();

    await screen.findByText("安心宠托");
    await user.click(screen.getByRole("button", { name: "审核通过" }));
    await user.click(screen.getByRole("button", { name: "确认通过" }));

    expect(approveAdminProviderCertification).toHaveBeenCalledWith("application-1");
  });

  it("does not render approval or rejection controls without their exact permissions", async () => {
    renderPage([]);

    await screen.findByText("安心宠托");

    expect(screen.queryByRole("button", { name: "审核通过" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "驳回申请" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "顶部审核通过" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "顶部驳回申请" })).not.toBeInTheDocument();
  });
});
