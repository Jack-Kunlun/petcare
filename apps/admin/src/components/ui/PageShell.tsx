import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "../../lib/utils";

type PageWidth = "reading" | "default" | "wide";

const widthClasses: Record<PageWidth, string> = {
  reading: "max-w-[var(--admin-reading-width)]",
  default: "max-w-[1440px]",
  wide: "max-w-[var(--admin-content-width)]",
};

export interface PageShellProps extends HTMLAttributes<HTMLDivElement> {
  width?: PageWidth;
}

export interface PageHeaderProps extends Omit<HTMLAttributes<HTMLElement>, "title"> {
  title: ReactNode;
  description?: ReactNode;
  eyebrow?: ReactNode;
  meta?: ReactNode;
  actions?: ReactNode;
}

/** Gives Admin pages one responsive content width and vertical rhythm. */
export function PageShell({ className, width = "wide", ...props }: PageShellProps) {
  return (
    <div
      className={cn(
        "mx-auto flex w-full min-w-0 flex-col gap-6 text-text-primary",
        widthClasses[width],
        className,
      )}
      {...props}
    />
  );
}

/** Shared title area for overview and list pages. */
export function PageHeader({
  actions,
  className,
  description,
  eyebrow,
  meta,
  title,
  ...props
}: PageHeaderProps) {
  return (
    <header
      className={cn("flex flex-wrap items-start justify-between gap-4", className)}
      {...props}
    >
      <div className="min-w-0 flex-1">
        {eyebrow ? (
          <div className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-brand-primary">
            {eyebrow}
          </div>
        ) : null}
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold tracking-tight text-text-primary">{title}</h1>
          {meta ? <div className="shrink-0">{meta}</div> : null}
        </div>
        {description ? (
          <div className="mt-1.5 max-w-3xl text-sm leading-6 text-text-secondary">
            {description}
          </div>
        ) : null}
      </div>
      {actions ? <div className="flex w-full flex-wrap gap-3 sm:w-auto">{actions}</div> : null}
    </header>
  );
}
