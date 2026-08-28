import type { CaptchaChallenge } from "@petcare/shared-types";
import * as Dialog from "@radix-ui/react-dialog";
import { Button, Input } from "../../components/ui";

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
        <Dialog.Overlay className="fixed inset-0 z-40 bg-slate-950/45 backdrop-blur-[1px]" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[calc(100vw-32px)] max-w-[448px] -translate-x-1/2 -translate-y-1/2 rounded-xl border border-border bg-surface p-6 shadow-float outline-none focus-visible:ring-2 focus-visible:ring-brand-primary">
          <Dialog.Title className="text-lg font-semibold text-text-primary">
            发送短信验证码
          </Dialog.Title>
          <Dialog.Description className="mt-1 text-sm text-text-secondary">
            输入图形验证码后再发送短信。
          </Dialog.Description>

          <label className="mt-5 block text-sm font-medium text-text-primary">
            图形验证码
            <Input
              inputMode="numeric"
              maxLength={4}
              autoComplete="off"
              disabled={sending || loading || challenge === null}
              value={code}
              onChange={(event) => onCodeChange(event.target.value)}
              className="mt-2 h-11"
            />
          </label>

          <Button
            aria-label={captchaButtonLabel}
            className="mt-3 h-14 w-full overflow-hidden p-0"
            disabled={loading || sending || (!challenge && !loadError)}
            intent="secondary"
            onClick={onRefresh}
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
          </Button>

          <div className="mt-5 flex justify-end gap-2">
            <Dialog.Close asChild>
              <Button disabled={sending} intent="secondary" size="lg">
                取消
              </Button>
            </Dialog.Close>
            <Button
              disabled={sending || !canConfirm}
              loading={sending}
              onClick={onConfirm}
              size="lg"
            >
              {sending ? "发送中…" : "确认发送"}
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
