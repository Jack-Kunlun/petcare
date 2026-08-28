import { KeyRound, ShieldCheck } from "lucide-react";
import { type FormEvent, type RefObject, useState } from "react";
import { useNavigate } from "react-router-dom";
import { changeAdminPassword } from "../../api/admin-account";
import { useAuth } from "../../auth/auth.context";
import { Badge, Button, Input } from "../../components/ui";
import { showApiError } from "../../lib/global-error";

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
    } catch (error) {
      showApiError(error);
    } finally {
      setPending(false);
    }
  }

  return (
    <section
      id="password"
      ref={sectionRef}
      tabIndex={-1}
      className="form-section min-w-0 scroll-mt-28 rounded-xl border border-border bg-surface p-6 shadow-panel outline-none focus-visible:ring-2 focus-visible:ring-brand-primary xl:sticky xl:top-28"
    >
      <div className="flex items-start gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-soft text-brand-primary">
          <KeyRound aria-hidden="true" className="h-5 w-5" />
        </span>
        <div>
          <h2 className="text-lg font-semibold text-text-primary">修改密码</h2>
          <p className="mt-1 text-sm leading-6 text-text-secondary">
            修改后需要重新登录，其他设备的登录状态也会失效。
          </p>
        </div>
      </div>

      <div className="mt-5 flex items-start gap-3 rounded-xl border border-warning-border bg-warning-soft p-4 text-sm text-text-primary">
        <ShieldCheck aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
        <div>
          <p className="font-semibold">安全要求</p>
          <p className="mt-1 leading-5 text-text-secondary">
            新密码至少 12 位，修改后全部会话失效。
          </p>
        </div>
      </div>

      <form className="mt-5 grid gap-4" onSubmit={(event) => void submit(event)}>
        <label className="block text-sm font-medium text-text-primary">
          当前密码
          <Input
            ref={currentPasswordRef}
            type="password"
            autoComplete="current-password"
            value={currentPassword}
            disabled={pending}
            onChange={(event) => setCurrentPassword(event.target.value)}
            className="mt-2"
          />
        </label>
        <label className="block text-sm font-medium text-text-primary">
          新密码
          <Input
            type="password"
            autoComplete="new-password"
            value={newPassword}
            disabled={pending}
            onChange={(event) => setNewPassword(event.target.value)}
            className="mt-2"
          />
        </label>
        <label className="block text-sm font-medium text-text-primary">
          确认新密码
          <Input
            type="password"
            autoComplete="new-password"
            value={confirmation}
            disabled={pending}
            onChange={(event) => setConfirmation(event.target.value)}
            className="mt-2"
          />
        </label>
        {error ? (
          <p
            role="alert"
            className="rounded-lg border border-danger-border bg-danger-soft px-3 py-2 text-sm text-danger-strong"
          >
            {error}
          </p>
        ) : null}
        <Button type="submit" loading={pending} className="w-full">
          修改密码
        </Button>
      </form>

      <div className="mt-5 border-t border-border pt-4">
        <Badge tone="neutral">需要重新登录</Badge>
      </div>
    </section>
  );
}
