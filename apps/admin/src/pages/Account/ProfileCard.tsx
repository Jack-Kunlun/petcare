import type { AdminAccountProfile } from "@petcare/shared-types";
import { Camera, Trash2, Upload, UserRound } from "lucide-react";
import { type ChangeEvent, useState } from "react";
import {
  deleteAdminAvatar,
  updateAdminAccountProfile,
  uploadAdminAvatar,
} from "../../api/admin-account";
import { useAuth } from "../../auth/auth.context";
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
    <section className="min-w-0 rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold text-slate-950">个人资料</h2>
          <p className="mt-1 leading-6 text-slate-600">
            更新昵称和头像，变更会同步到顶部账户菜单。
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-full bg-blue-50 text-blue-700">
            {profile.avatar ? (
              <img src={profile.avatar} alt="当前头像" className="h-full w-full object-cover" />
            ) : (
              <UserRound data-testid="default-avatar" aria-hidden="true" className="h-8 w-8" />
            )}
          </span>
          <div className="flex flex-wrap gap-2">
            <label className="inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-lg border border-slate-300 px-3 py-2 font-medium text-slate-700 outline-none transition-colors hover:bg-slate-50 focus-within:ring-2 focus-within:ring-blue-600 focus-within:ring-offset-2 disabled:cursor-not-allowed">
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
            <button
              type="button"
              disabled={!profile.avatar || avatarPending}
              className="inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-lg border border-slate-300 px-3 py-2 font-medium text-slate-700 outline-none transition-colors hover:bg-slate-50 focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400"
              onClick={() => void removeAvatar()}
            >
              <Trash2 aria-hidden="true" className="h-4 w-4" />
              移除头像
            </button>
          </div>
        </div>
      </div>

      <p className="mt-3 flex items-center gap-2 text-xs leading-5 text-slate-500">
        <Camera aria-hidden="true" className="h-4 w-4 shrink-0" />
        支持 JPEG、PNG、WebP，最大 2MB；服务端会再次验证文件。
      </p>

      {error ? (
        <p
          id="profile-feedback"
          role="alert"
          className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800"
        >
          {error}
        </p>
      ) : null}
      {success ? (
        <p
          role="status"
          className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800"
        >
          {success}
        </p>
      ) : null}

      <div className="mt-6 grid gap-5 lg:grid-cols-2">
        <div className="space-y-4">
          <label className="block text-sm font-medium text-slate-700">
            用户名
            <input
              readOnly
              value={profile.username ?? "未设置"}
              className="mt-2 h-11 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 text-slate-600 outline-none"
            />
          </label>
          <label className="block text-sm font-medium text-slate-700">
            手机号
            <input
              readOnly
              value={profile.maskedPhone}
              className="mt-2 h-11 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 text-slate-600 outline-none"
            />
          </label>
          <label className="block text-sm font-medium text-slate-700">
            昵称
            <input
              value={nickname}
              maxLength={32}
              onChange={(event) => setNickname(event.target.value)}
              aria-describedby={error ? "profile-feedback" : undefined}
              className="mt-2 h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-slate-900 outline-none transition-colors hover:border-blue-500 focus-visible:border-blue-600 focus-visible:ring-2 focus-visible:ring-blue-600/20"
            />
          </label>
          <button
            type="button"
            disabled={!canSaveNickname}
            className="inline-flex min-h-11 cursor-pointer items-center justify-center rounded-lg bg-blue-700 px-4 py-2 font-semibold text-white outline-none transition-colors hover:bg-blue-800 focus-visible:ring-2 focus-visible:ring-blue-700 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:bg-slate-400"
            onClick={() => void saveNickname()}
          >
            {nicknamePending ? "保存中…" : "保存昵称"}
          </button>
        </div>

        <dl className="grid content-start gap-4 rounded-lg bg-slate-50 p-4 text-sm">
          <div>
            <dt className="text-slate-500">账号状态</dt>
            <dd className="mt-1 font-medium text-slate-900">{profile.status}</dd>
          </div>
          <div>
            <dt className="text-slate-500">角色</dt>
            <dd className="mt-1 font-medium text-slate-900">
              {profile.roles.join("、") || "未分配角色"}
            </dd>
          </div>
          <div>
            <dt className="text-slate-500">创建时间</dt>
            <dd className="mt-1 font-medium text-slate-900">{formatDate(profile.createdAt)}</dd>
          </div>
        </dl>
      </div>
    </section>
  );
}
