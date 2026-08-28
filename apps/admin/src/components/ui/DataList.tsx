import { ChevronLeft, ChevronRight } from "lucide-react";
import type {
  FormHTMLAttributes,
  HTMLAttributes,
  ReactNode,
  TableHTMLAttributes,
  TdHTMLAttributes,
  ThHTMLAttributes,
} from "react";
import { cn } from "../../lib/utils";
import { Button } from "./Button";
import { Panel } from "./Panel";

interface FilterBarProps extends FormHTMLAttributes<HTMLFormElement> {
  children: ReactNode;
}

interface DataPanelProps extends HTMLAttributes<HTMLElement> {
  children: ReactNode;
}

interface DataTableProps extends TableHTMLAttributes<HTMLTableElement> {
  minWidthClassName?: string;
}

interface PaginationProps {
  page: number;
  totalPages: number;
  total: number;
  pageSize: number;
  itemLabel?: string;
  disabled?: boolean;
  onPageChange(page: number): void;
}

interface ListSkeletonProps extends HTMLAttributes<HTMLDivElement> {
  label: string;
  rows?: number;
  rowClassName?: string;
}

/** Consistent panel and spacing for list filters. */
export function FilterBar({ children, className, ...props }: FilterBarProps) {
  return (
    <Panel padding="sm">
      <form className={cn("grid gap-3", className)} {...props}>
        {children}
      </form>
    </Panel>
  );
}

/** Bordered data region shared by table, card-list, loading, and empty states. */
export function DataPanel({ children, className, ...props }: DataPanelProps) {
  return (
    <section
      className={cn(
        "overflow-hidden rounded-xl border border-border bg-surface shadow-panel",
        className,
      )}
      {...props}
    >
      {children}
    </section>
  );
}

/** Scroll-safe table with shared text density. */
export function DataTable({ className, minWidthClassName, ...props }: DataTableProps) {
  return (
    <div className="overflow-x-auto">
      <table
        className={cn("w-full border-collapse text-left text-sm", minWidthClassName, className)}
        {...props}
      />
    </div>
  );
}

export function DataTableHead({ className, ...props }: HTMLAttributes<HTMLTableSectionElement>) {
  return (
    <thead
      className={cn(
        "border-b border-border bg-surface-subtle text-xs font-semibold text-text-secondary",
        className,
      )}
      {...props}
    />
  );
}

export function DataTableBody({ className, ...props }: HTMLAttributes<HTMLTableSectionElement>) {
  return <tbody className={cn("divide-y divide-border", className)} {...props} />;
}

export function DataTableRow({ className, ...props }: HTMLAttributes<HTMLTableRowElement>) {
  return (
    <tr
      className={cn("align-top transition-colors duration-150 hover:bg-page-background", className)}
      {...props}
    />
  );
}

export function DataTableHeadCell({ className, ...props }: ThHTMLAttributes<HTMLTableCellElement>) {
  return <th className={cn("whitespace-nowrap px-5 py-3", className)} scope="col" {...props} />;
}

export function DataTableCell({ className, ...props }: TdHTMLAttributes<HTMLTableCellElement>) {
  return <td className={cn("px-5 py-4", className)} {...props} />;
}

/** Shared result count and previous/next controls. */
export function Pagination({
  disabled = false,
  itemLabel = "条",
  onPageChange,
  page,
  pageSize,
  total,
  totalPages,
}: PaginationProps) {
  return (
    <footer className="flex flex-col gap-3 border-t border-border px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5">
      <p className="text-xs text-text-secondary sm:text-sm">
        第 {page} / {totalPages} 页 · 共 {total} {itemLabel} · 每页 {pageSize} 条
      </p>
      <div className="flex items-center gap-2">
        <Button
          aria-label="上一页"
          disabled={disabled || page <= 1}
          intent="secondary"
          onClick={() => onPageChange(Math.max(1, page - 1))}
          size="iconSm"
        >
          <ChevronLeft aria-hidden="true" className="h-4 w-4" />
        </Button>
        <Button
          aria-label="下一页"
          disabled={disabled || page >= totalPages}
          intent="secondary"
          onClick={() => onPageChange(Math.min(totalPages, page + 1))}
          size="iconSm"
        >
          <ChevronRight aria-hidden="true" className="h-4 w-4" />
        </Button>
      </div>
    </footer>
  );
}

/** Row-shaped loading placeholder for list pages. */
export function ListSkeleton({
  className,
  label,
  rowClassName = "h-14",
  rows = 5,
  ...props
}: ListSkeletonProps) {
  return (
    <div aria-label={label} className={cn("space-y-3 p-5", className)} {...props}>
      {Array.from({ length: rows }, (_, index) => (
        <div className={cn("pc-skeleton rounded-lg", rowClassName)} key={index} />
      ))}
    </div>
  );
}
