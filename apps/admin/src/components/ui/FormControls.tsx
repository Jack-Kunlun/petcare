import {
  forwardRef,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from "react";
import { cn } from "../../lib/utils";

export const controlClassName =
  "w-full rounded-lg border border-border-strong bg-surface text-sm text-text-primary outline-none transition-[border-color,box-shadow,background-color] duration-150 placeholder:text-text-muted hover:border-brand-primary/50 focus-visible:border-brand-primary focus-visible:ring-2 focus-visible:ring-brand-primary/15 disabled:cursor-not-allowed disabled:bg-surface-muted disabled:text-text-disabled";

export interface FieldProps {
  children: ReactNode;
  label: ReactNode;
  htmlFor?: string;
  hint?: ReactNode;
  error?: ReactNode;
  required?: boolean;
  className?: string;
}

/** Groups a control with a consistent label, help, and validation message. */
export function Field({
  children,
  className,
  error,
  hint,
  htmlFor,
  label,
  required = false,
}: FieldProps) {
  let message: ReactNode = null;

  if (error) {
    message = (
      <p className="text-xs leading-5 text-danger" role="alert">
        {error}
      </p>
    );
  } else if (hint) {
    message = <p className="text-xs leading-5 text-text-secondary">{hint}</p>;
  }

  return (
    <div className={cn("space-y-2", className)}>
      <label className="block text-sm font-medium text-text-primary" htmlFor={htmlFor}>
        {label}
        {required ? (
          <span aria-hidden="true" className="ml-1 text-danger">
            *
          </span>
        ) : null}
      </label>
      {children}
      {message}
    </div>
  );
}

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className, ...props }, ref) {
    return <input ref={ref} className={cn(controlClassName, "h-10 px-3", className)} {...props} />;
  },
);

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(
  function Select({ className, ...props }, ref) {
    return (
      <select
        ref={ref}
        className={cn(controlClassName, "h-10 cursor-pointer px-3", className)}
        {...props}
      />
    );
  },
);

export const Textarea = forwardRef<
  HTMLTextAreaElement,
  TextareaHTMLAttributes<HTMLTextAreaElement>
>(function Textarea({ className, ...props }, ref) {
  return (
    <textarea
      ref={ref}
      className={cn(controlClassName, "min-h-28 resize-y px-3 py-2.5", className)}
      {...props}
    />
  );
});
