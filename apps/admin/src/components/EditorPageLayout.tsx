import type { ReactNode } from "react";
import type { UnsavedChangesController } from "../hooks/useUnsavedChanges";
import { cn } from "../lib/utils";
import { ConfirmDialog } from "./ui/ConfirmDialog";

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

/** Provides the shared sticky action toolbar, title hierarchy, content width, and optional footer. */
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
        "editor-page isolate mx-auto flex w-full min-w-0 flex-col gap-5 text-text-primary",
        widthClasses[width],
        className,
      )}
    >
      {back || actions ? (
        <div className="editor-page__toolbar sticky -top-4 z-30 flex min-h-14 flex-wrap items-center gap-3 rounded-xl border border-border bg-surface px-3 py-2.5 shadow-panel sm:-top-6 sm:flex-nowrap lg:-top-7 xl:-top-8">
          {back ? <div className="min-w-0 shrink-0">{back}</div> : null}
          {actions ? (
            <div className="editor-page__actions ml-auto flex w-full flex-wrap items-center justify-end gap-2 sm:w-auto">
              {actions}
            </div>
          ) : null}
        </div>
      ) : null}
      <header className="editor-page__header min-w-0 px-1 py-1">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <h1 className="text-2xl font-semibold tracking-tight text-text-primary">{title}</h1>
          {status ? <div className="shrink-0">{status}</div> : null}
        </div>
        {description ? (
          <div className="mt-2 max-w-[var(--editor-width-narrow)] text-sm leading-6 text-text-secondary">
            {description}
          </div>
        ) : null}
      </header>
      <div className="editor-page__content flex min-w-0 flex-col gap-6">{children}</div>
      {footerActions ? (
        <footer className="editor-page__footer flex flex-wrap items-center justify-end gap-3 border-t border-border bg-surface px-6 py-4">
          {footerActions}
        </footer>
      ) : null}
      {unsavedChanges ? (
        <ConfirmDialog
          cancelLabel="继续编辑"
          confirmLabel="放弃修改"
          confirmTone="danger"
          description="当前页面的修改尚未保存，离开后将无法恢复。"
          onConfirm={unsavedChanges.proceed}
          onOpenChange={(open) => !open && unsavedChanges.reset()}
          open={unsavedChanges.state === "blocked"}
          title="放弃未保存的修改？"
        />
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
      className={cn(
        "form-section rounded-xl border border-border bg-surface p-6 shadow-panel",
        className,
      )}
    >
      {hasHeader ? (
        <header className="form-section__header flex flex-wrap items-start gap-3">
          <div className="min-w-0 flex-1">
            {title ? <h2 className="text-lg font-semibold text-text-primary">{title}</h2> : null}
            {description ? (
              <div className="mt-1 text-sm leading-6 text-text-secondary">{description}</div>
            ) : null}
          </div>
          {actions ? <div className="flex flex-wrap items-center gap-3">{actions}</div> : null}
        </header>
      ) : null}
      <div className={cn("form-section__content", hasHeader && "mt-6")}>{children}</div>
    </section>
  );
}
