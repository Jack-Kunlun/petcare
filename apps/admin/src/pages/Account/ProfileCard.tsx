import type { AdminAccountProfile } from "@petcare/shared-types";
import { Camera, Trash2, Upload, UserRound } from "lucide-react";
import { type ChangeEvent, useState } from "react";
import {
  deleteAdminAvatar,
  updateAdminAccountProfile,
  uploadAdminAvatar,
} from "../../api/admin-account";
import { useAuth } from "../../auth/auth.context";
import { FormSection } from "../../components/EditorPageLayout";
import { Badge, Button, Input } from "../../components/ui";
import { showApiError } from "../../lib/global-error";

const ACCEPTED_AVATAR_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_AVATAR_BYTES = 2 * 1024 * 1024;

interface ProfileCardProps {
  profile: AdminAccountProfile;
  onProfileChange(profile: AdminAccountProfile): void;
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("zh-CN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

/** Presents and updates the current administrator's public profile details. */
export function ProfileCard({ profile, onProfileChange }: ProfileCardProps) {
  const auth = useAuth();
  const [nickname, setNickname] = useState(profile.nickname);
  const [nicknamePending, setNicknamePending] = useState(false);
  const [avatarPending, setAvatarPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const trimmedNickname = nickname.trim();
  const canSaveNickname =
    !nicknamePending && trimmedNickname.length > 0 && trimmedNickname !== profile.nickname;

  function updateSummary(next: AdminAccountProfile) {
    onProfileChange(next);
    auth.updateUserSummary({ nickname: next.nickname, avatar: next.avatar });
  }

  async function saveNickname() {
    if (!canSaveNickname) {
      return;
    }

    setNicknamePending(true);
    setError(null);
    setSuccess(null);

    try {
      const updatedProfile = await updateAdminAccountProfile({ nickname: trimmedNickname });

      setNickname(updatedProfile.nickname);
      updateSummary(updatedProfile);
      setSuccess("昵称已保存");
    } catch (error) {
      showApiError(error);
    } finally {
      setNicknamePending(false);
    }
  }

  async function handleAvatarChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    event.target.value = "";

    if (!file || avatarPending) {
      return;
    }

    setError(null);
    setSuccess(null);

    if (!ACCEPTED_AVATAR_TYPES.has(file.type)) {
      setError("仅支持 JPEG、PNG 或 WebP 格式的头像。");

      return;
    }

    if (file.size > MAX_AVATAR_BYTES) {
      setError("头像文件不能超过 2MB。");

      return;
    }

    setAvatarPending(true);

    try {
      const result = await uploadAdminAvatar(file);

      updateSummary({ ...profile, avatar: result.avatar });
      setSuccess("头像已更新");
    } catch (error) {
      showApiError(error);
    } finally {
      setAvatarPending(false);
    }
  }

  async function removeAvatar() {
    if (avatarPending || !profile.avatar) {
      return;
    }

    setAvatarPending(true);
    setError(null);
    setSuccess(null);

    try {
      await deleteAdminAvatar();
      updateSummary({ ...profile, avatar: null });
      setSuccess("头像已移除");
    } catch (error) {
      showApiError(error);
    } finally {
      setAvatarPending(false);
    }
  }

  return (
    <FormSection
      title="个人资料"
      description="更新昵称和头像，变更会同步到顶部账户菜单。"
      className="min-w-0"
    >
      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_280px]">
        <div className="min-w-0 space-y-5">
          <div className="flex flex-col gap-4 rounded-xl border border-border bg-surface-subtle p-4 sm:flex-row sm:items-center">
            <span className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-brand-soft text-brand-primary">
              {profile.avatar ? (
                <img src={profile.avatar} alt="当前头像" className="h-full w-full object-cover" />
              ) : (
                <UserRound data-testid="default-avatar" aria-hidden="true" className="h-9 w-9" />
              )}
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-text-primary">账户头像</p>
              <p className="mt-1 flex items-start gap-2 text-xs leading-5 text-text-secondary">
                <Camera aria-hidden="true" className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                支持 JPEG、PNG、WebP，最大 2MB；服务端会再次验证文件。
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <label className="inline-flex h-10 cursor-pointer items-center justify-center gap-2 rounded-lg border border-border-strong bg-surface px-3 text-sm font-semibold text-text-primary outline-none transition-colors hover:border-brand-primary/50 hover:bg-surface-subtle focus-within:ring-2 focus-within:ring-brand-primary focus-within:ring-offset-2 has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-55">
                  <Upload aria-hidden="true" className="h-4 w-4" />
                  {avatarPending ? "上传中…" : "上传头像"}
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    aria-label="上传头像"
                    className="sr-only"
                    disabled={avatarPending}
                    onChange={(event) => void handleAvatarChange(event)}
                  />
                </label>
                <Button
                  type="button"
                  intent="dangerOutline"
                  disabled={!profile.avatar || avatarPending}
                  onClick={() => void removeAvatar()}
                >
                  <Trash2 aria-hidden="true" className="h-4 w-4" />
                  移除头像
                </Button>
              </div>
            </div>
          </div>

          {error ? (
            <p
              id="profile-feedback"
              role="alert"
              className="rounded-lg border border-danger-border bg-danger-soft px-3 py-2 text-sm text-danger-strong"
            >
              {error}
            </p>
          ) : null}
          {success ? (
            <p
              role="status"
              className="rounded-lg border border-success-border bg-success-soft px-3 py-2 text-sm text-success"
            >
              {success}
            </p>
          ) : null}

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block text-sm font-medium text-text-primary">
              用户名
              <Input
                readOnly
                value={profile.username ?? "未设置"}
                className="mt-2 bg-surface-muted"
              />
            </label>
            <label className="block text-sm font-medium text-text-primary">
              手机号
              <Input readOnly value={profile.maskedPhone} className="mt-2 bg-surface-muted" />
            </label>
          </div>
          <label className="block text-sm font-medium text-text-primary">
            昵称
            <Input
              value={nickname}
              maxLength={32}
              onChange={(event) => setNickname(event.target.value)}
              aria-describedby={error ? "profile-feedback" : undefined}
              className="mt-2"
            />
          </label>
          <Button
            type="button"
            disabled={!canSaveNickname}
            loading={nicknamePending}
            onClick={() => void saveNickname()}
          >
            保存昵称
          </Button>
        </div>

        <aside className="rounded-xl border border-border bg-surface-subtle p-4">
          <h3 className="font-semibold text-text-primary">账户信息</h3>
          <dl className="mt-4 grid gap-4 text-sm">
            <div>
              <dt className="text-text-secondary">角色</dt>
              <dd className="mt-1 font-medium text-text-primary">
                {profile.roles.join("、") || "未分配角色"}
              </dd>
            </div>
            <div>
              <dt className="text-text-secondary">创建时间</dt>
              <dd className="mt-1 font-medium text-text-primary">
                {formatDate(profile.createdAt)}
              </dd>
            </div>
          </dl>
          <div className="mt-5 border-t border-border pt-4">
            <Badge tone="neutral">账号信息只读</Badge>
            <p className="mt-2 text-xs leading-5 text-text-secondary">
              用户名、手机号、角色和账号状态需由有权限的管理员维护。
            </p>
          </div>
        </aside>
      </div>
    </FormSection>
  );
}
