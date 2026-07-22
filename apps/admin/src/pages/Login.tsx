import { FormEvent, useCallback, useEffect, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/auth.context";
import { CaptchaChallenge } from "../auth/auth.types";

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

  return (
    <main className="min-h-screen bg-slate-100 grid place-items-center px-4">
      <section className="w-full max-w-md rounded-2xl bg-white p-8 shadow-xl">
        <div className="mb-8 text-center">
          <p className="text-sm font-medium text-blue-600">PetCare 管理后台</p>
          <h1 className="mt-2 text-2xl font-bold text-slate-900">登录 PetCare</h1>
          <p className="mt-2 text-sm text-slate-500">使用管理员身份继续</p>
        </div>

        <div className="mb-6 grid grid-cols-2 rounded-lg bg-slate-100 p-1" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={mode === "password"}
            className={`rounded-md px-3 py-2 text-sm font-medium ${mode === "password" ? "bg-white text-slate-900 shadow" : "text-slate-500"}`}
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
            aria-selected={mode === "sms"}
            className={`rounded-md px-3 py-2 text-sm font-medium ${mode === "sms" ? "bg-white text-slate-900 shadow" : "text-slate-500"}`}
            onClick={() => {
              setMode("sms");
              setError(null);
            }}
          >
            验证码登录
          </button>
        </div>

        <form className="space-y-5" onSubmit={handleSubmit}>
          {mode === "password" ? (
            <>
              <label className="block text-sm font-medium text-slate-700">
                手机号或账号
                <input
                  className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2.5 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  autoComplete="username"
                  value={identifier}
                  onChange={(event) => setIdentifier(event.target.value)}
                />
              </label>
              <label className="block text-sm font-medium text-slate-700">
                密码
                <input
                  type="password"
                  className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2.5 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  autoComplete="current-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                />
              </label>
            </>
          ) : (
            <>
              <label className="block text-sm font-medium text-slate-700">
                手机号
                <input
                  inputMode="numeric"
                  className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2.5 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  autoComplete="tel"
                  value={phone}
                  onChange={(event) => setPhone(event.target.value)}
                />
              </label>
              <label className="block text-sm font-medium text-slate-700">
                图形验证码
                <span className="mt-2 flex gap-2">
                  <input
                    inputMode="numeric"
                    maxLength={4}
                    className="min-w-0 flex-1 rounded-lg border border-slate-300 px-3 py-2.5 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                    autoComplete="off"
                    value={captchaCode}
                    onChange={(event) => setCaptchaCode(event.target.value)}
                  />
                  {captcha ? (
                    <button
                      type="button"
                      aria-label="图形验证码，点击换一张"
                      className="h-12 w-36 overflow-hidden rounded-lg border border-slate-300 bg-blue-50"
                      onClick={() => void loadCaptcha()}
                    >
                      <img
                        src={captcha.image}
                        alt="图形验证码"
                        className="h-full w-full object-cover"
                      />
                    </button>
                  ) : (
                    <button
                      type="button"
                      aria-label={captchaLoadError ? "重新加载图形验证码" : "正在加载图形验证码"}
                      className="h-12 w-36 rounded-lg border border-slate-300 bg-slate-50 text-xs text-slate-500"
                      disabled={captchaLoading}
                      onClick={() => void loadCaptcha()}
                    >
                      {captchaLoadError ? "加载失败，点击重试" : "加载中…"}
                    </button>
                  )}
                </span>
              </label>
              <label className="block text-sm font-medium text-slate-700">
                验证码
                <span className="mt-2 flex gap-2">
                  <input
                    inputMode="numeric"
                    className="min-w-0 flex-1 rounded-lg border border-slate-300 px-3 py-2.5 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                    autoComplete="one-time-code"
                    value={code}
                    onChange={(event) => setCode(event.target.value)}
                  />
                  <button
                    type="button"
                    className="whitespace-nowrap rounded-lg border border-blue-600 px-3 py-2 text-sm font-medium text-blue-600 disabled:border-slate-300 disabled:text-slate-400"
                    disabled={sendingCode || cooldown > 0}
                    onClick={handleSendCode}
                  >
                    {getSendCodeLabel(cooldown, sendingCode)}
                  </button>
                </span>
              </label>
            </>
          )}

          {error ? (
            <p role="alert" aria-live="polite" className="text-sm text-red-600">
              {error}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={pending}
            className="w-full rounded-lg bg-blue-600 px-4 py-3 font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-300"
          >
            {pending ? "登录中…" : "登录"}
          </button>
        </form>
      </section>
    </main>
  );
}
