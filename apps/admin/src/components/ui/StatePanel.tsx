import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "../../lib/utils";

interface StatePanelProps extends Omit<HTMLAttributes<HTMLDivElement>, "title"> {
  title: ReactNode;
  description?: ReactNode;
  icon?: ReactNode;
  action?: ReactNode;
  tone?: "neutral" | "danger";
}

interface SkeletonProps extends HTMLAttributes<HTMLDivElement> {
  lines?: number;
}

/** Standard empty or error state for cards and data regions. */
export function StatePanel({
  action,
  className,
  description,
  icon,
  title,
  tone = "neutral",
  ...props
}: StatePanelProps) {
  return (
    <div
      className={cn(
        "flex min-h-52 flex-col items-center justify-center rounded-xl border border-dashed px-6 py-10 text-center",
        tone === "danger"
          ? "border-danger-border bg-danger-soft"
          : "border-border-strong bg-surface-subtle",
        className,
      )}
      {...props}
    >
      {icon ? (
        <div
          className={cn(
            "mb-4 grid h-11 w-11 place-items-center rounded-xl",
            tone === "danger" ? "bg-white text-danger" : "bg-white text-text-secondary",
          )}
        >
          {icon}
        </div>
      ) : null}
      <h2 className="text-base font-semibold text-text-primary">{title}</h2>
      {description ? (
        <div className="mt-1.5 max-w-lg text-sm leading-6 text-text-secondary">{description}</div>
      ) : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}

/** Shimmer placeholder used while a data region is resolving. */
export function Skeleton({ className, lines = 1, ...props }: SkeletonProps) {
  return (
    <div aria-hidden="true" className={cn("space-y-3", className)} {...props}>
      {Array.from({ length: lines }, (_, index) => (
        <div
          className={cn("pc-skeleton h-4 rounded-md", index === lines - 1 && lines > 1 && "w-2/3")}
          key={index}
        />
      ))}
    </div>
  );
}
