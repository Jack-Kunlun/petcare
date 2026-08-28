import { cva, type VariantProps } from "class-variance-authority";
import type { HTMLAttributes } from "react";
import { cn } from "../../lib/utils";

const panelVariants = cva("rounded-xl border border-border bg-surface shadow-panel", {
  variants: {
    padding: {
      none: "",
      sm: "p-4",
      md: "p-5",
      lg: "p-6",
    },
    interactive: {
      true: "transition-[border-color,box-shadow,transform] duration-200 hover:-translate-y-0.5 hover:border-brand-primary/25 hover:shadow-panel-hover",
      false: "",
    },
  },
  defaultVariants: {
    padding: "md",
    interactive: false,
  },
});

export interface PanelProps
  extends HTMLAttributes<HTMLDivElement>, VariantProps<typeof panelVariants> {}

/** Standard content surface for cards, filters, and data regions. */
export function Panel({ className, interactive, padding, ...props }: PanelProps) {
  return <div className={cn(panelVariants({ interactive, padding }), className)} {...props} />;
}
