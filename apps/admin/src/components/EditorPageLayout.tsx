import * as Dialog from "@radix-ui/react-dialog";
import type { ReactNode } from "react";
import type { UnsavedChangesController } from "../hooks/useUnsavedChanges";
import { cn } from "../lib/utils";

type EditorPageWidth = "narrow" | "default" | "wide";

interface EditorPageLayoutProps {
  title: ReactNode;
  children: ReactNode;
  description?: ReactNode;
  back?: ReactNode;
  status?: ReactNode;
  actions?: ReactNode;
  footerActions?: ReactNode;
  unsavedChanges?: UnsavedChangesController;
  width?: EditorPageWidth;
  className?: string;
}

interface FormSectionProps {
  children: ReactNode;
  title?: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  className?: string;
  ariaLabelledBy?: string;
}

const widthClasses: Record<EditorPageWidth, string> = {
  narrow: "max-w-[var(--editor-width-narrow)]",
  default: "max-w-[var(--editor-width-default)]",
  wide: "max-w-[var(--editor-width-wide)]",
};

/** Provides the shared header, content width, and optional footer for editor pages. */
export function EditorPageLayout({
  title,
  children,
  description,
  back,
  status,
  actions,
  footerActions,
  unsavedChanges,
  width = "default",
  className,
}: EditorPageLayoutProps) {
  return (
    <section
      className={cn(
        "editor-page mx-auto flex w-full min-w-0 flex-col gap-6 text-slate-900",
        widthClasses[width],
        className,
      )}
    >
      <header className="editor-page__header sticky top-0 z-10 flex flex-wrap items-start gap-3 bg-slate-50 py-4">
        {back ? <div className="shrink-0">{back}</div> : null}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight text-slate-950">{title}</h1>
            {status ? <div className="shrink-0">{status}</div> : null}
          </div>
          {description ? (
            <div className="mt-1 text-sm leading-6 text-slate-600">{description}</div>
          ) : null}
        </div>
        {actions ? (
          <div className="editor-page__actions flex w-full flex-wrap items-center gap-3 sm:ml-auto sm:w-auto">
            {actions}
          </div>
        ) : null}
      </header>
      <div className="editor-page__content flex min-w-0 flex-col gap-6">{children}</div>
      {footerActions ? (
        <footer className="editor-page__footer flex flex-wrap items-center justify-end gap-3 border-t border-slate-200 bg-white px-6 py-4">
          {footerActions}
        </footer>
      ) : null}
      {unsavedChanges ? (
        <Dialog.Root
          open={unsavedChanges.state === "blocked"}
          onOpenChange={(open) => !open && unsavedChanges.reset()}
        >
          <Dialog.Portal>
            <Dialog.Overlay className="fixed inset-0 z-40 bg-slate-950/45" />
            <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[calc(100vw-32px)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-xl bg-white p-6 shadow-2xl outline-none focus-visible:ring-2 focus-visible:ring-brand-primary">
              <Dialog.Title className="text-lg font-semibold text-slate-950">
                放弃未保存的修改？
              </Dialog.Title>
              <Dialog.Description className="mt-2 text-sm leading-6 text-slate-600">
                当前页面的修改尚未保存，离开后将无法恢复。
              </Dialog.Description>
              <div className="mt-6 flex flex-wrap justify-end gap-3">
                <button
                  autoFocus
                  className="h-10 rounded-md border border-slate-300 bg-white px-4 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={unsavedChanges.state !== "blocked"}
                  onClick={unsavedChanges.reset}
                  type="button"
                >
                  继续编辑
                </button>
                <button
                  className="h-10 rounded-md bg-red-600 px-4 text-sm font-medium text-white transition-colors hover:bg-red-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-600 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={unsavedChanges.state !== "blocked"}
                  onClick={unsavedChanges.proceed}
                  type="button"
                >
                  放弃修改
                </button>
              </div>
            </Dialog.Content>
          </Dialog.Portal>
        </Dialog.Root>
      ) : null}
    </section>
  );
}

/** Groups a page-level form area without owning its fields or business actions. */
export function FormSection({
  children,
  title,
  description,
  actions,
  className,
  ariaLabelledBy,
}: FormSectionProps) {
  const hasHeader = title || description || actions;

  return (
    <section
      aria-labelledby={ariaLabelledBy}
      className={cn("form-section rounded-xl border border-slate-200 bg-white p-6", className)}
    >
      {hasHeader ? (
        <header className="form-section__header flex flex-wrap items-start gap-3">
          <div className="min-w-0 flex-1">
            {title ? <h2 className="text-lg font-semibold text-slate-950">{title}</h2> : null}
            {description ? (
              <div className="mt-1 text-sm leading-6 text-slate-600">{description}</div>
            ) : null}
          </div>
          {actions ? <div className="flex flex-wrap items-center gap-3">{actions}</div> : null}
        </header>
      ) : null}
      <div className={cn("form-section__content", hasHeader && "mt-6")}>{children}</div>
    </section>
  );
}
