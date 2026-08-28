import type { CaptchaChallenge } from "@petcare/shared-types";
import { FormEvent, useCallback, useEffect, useState } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import loginBackgroundUrl from "../../assets/brand/petcare-background-soft.svg";
import { useAuth } from "../../auth/auth.context";
import { BrandLogo } from "../../components/BrandLogo";
import { Button, Input } from "../../components/ui";
import { showApiError } from "../../lib/global-error";
import { CaptchaDialog } from "./CaptchaDialog";

type LoginMode = "password" | "sms";

const mobilePattern = /^1[3-9]\d{9}$/;

function getSendCodeLabel(cooldown: number, sending: boolean): string {
  if (cooldown > 0) {
    return `${cooldown}秒后重发`;
  }

  return sending ? "发送中…" : "发送验证码";
}

export default function Login() {
  const auth = useAuth();
  const getCaptcha = auth.getCaptcha;
  const navigate = useNavigate();
  const location = useLocation();
  const [mode, setMode] = useState<LoginMode>("password");
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [pending, setPending] = useState(false);
  const [sendingCode, setSendingCode] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [captcha, setCaptcha] = useState<CaptchaChallenge | null>(null);
  const [captchaCode, setCaptchaCode] = useState("");
  const [captchaLoading, setCaptchaLoading] = useState(false);
  const [captchaLoadError, setCaptchaLoadError] = useState(false);
  const [captchaOpen, setCaptchaOpen] = useState(false);

  const loadCaptcha = useCallback(async () => {
    setCaptchaLoading(true);
    setCaptchaLoadError(false);
    setCaptcha(null);

    try {
      setCaptcha(await getCaptcha());
    } catch (error) {
      setCaptcha(null);
      setCaptchaLoadError(true);
      showApiError(error);
    } finally {
      setCaptchaLoading(false);
    }
  }, [getCaptcha]);

  useEffect(() => {
    if (captchaOpen) {
      void loadCaptcha();
    }
  }, [captchaOpen, loadCaptcha]);

  useEffect(() => {
    if (cooldown <= 0) {
      return;
    }

    const timer = window.setInterval(() => {
      setCooldown((value) => Math.max(0, value - 1));
    }, 1000);

    return () => window.clearInterval(timer);
  }, [cooldown]);

  if (auth.status === "authenticated") {
    return <Navigate to="/" replace />;
  }

  if (auth.status === "loading") {
    return (
      <div className="grid min-h-screen place-items-center bg-page-background text-text-secondary">
        正在恢复登录状态…
      </div>
    );
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (mode === "password") {
      if (identifier.trim().length < 3 || password.length < 12) {
        setError("请输入有效账号和至少 12 位密码");

        return;
      }
    } else if (!mobilePattern.test(phone) || !/^\d{6}$/.test(code)) {
      setError("请输入正确的手机号和 6 位验证码");

      return;
    }

    setPending(true);

    try {
      if (mode === "password") {
        await auth.loginWithPassword(identifier.trim(), password);
      } else {
        await auth.loginWithSms(phone, code);
      }

      navigate("/", { replace: true });
    } catch (error) {
      showApiError(error);
    } finally {
      setPending(false);
    }
  }

  function openCaptchaDialog() {
    setError(null);

    if (!mobilePattern.test(phone)) {
      setError("请输入正确的手机号");

      return;
    }

    if (sendingCode || cooldown > 0) {
      return;
    }

    setCaptcha(null);
    setCaptchaCode("");
    setCaptchaOpen(true);
  }

  function changeCaptchaOpen(open: boolean): void {
    if (sendingCode) {
      return;
    }

    setCaptchaOpen(open);

    if (!open) {
      setCaptcha(null);
      setCaptchaCode("");
    }
  }

  async function confirmSendCode() {
    if (!captcha || !/^[2-9]{4}$/.test(captchaCode)) {
      return;
    }

    setSendingCode(true);

    try {
      const result = await auth.sendSmsCode(phone, captcha.captchaId, captchaCode);

      setCooldown(result.cooldownSeconds);
      setCaptchaOpen(false);
      setCaptcha(null);
      setCaptchaCode("");
    } catch (error) {
      showApiError(error);
      setCaptchaCode("");
      await loadCaptcha();
    } finally {
      setSendingCode(false);
    }
  }

  return (
    <main className="relative isolate grid min-h-screen place-items-center overflow-x-hidden bg-linear-to-br from-page-background via-surface to-brand-soft/50 p-4 sm:p-6">
      <img
        src={loginBackgroundUrl}
        alt=""
        aria-hidden="true"
        data-testid="login-background"
        className="pointer-events-none absolute inset-0 h-full w-full object-cover"
      />
      <div aria-hidden="true" className="pointer-events-none absolute inset-0">
        <span className="absolute left-12 top-10 h-40 w-40 rounded-full bg-brand-primary/10 blur-3xl" />
        <span className="absolute bottom-8 right-10 h-52 w-52 rounded-full bg-care-secondary/10 blur-3xl" />
      </div>

      <section
        data-testid="login-card"
        className="relative z-10 grid w-full max-w-[896px] overflow-hidden rounded-2xl border border-border bg-surface shadow-float md:min-h-[600px] md:grid-cols-[minmax(280px,0.9fr)_minmax(320px,1.1fr)]"
      >
        <aside className="relative hidden flex-col justify-between overflow-hidden bg-linear-to-br from-brand-primary via-brand-primary-hover to-slate-950 p-8 text-white md:flex md:min-h-[600px]">
          <div aria-hidden="true" className="pointer-events-none absolute inset-0 opacity-40">
            <span className="absolute -right-16 -top-20 h-64 w-64 rounded-full border border-white/20" />
            <span className="absolute -right-8 -top-12 h-48 w-48 rounded-full border border-white/15" />
            <span className="absolute -bottom-28 -left-20 h-72 w-72 rounded-full border border-care-secondary/30" />
          </div>
          <div className="relative z-10">
            <BrandLogo
              variant="stacked-reverse"
              className="h-20 w-auto self-start sm:h-24"
              label="PetCare 管理后台"
            />
            <span className="mt-3 block h-1 w-12 rounded-full bg-care-secondary" />
          </div>
          <div className="relative z-10 mt-10 animate-[pc-page-enter_220ms_ease-out_both] motion-reduce:animate-none">
            <h1 className="max-w-[320px] text-3xl font-bold leading-tight tracking-tight">
              管理当前已启用的能力
            </h1>
            <p className="mt-4 max-w-[384px] text-sm leading-6 text-white/80">
              安全登录后，继续管理用户资料、养宠内容与社区互动。
            </p>
            <div className="mt-7 flex flex-wrap gap-2 text-xs font-medium text-white/90">
              <span className="rounded-full border border-white/20 bg-white/10 px-3 py-1.5">
                用户资料
              </span>
              <span className="rounded-full border border-white/20 bg-white/10 px-3 py-1.5">
                内容治理
              </span>
              <span className="rounded-full border border-white/20 bg-white/10 px-3 py-1.5">
                权限管理
              </span>
            </div>
          </div>
        </aside>

        <div className="flex min-h-[600px] flex-col bg-surface p-6 sm:p-8 md:p-10">
          <BrandLogo
            className="mb-6 h-12 w-auto self-start md:hidden"
            label="PetCare 管理后台"
            variant="color"
          />
          <div className="mb-6">
            <p
              data-testid="login-welcome-label"
              className="text-sm font-semibold text-text-secondary"
            >
              欢迎回来
            </p>
            <h2 className="mt-2 text-2xl font-bold text-text-primary">登录 PetCare</h2>
            <p className="mt-2 text-sm text-text-secondary">使用管理员身份继续</p>
            {typeof location.state === "object" &&
            location.state !== null &&
            "message" in location.state &&
            typeof location.state.message === "string" ? (
              <p
                role="status"
                className="mt-3 rounded-lg border border-success-border bg-success-soft px-3 py-2 text-sm text-success"
              >
                {location.state.message}
              </p>
            ) : null}
          </div>

          <div
            className="relative mb-6 grid grid-cols-2 rounded-lg bg-surface-muted p-1"
            role="tablist"
          >
            <span
              aria-hidden="true"
              data-testid="login-mode-indicator"
              className={`pointer-events-none absolute inset-y-1 left-1 w-[calc(50%-4px)] rounded-md bg-surface shadow-sm transition-transform duration-[220ms] ease-out ${mode === "sms" ? "translate-x-full" : "translate-x-0"}`}
            />
            <button
              type="button"
              role="tab"
              aria-controls="password-login-panel"
              aria-selected={mode === "password"}
              className={`relative z-10 min-h-11 cursor-pointer rounded-md px-3 py-2 text-sm font-medium outline-none transition-colors duration-150 ease-out hover:text-text-primary focus-visible:ring-2 focus-visible:ring-brand-primary ${mode === "password" ? "text-text-primary" : "text-text-secondary"}`}
              onClick={() => {
                setMode("password");
                setError(null);
              }}
            >
              密码登录
            </button>
            <button
              type="button"
              role="tab"
              aria-controls="sms-login-panel"
              aria-selected={mode === "sms"}
              className={`relative z-10 min-h-11 cursor-pointer rounded-md px-3 py-2 text-sm font-medium outline-none transition-colors duration-150 ease-out hover:text-text-primary focus-visible:ring-2 focus-visible:ring-brand-primary ${mode === "sms" ? "text-text-primary" : "text-text-secondary"}`}
              onClick={() => {
                setMode("sms");
                setError(null);
              }}
            >
              验证码登录
            </button>
          </div>

          <form data-testid="login-form" className="flex flex-1 flex-col" onSubmit={handleSubmit}>
            <div data-testid="login-form-panels" className="min-h-[284px] flex-1">
              {mode === "password" ? (
                <div
                  id="password-login-panel"
                  role="tabpanel"
                  className="space-y-5 animate-[pc-page-enter_220ms_ease-out_both] motion-reduce:animate-none"
                >
                  <label className="block text-sm font-medium text-text-secondary">
                    手机号或账号
                    <Input
                      className="mt-2 h-12"
                      autoComplete="username"
                      value={identifier}
                      onChange={(event) => setIdentifier(event.target.value)}
                    />
                  </label>
                  <label className="block text-sm font-medium text-text-secondary">
                    密码
                    <Input
                      type="password"
                      className="mt-2 h-12"
                      autoComplete="current-password"
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                    />
                  </label>
                </div>
              ) : (
                <div
                  id="sms-login-panel"
                  data-testid="sms-login-panel"
                  role="tabpanel"
                  className="space-y-5 animate-[pc-page-enter_220ms_ease-out_both] motion-reduce:animate-none"
                >
                  <label className="block text-sm font-medium text-text-secondary">
                    手机号
                    <Input
                      inputMode="numeric"
                      className="mt-2 h-12"
                      autoComplete="tel"
                      value={phone}
                      onChange={(event) => setPhone(event.target.value)}
                    />
                  </label>
                  <label className="block text-sm font-medium text-text-secondary">
                    验证码
                    <span data-testid="sms-code-row" className="mt-2 flex h-12 items-center gap-2">
                      <Input
                        inputMode="numeric"
                        className="h-12 min-w-0 flex-1"
                        autoComplete="one-time-code"
                        value={code}
                        onChange={(event) => setCode(event.target.value)}
                      />
                      <Button
                        data-testid="send-code-button"
                        className="h-12 w-32 border-brand-primary text-brand-primary hover:bg-brand-soft"
                        disabled={sendingCode || cooldown > 0}
                        intent="secondary"
                        onClick={openCaptchaDialog}
                      >
                        {getSendCodeLabel(cooldown, sendingCode)}
                      </Button>
                    </span>
                  </label>
                </div>
              )}
            </div>

            {error ? (
              <p role="alert" aria-live="polite" className="mt-5 min-h-5 text-sm text-danger">
                {error}
              </p>
            ) : (
              <p aria-hidden="true" className="mt-5 min-h-5" />
            )}

            <Button
              type="submit"
              disabled={pending}
              className="mt-5 h-12 w-full"
              loading={pending}
              size="lg"
            >
              {pending ? "登录中…" : "登录"}
            </Button>
          </form>
        </div>
      </section>
      <CaptchaDialog
        open={captchaOpen}
        challenge={captcha}
        code={captchaCode}
        loading={captchaLoading}
        loadError={captchaLoadError}
        sending={sendingCode}
        onOpenChange={changeCaptchaOpen}
        onCodeChange={setCaptchaCode}
        onRefresh={() => void loadCaptcha()}
        onConfirm={() => void confirmSendCode()}
      />
    </main>
  );
}
