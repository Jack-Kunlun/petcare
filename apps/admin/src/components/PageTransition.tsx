import type { JSX, ReactNode } from "react";

interface PageTransitionProps {
  children: ReactNode;
  className?: string;
}

/** Animates page content into view without changing its behavior. */
export function PageTransition({ children, className }: PageTransitionProps): JSX.Element {
  return (
    <div className={`animate-[pc-page-enter_220ms_ease-out_both]${className ? ` ${className}` : ""}`}>
      {children}
    </div>
  );
}
