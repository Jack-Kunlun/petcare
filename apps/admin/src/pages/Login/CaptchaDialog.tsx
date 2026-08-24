import type { CaptchaChallenge } from "@petcare/shared-types";
import * as Dialog from "@radix-ui/react-dialog";

interface CaptchaDialogProps {
  open: boolean;
  challenge: CaptchaChallenge | null;
  code: string;
  loading: boolean;
  loadError: boolean;
  sending: boolean;
  onOpenChange(open: boolean): void;
  onCodeChange(code: string): void;
  onRefresh(): void;
  onConfirm(): void;
}

/** Collects a captcha answer before the administrator sends an SMS code. */
export function CaptchaDialog({
  open,
  challenge,
  code,
  loading,
  loadError,
  sending,
  onOpenChange,
  onCodeChange,
  onRefresh,
  onConfirm,
}: CaptchaDialogProps) {
  const canConfirm = challenge !== null && /^[2-9]{4}$/u.test(code);
  let captchaButtonLabel = "正在加载图形验证码";

  if (loadError) {
    captchaButtonLabel = "重新加载图形验证码";
  } else if (challenge) {
    captchaButtonLabel = "图形验证码，点击换一张";
  }

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-slate-950/45" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[calc(100vw-32px)] max-w-[448px] -translate-x-1/2 -translate-y-1/2 rounded-xl bg-white p-6 shadow-2xl outline-none focus-visible:ring-2 focus-visible:ring-brand-primary">
          <Dialog.Title className="text-lg font-semibold text-slate-950">
            发送短信验证码
          </Dialog.Title>
          <Dialog.Description className="mt-1 text-sm text-slate-600">
            输入图形验证码后再发送短信。
          </Dialog.Description>

          <label className="mt-5 block text-sm font-medium text-slate-700">
            图形验证码
            <input
              inputMode="numeric"
              maxLength={4}
              autoComplete="off"
              disabled={sending || loading || challenge === null}
              value={code}
              onChange={(event) => onCodeChange(event.target.value)}
              className="mt-2 h-11 w-full rounded-lg border border-slate-300 px-3 outline-none focus-visible:border-brand-primary focus-visible:ring-2 focus-visible:ring-brand-primary/20 disabled:cursor-not-allowed disabled:bg-slate-100"
            />
          </label>

          <button
            type="button"
            aria-label={captchaButtonLabel}
            disabled={loading || sending || (!challenge && !loadError)}
            onClick={onRefresh}
            className="mt-3 h-14 w-full cursor-pointer rounded-lg border border-slate-300 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {challenge ? (
              <img
                src={challenge.image}
                alt="图形验证码"
                className="h-full w-full object-contain"
                decoding="sync"
              />
            ) : null}
            {!challenge && loadError ? "加载失败，点击重试" : null}
            {!challenge && !loadError ? "正在加载…" : null}
          </button>

          <div className="mt-5 flex justify-end gap-2">
            <Dialog.Close asChild>
              <button
                type="button"
                disabled={sending}
                className="min-h-11 cursor-pointer rounded-lg border border-slate-300 px-4 text-slate-800 outline-none transition-colors duration-150 hover:bg-slate-50 focus-visible:ring-2 focus-visible:ring-brand-primary disabled:cursor-not-allowed disabled:opacity-50"
              >
                取消
              </button>
            </Dialog.Close>
            <button
              type="button"
              disabled={sending || !canConfirm}
              onClick={onConfirm}
              className="min-h-11 cursor-pointer rounded-lg bg-brand-primary px-4 text-white outline-none transition-colors duration-150 hover:bg-brand-primary-hover focus-visible:ring-2 focus-visible:ring-brand-primary focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:bg-slate-400"
            >
              {sending ? "发送中…" : "确认发送"}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
