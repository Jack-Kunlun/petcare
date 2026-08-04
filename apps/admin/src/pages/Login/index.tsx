import type { CaptchaChallenge } from "@petcare/shared-types";
import { FormEvent, useCallback, useEffect, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "../../auth/auth.context";
import { BrandLogo } from "../../components/BrandLogo";

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

  const loadCaptcha = useCallback(async () => {
    setCaptchaLoading(true);
    setCaptchaLoadError(false);
    setCaptcha(null);

    try {
      setCaptcha(await getCaptcha());
    } catch {
      setCaptcha(null);
      setCaptchaLoadError(true);
    } finally {
      setCaptchaLoading(false);
    }
  }, [getCaptcha]);

  useEffect(() => {
    if (mode === "sms") {
      void loadCaptcha();
    }
  }, [loadCaptcha, mode]);

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
    return <div className="min-h-screen grid place-items-center">正在恢复登录状态…</div>;
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
    } catch {
      setError("登录失败，请检查账号或凭据");
    } finally {
      setPending(false);
    }
  }

  async function handleSendCode() {
    setError(null);

    if (!mobilePattern.test(phone)) {
      setError("请输入正确的手机号");

      return;
    }

    if (!captcha || !/^[2-9]{4}$/.test(captchaCode)) {
      setError("请输入 4 位图形验证码");

      return;
    }

    setSendingCode(true);

    try {
      await auth.sendSmsCode(phone, captcha.captchaId, captchaCode);
      setCooldown(60);
    } catch {
      setError("验证码发送失败，请稍后重试");
    } finally {
      setCaptchaCode("");
      await loadCaptcha();
      setSendingCode(false);
    }
  }

  const inputClassName =
    "mt-2 h-12 w-full rounded-lg border border-border bg-white px-3 text-text-primary outline-none transition duration-150 ease-out placeholder:text-text-secondary hover:border-brand-primary/60 focus-visible:border-brand-primary focus-visible:ring-2 focus-visible:ring-brand-primary/20 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-text-secondary";

  return (
    <main className="relative isolate grid min-h-screen place-items-center overflow-hidden bg-page-background p-4 sm:p-6">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0">
        <span className="absolute left-12 top-10 h-40 w-40 rounded-full bg-brand-primary/10 blur-3xl" />
        <span className="absolute bottom-8 right-10 h-52 w-52 rounded-full bg-care-secondary/10 blur-3xl" />
      </div>

      <section className="relative z-10 grid w-full max-w-[896px] overflow-hidden rounded-2xl border border-border bg-white shadow-xl md:grid-cols-[minmax(280px,0.9fr)_minmax(320px,1.1fr)]">
        <aside className="relative flex min-h-72 flex-col justify-between overflow-hidden bg-linear-to-br from-brand-primary via-brand-primary-hover to-slate-950 p-6 text-white sm:p-8 md:min-h-[520px]">
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
            <p className="text-sm font-semibold tracking-wide text-care-secondary">
              PetCare 管理后台
            </p>
            <h1 className="mt-3 max-w-[320px] text-3xl font-bold leading-tight tracking-tight">
              让每一次照护都有回应
            </h1>
            <p className="mt-4 max-w-[384px] text-sm leading-6 text-white/80">
              安全登录后，继续管理宠物服务与用户体验。
            </p>
            <div className="mt-7 flex flex-wrap gap-2 text-xs font-medium text-white/90">
              <span className="rounded-full border border-white/20 bg-white/10 px-3 py-1.5">
                用户管理
              </span>
              <span className="rounded-full border border-white/20 bg-white/10 px-3 py-1.5">
                订单协同
              </span>
              <span className="rounded-full border border-white/20 bg-white/10 px-3 py-1.5">
                权限控制
              </span>
            </div>
          </div>
        </aside>

        <div className="bg-white p-6 sm:p-8 md:p-10">
          <div className="mb-6">
            <p className="text-sm font-medium text-brand-primary">欢迎回来</p>
            <h2 className="mt-2 text-2xl font-bold text-text-primary">登录 PetCare</h2>
            <p className="mt-2 text-sm text-text-secondary">使用管理员身份继续</p>
          </div>

          <div
            className="relative mb-6 grid grid-cols-2 rounded-lg bg-slate-100 p-1"
            role="tablist"
          >
            <span
              aria-hidden="true"
              data-testid="login-mode-indicator"
              className={`pointer-events-none absolute inset-y-1 left-1 w-[calc(50%-4px)] rounded-md bg-white shadow-sm transition-transform duration-[220ms] ease-out ${mode === "sms" ? "translate-x-full" : "translate-x-0"}`}
            />
            <button
              type="button"
              role="tab"
              aria-controls="password-login-panel"
              aria-selected={mode === "password"}
              className={`relative z-10 min-h-11 cursor-pointer rounded-md px-3 py-2 text-sm font-medium transition-colors duration-150 ease-out hover:text-slate-900 active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-primary ${mode === "password" ? "text-slate-900" : "text-slate-500"}`}
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
              className={`relative z-10 min-h-11 cursor-pointer rounded-md px-3 py-2 text-sm font-medium transition-colors duration-150 ease-out hover:text-slate-900 active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-primary ${mode === "sms" ? "text-slate-900" : "text-slate-500"}`}
              onClick={() => {
                setMode("sms");
                setError(null);
              }}
            >
              验证码登录
            </button>
          </div>

          <form className="space-y-5" onSubmit={handleSubmit}>
            <div data-testid="login-form-panels" className="min-h-[240px]">
              {mode === "password" ? (
                <div
                  id="password-login-panel"
                  role="tabpanel"
                  className="space-y-5 animate-[pc-page-enter_220ms_ease-out_both] motion-reduce:animate-none"
                >
                  <label className="block text-sm font-medium text-text-secondary">
                    手机号或账号
                    <input
                      className={inputClassName}
                      autoComplete="username"
                      value={identifier}
                      onChange={(event) => setIdentifier(event.target.value)}
                    />
                  </label>
                  <label className="block text-sm font-medium text-text-secondary">
                    密码
                    <input
                      type="password"
                      className={inputClassName}
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
                    <input
                      inputMode="numeric"
                      className={inputClassName}
                      autoComplete="tel"
                      value={phone}
                      onChange={(event) => setPhone(event.target.value)}
                    />
                  </label>
                  <label className="block text-sm font-medium text-text-secondary">
                    图形验证码
                    <span className="mt-2 flex gap-2">
                      <input
                        data-testid="captcha-code-input"
                        inputMode="numeric"
                        maxLength={4}
                        className={inputClassName.replace("w-full", "min-w-0 flex-1")}
                        autoComplete="off"
                        value={captchaCode}
                        onChange={(event) => setCaptchaCode(event.target.value)}
                      />
                      {captcha ? (
                        <button
                          type="button"
                          aria-label="图形验证码，点击换一张"
                          className="h-12 w-36 shrink-0 cursor-pointer overflow-hidden rounded-lg border border-border bg-page-background px-1 transition duration-150 hover:border-brand-primary active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-primary"
                          onClick={() => void loadCaptcha()}
                        >
                          <img
                            src={captcha.image}
                            alt="图形验证码"
                            className="h-full w-full object-contain"
                            decoding="sync"
                          />
                        </button>
                      ) : (
                        <button
                          type="button"
                          aria-label={
                            captchaLoadError ? "重新加载图形验证码" : "正在加载图形验证码"
                          }
                          className="h-12 w-36 cursor-pointer rounded-lg border border-slate-300 bg-slate-50 text-xs text-slate-500 transition duration-150 hover:border-brand-primary hover:text-brand-primary active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-primary disabled:cursor-not-allowed disabled:opacity-70"
                          disabled={captchaLoading}
                          onClick={() => void loadCaptcha()}
                        >
                          {captchaLoadError ? (
                            "加载失败，点击重试"
                          ) : (
                            <span className="block h-4 w-20 animate-[pc-skeleton-shimmer_220ms_linear_infinite] rounded bg-linear-to-r from-slate-200 via-slate-100 to-slate-200 bg-[length:200%_100%]" />
                          )}
                        </button>
                      )}
                    </span>
                  </label>
                  <label className="block text-sm font-medium text-text-secondary">
                    验证码
                    <span className="mt-2 flex gap-2">
                      <input
                        inputMode="numeric"
                        className={inputClassName.replace("w-full", "min-w-0 flex-1")}
                        autoComplete="one-time-code"
                        value={code}
                        onChange={(event) => setCode(event.target.value)}
                      />
                      <button
                        data-testid="send-code-button"
                        type="button"
                        className="h-12 w-32 shrink-0 cursor-pointer whitespace-nowrap rounded-lg border border-brand-primary px-3 text-sm font-medium text-brand-primary transition duration-150 hover:bg-brand-primary hover:text-white active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-primary disabled:cursor-not-allowed disabled:border-slate-300 disabled:text-slate-400 disabled:hover:bg-transparent"
                        disabled={sendingCode || cooldown > 0}
                        onClick={handleSendCode}
                      >
                        {getSendCodeLabel(cooldown, sendingCode)}
                      </button>
                    </span>
                  </label>
                </div>
              )}
            </div>

            {error ? (
              <p role="alert" aria-live="polite" className="text-sm text-red-600">
                {error}
              </p>
            ) : null}

            <button
              type="submit"
              disabled={pending}
              className="min-h-12 w-full cursor-pointer rounded-lg bg-brand-primary px-4 py-3 font-medium text-white transition duration-150 hover:bg-brand-primary-hover active:scale-[0.99] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-primary disabled:cursor-not-allowed disabled:bg-slate-400"
            >
              {pending ? "登录中…" : "登录"}
            </button>
          </form>
        </div>
      </section>
    </main>
  );
}
