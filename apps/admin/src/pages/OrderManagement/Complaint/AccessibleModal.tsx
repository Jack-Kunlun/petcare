import { useEffect, useRef, type KeyboardEvent, type ReactNode } from "react";

const focusableSelector = [
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "a[href]",
  "[tabindex]:not([tabindex=\"-1\"])",
].join(",");

interface AccessibleModalProps {
  /** 弹窗的无障碍标题标识。 */
  labelledBy: string;
  /** 首次打开时接收焦点的元素选择器。 */
  initialFocusSelector: string;
  /** Escape 触发的当前层关闭行为。 */
  onEscape: () => void;
  /** 弹窗正文。 */
  children: ReactNode;
}

/** 提供焦点圈定、初始聚焦、Escape 关闭与触发点焦点恢复。 */
export function AccessibleModal({
  labelledBy,
  initialFocusSelector,
  onEscape,
  children,
}: AccessibleModalProps) {
  const contentRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const content = contentRef.current;
    const initialFocus = content?.querySelector<HTMLElement>(initialFocusSelector);

    initialFocus?.focus();

    return () => previouslyFocused?.focus();
  }, [initialFocusSelector]);

  /** 将 Tab 与 Shift+Tab 循环限制在当前模态层。 */
  function trapFocus(event: KeyboardEvent<HTMLElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      onEscape();

      return;
    }

    if (event.key !== "Tab") {
      return;
    }

    const focusable = [
      ...(contentRef.current?.querySelectorAll<HTMLElement>(focusableSelector) ?? []),
    ];
    const first = focusable[0];
    const last = focusable[focusable.length - 1];

    if (!first || !last) {
      event.preventDefault();

      return;
    }

    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-950/50 p-4">
      <section
        ref={contentRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        onKeyDown={trapFocus}
        className="my-6 w-full max-w-md rounded-xl bg-white p-6 shadow-2xl"
      >
        {children}
      </section>
    </div>
  );
}
