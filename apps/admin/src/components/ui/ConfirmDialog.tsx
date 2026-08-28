import * as Dialog from "@radix-ui/react-dialog";
import type { ReactNode } from "react";
import { Button } from "./Button";

export interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: ReactNode;
  description: ReactNode;
  onConfirm: () => void;
  confirmLabel?: ReactNode;
  cancelLabel?: ReactNode;
  confirmTone?: "primary" | "danger";
  confirmDisabled?: boolean;
  pending?: boolean;
  children?: ReactNode;
}

/** Shared confirmation dialog with safe focus placement and explicit action hierarchy. */
export function ConfirmDialog({
  cancelLabel = "取消",
  children,
  confirmLabel = "确认",
  confirmDisabled = false,
  confirmTone = "primary",
  description,
  onConfirm,
  onOpenChange,
  open,
  pending = false,
  title,
}: ConfirmDialogProps) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-slate-950/45 backdrop-blur-[1px]" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[calc(100vw-32px)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-xl border border-border bg-surface p-6 shadow-float outline-none focus-visible:ring-2 focus-visible:ring-brand-primary">
          <Dialog.Title className="text-lg font-semibold text-text-primary">{title}</Dialog.Title>
          <Dialog.Description className="mt-2 text-sm leading-6 text-text-secondary">
            {description}
          </Dialog.Description>
          {children}
          <div className="mt-6 flex flex-wrap justify-end gap-3">
            <Button
              autoFocus
              disabled={pending}
              intent="secondary"
              onClick={() => onOpenChange(false)}
            >
              {cancelLabel}
            </Button>
            <Button
              disabled={confirmDisabled}
              intent={confirmTone === "danger" ? "danger" : "primary"}
              loading={pending}
              onClick={onConfirm}
            >
              {confirmLabel}
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
