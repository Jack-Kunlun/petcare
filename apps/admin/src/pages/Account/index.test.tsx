import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import Account from ".";

const api = vi.hoisted(() => ({
  changeAdminPassword: vi.fn(),
  deleteAdminAvatar: vi.fn(),
  getAdminAccountProfile: vi.fn(),
  updateAdminAccountProfile: vi.fn(),
  uploadAdminAvatar: vi.fn(),
}));
const auth = vi.hoisted(() => ({
  invalidateLocalSession: vi.fn(),
  updateUserSummary: vi.fn(),
}));

vi.mock("../../api/admin-account", () => api);
vi.mock("../../auth/auth.context", () => ({ useAuth: () => auth }));

const profile = {
  id: "admin-1",
  username: "admin",
  maskedPhone: "176****1878",
  nickname: "系统管理员",
  avatar: null,
  status: "正常",
  roles: ["超级管理员", "运营管理员"],
  createdAt: "2026-01-02T03:04:05.000Z",
};

function LocationProbe() {
  const location = useLocation();

  return <output data-testid="location">{`${location.pathname}${location.hash}`}</output>;
}

function renderAccount(initialEntry = "/account") {
  return render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter initialEntries={[initialEntry]}>
        <Routes>
          <Route path="/account" element={<Account />} />
          <Route path="/login" element={<LocationProbe />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("Account", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    api.getAdminAccountProfile.mockResolvedValue(profile);
    api.updateAdminAccountProfile.mockResolvedValue({ ...profile, nickname: "服务端规范昵称" });
    api.uploadAdminAvatar.mockResolvedValue({ avatar: "https://cdn.example/avatar.webp" });
    api.deleteAdminAvatar.mockResolvedValue(undefined);
    api.changeAdminPassword.mockResolvedValue(undefined);
  });

  it("shows a profile loading skeleton while the profile request is pending", () => {
    api.getAdminAccountProfile.mockReturnValue(new Promise(() => undefined));
    renderAccount();

    expect(screen.getByRole("status", { name: "正在加载个人资料" })).toBeInTheDocument();
  });

  it("shows a page error and retries the profile request", async () => {
    api.getAdminAccountProfile.mockRejectedValueOnce(new Error("network"));
    const user = userEvent.setup();

    renderAccount();

    expect(await screen.findByRole("alert")).toHaveTextContent("个人资料加载失败");
    await user.click(screen.getByRole("button", { name: "重新加载" }));

    expect(await screen.findByDisplayValue("系统管理员")).toBeInTheDocument();
    expect(api.getAdminAccountProfile).toHaveBeenCalledTimes(2);
  });

  it("shows read-only account information and only saves a trimmed changed nickname", async () => {
    const user = userEvent.setup();

    renderAccount();

    expect(await screen.findByDisplayValue("系统管理员")).toBeInTheDocument();
    expect(screen.getByDisplayValue("admin")).toHaveAttribute("readOnly");
    expect(screen.getByDisplayValue("176****1878")).toHaveAttribute("readOnly");
    expect(screen.getByText("正常")).toBeInTheDocument();
    expect(screen.getByText("超级管理员、运营管理员")).toBeInTheDocument();
    expect(screen.getByText(/2026/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "保存昵称" })).toBeDisabled();

    await user.clear(screen.getByLabelText("昵称"));
    await user.type(screen.getByLabelText("昵称"), "  新昵称  ");
    await user.click(screen.getByRole("button", { name: "保存昵称" }));

    expect(api.updateAdminAccountProfile).toHaveBeenCalledWith({ nickname: "新昵称" });
    expect(auth.updateUserSummary).toHaveBeenCalledWith({
      nickname: "服务端规范昵称",
      avatar: null,
    });
    expect(await screen.findByDisplayValue("服务端规范昵称")).toBeInTheDocument();
    expect(await screen.findByRole("status")).toHaveTextContent("昵称已保存");
  });

  it("validates avatar input locally, keeps the old avatar after failure, and restores default avatar", async () => {
    const user = userEvent.setup();
    const { container } = renderAccount();

    await screen.findByDisplayValue("系统管理员");

    const input = container.querySelector("input[type=\"file\"]") as HTMLInputElement;

    expect(input).toHaveAttribute("accept", "image/jpeg,image/png,image/webp");

    fireEvent.change(input, {
      target: { files: [new File(["image"], "avatar.gif", { type: "image/gif" })] },
    });
    expect(screen.getByRole("alert")).toHaveTextContent("仅支持 JPEG、PNG 或 WebP 格式");

    api.uploadAdminAvatar.mockRejectedValueOnce(new Error("network"));
    fireEvent.change(input, {
      target: { files: [new File(["image"], "avatar.png", { type: "image/png" })] },
    });
    expect(await screen.findByRole("alert")).toHaveTextContent("头像上传失败");
    expect(screen.getByTestId("default-avatar")).toBeInTheDocument();

    api.uploadAdminAvatar.mockResolvedValueOnce({ avatar: "https://cdn.example/avatar.png" });
    fireEvent.change(input, {
      target: { files: [new File(["image"], "avatar.png", { type: "image/png" })] },
    });
    expect(await screen.findByRole("img", { name: "当前头像" })).toHaveAttribute(
      "src",
      "https://cdn.example/avatar.png",
    );

    await user.click(screen.getByRole("button", { name: "移除头像" }));
    await waitFor(() => expect(api.deleteAdminAvatar).toHaveBeenCalledOnce());
    expect(screen.getByTestId("default-avatar")).toBeInTheDocument();
    expect(auth.updateUserSummary).toHaveBeenLastCalledWith({
      nickname: "系统管理员",
      avatar: null,
    });
  });

  it("keeps password confirmation local and ends the local session after a successful password change", async () => {
    const user = userEvent.setup();

    renderAccount();

    await screen.findByDisplayValue("系统管理员");
    await user.type(screen.getByLabelText("当前密码"), "Old-password-value!42");
    await user.type(screen.getByLabelText("新密码"), "New-password-value!42");
    await user.type(screen.getByLabelText("确认新密码"), "different-value");
    await user.click(screen.getByRole("button", { name: "修改密码" }));

    expect(api.changeAdminPassword).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveTextContent("两次输入的新密码不一致");

    await user.clear(screen.getByLabelText("确认新密码"));
    await user.type(screen.getByLabelText("确认新密码"), "New-password-value!42");
    await user.click(screen.getByRole("button", { name: "修改密码" }));

    expect(api.changeAdminPassword).toHaveBeenCalledWith({
      currentPassword: "Old-password-value!42",
      newPassword: "New-password-value!42",
    });
    expect(auth.invalidateLocalSession).toHaveBeenCalledOnce();
    expect(await screen.findByTestId("location")).toHaveTextContent("/login");
  });

  it("scrolls to and focuses the current password field for a password hash", async () => {
    const scrollIntoView = vi.fn();

    Element.prototype.scrollIntoView = scrollIntoView;
    renderAccount("/account#password");

    const currentPassword = await screen.findByLabelText("当前密码");

    expect(scrollIntoView).toHaveBeenCalled();
    expect(currentPassword).toHaveFocus();
  });
});
