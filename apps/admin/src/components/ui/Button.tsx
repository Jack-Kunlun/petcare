import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { LoaderCircle } from "lucide-react";
import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cn } from "../../lib/utils";

const buttonVariants = cva(
  "inline-flex shrink-0 cursor-pointer select-none items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-semibold outline-none transition-[background-color,border-color,color,box-shadow,transform] duration-150 focus-visible:ring-2 focus-visible:ring-brand-primary focus-visible:ring-offset-2 active:translate-y-px disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-55",
  {
    variants: {
      intent: {
        primary:
          "border border-transparent bg-brand-primary text-white shadow-sm hover:bg-brand-primary-hover active:bg-brand-primary-active",
        secondary:
          "border border-border-strong bg-surface text-text-primary hover:border-brand-primary/50 hover:bg-surface-subtle",
        ghost:
          "border border-transparent bg-transparent text-text-secondary hover:bg-surface-subtle hover:text-text-primary",
        danger:
          "border border-transparent bg-danger text-white shadow-sm hover:bg-danger-strong active:bg-danger-strong",
        dangerOutline:
          "border border-danger-border bg-surface text-danger hover:border-danger/40 hover:bg-danger-soft",
      },
      size: {
        sm: "h-9 px-3",
        md: "h-10 px-4",
        lg: "h-11 px-5",
        icon: "h-10 w-10 p-0",
        iconSm: "h-9 w-9 p-0",
      },
    },
    defaultVariants: {
      intent: "primary",
      size: "md",
    },
  },
);

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  loading?: boolean;
}

/** Shared Admin action with consistent sizing, focus, disabled, and loading states. */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    asChild = false,
    children,
    className,
    disabled = false,
    intent,
    loading = false,
    size,
    type,
    ...props
  },
  ref,
) {
  const classes = cn(buttonVariants({ intent, size }), className);

  if (asChild) {
    return (
      <Slot
        aria-disabled={disabled || undefined}
        className={classes}
        data-disabled={disabled || undefined}
        ref={ref}
        {...props}
      >
        {children}
      </Slot>
    );
  }

  return (
    <button
      ref={ref}
      aria-busy={loading || undefined}
      className={classes}
      disabled={disabled || loading}
      type={type ?? "button"}
      {...props}
    >
      {loading ? <LoaderCircle aria-hidden="true" className="h-4 w-4 animate-spin" /> : null}
      {children}
    </button>
  );
});
