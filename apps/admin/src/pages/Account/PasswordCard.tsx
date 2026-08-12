import { KeyRound } from "lucide-react";
import { type FormEvent, type RefObject, useState } from "react";
import { useNavigate } from "react-router-dom";
import { changeAdminPassword } from "../../api/admin-account";
import { useAuth } from "../../auth/auth.context";

interface PasswordCardProps {
  currentPasswordRef: RefObject<HTMLInputElement | null>;
  sectionRef: RefObject<HTMLElement | null>;
}

/** Allows an administrator to rotate their password and safely reauthenticate. */
export function PasswordCard({ currentPasswordRef, sectionRef }: PasswordCardProps) {
  const auth = useAuth();
  const navigate = useNavigate();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (newPassword.length < 12) {
      setError("新密码至少需要 12 位。");

      return;
    }

    if (confirmation !== newPassword) {
      setError("两次输入的新密码不一致。");

      return;
    }

    setPending(true);

    try {
      await changeAdminPassword({ currentPassword, newPassword });
      auth.invalidateLocalSession();
      navigate("/login", {
        replace: true,
        state: { message: "密码已修改，请重新登录" },
      });
    } catch {
      setError("密码修改失败，请检查当前密码后重试。");
    } finally {
      setPending(false);
    }
  }

  return (
    <section
      id="password"
      ref={sectionRef}
      tabIndex={-1}
      className="min-w-0 rounded-xl border border-slate-200 bg-white p-5 shadow-sm outline-none sm:p-6"
    >
      <div className="flex items-start gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-700">
          <KeyRound aria-hidden="true" className="h-5 w-5" />
        </span>
        <div>
          <h2 className="text-xl font-semibold text-slate-950">修改密码</h2>
          <p className="mt-1 leading-6 text-slate-600">修改后需要重新登录，其他设备的登录状态也会失效。</p>
        </div>
      </div>

      <form className="mt-6 grid max-w-[576px] gap-5" onSubmit={(event) => void submit(event)}>
        <label className="block text-sm font-medium text-slate-700">
          当前密码
          <input
            ref={currentPasswordRef}
            type="password"
            autoComplete="current-password"
            value={currentPassword}
            disabled={pending}
            onChange={(event) => setCurrentPassword(event.target.value)}
            className="mt-2 h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-slate-900 outline-none transition-colors hover:border-blue-500 focus-visible:border-blue-600 focus-visible:ring-2 focus-visible:ring-blue-600/20 disabled:cursor-not-allowed disabled:bg-slate-100"
          />
        </label>
        <label className="block text-sm font-medium text-slate-700">
          新密码
          <input
            type="password"
            autoComplete="new-password"
            value={newPassword}
            disabled={pending}
            onChange={(event) => setNewPassword(event.target.value)}
            className="mt-2 h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-slate-900 outline-none transition-colors hover:border-blue-500 focus-visible:border-blue-600 focus-visible:ring-2 focus-visible:ring-blue-600/20 disabled:cursor-not-allowed disabled:bg-slate-100"
          />
        </label>
        <label className="block text-sm font-medium text-slate-700">
          确认新密码
          <input
            type="password"
            autoComplete="new-password"
            value={confirmation}
            disabled={pending}
            onChange={(event) => setConfirmation(event.target.value)}
            className="mt-2 h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-slate-900 outline-none transition-colors hover:border-blue-500 focus-visible:border-blue-600 focus-visible:ring-2 focus-visible:ring-blue-600/20 disabled:cursor-not-allowed disabled:bg-slate-100"
          />
        </label>
        {error ? (
          <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
            {error}
          </p>
        ) : null}
        <button
          type="submit"
          disabled={pending}
          className="inline-flex min-h-11 w-full cursor-pointer items-center justify-center rounded-lg bg-blue-700 px-4 py-2 font-semibold text-white outline-none transition-colors hover:bg-blue-800 focus-visible:ring-2 focus-visible:ring-blue-700 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:bg-slate-400 sm:w-fit"
        >
          {pending ? "修改中…" : "修改密码"}
        </button>
      </form>
    </section>
  );
}
