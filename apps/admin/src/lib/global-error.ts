import { readApiErrorMessage } from "../api/api-response";

/** Controls whether a new global error can replace the displayed one. */
export type GlobalErrorPriority =
  /** Shows only when no global error is currently displayed. */
  | "normal"
  /** Replaces the displayed error for session-level failures. */
  | "session";

/** Describes the currently displayed global error. */
export interface GlobalErrorSnapshot {
  /** Identifies this display instance so stale timers cannot dismiss a replacement. */
  id: number;
  /** Provides the safe message rendered to the administrator. */
  message: string;
  /** Records the replacement behavior used when this error was shown. */
  priority: GlobalErrorPriority;
}

let sequence = 0;
let snapshot: GlobalErrorSnapshot | null = null;
const listeners = new Set<() => void>();

function emit(): void {
  for (const listener of listeners) {
    listener();
  }
}

/** Shows a global error, preserving an existing error unless this is session priority. */
export function showGlobalError(message: string, priority: GlobalErrorPriority = "normal"): void {
  if (snapshot && priority === "normal") {
    return;
  }

  snapshot = { id: ++sequence, message, priority };
  emit();
}

/** Extracts a safe API error message and shows it through the global error store. */
export function showApiError(error: unknown, priority: GlobalErrorPriority = "normal"): void {
  showGlobalError(readApiErrorMessage(error), priority);
}

/** Dismisses the current error, optionally only when it still matches the expected display id. */
export function dismissGlobalError(expectedId?: number): void {
  if (!snapshot || (expectedId !== undefined && snapshot.id !== expectedId)) {
    return;
  }

  snapshot = null;
  emit();
}

/** Subscribes to global error changes and returns the matching unsubscribe callback. */
export function subscribeGlobalError(listener: () => void): () => void {
  listeners.add(listener);

  return () => listeners.delete(listener);
}

/** Returns the current global error snapshot for external-store consumers. */
export function getGlobalErrorSnapshot(): GlobalErrorSnapshot | null {
  return snapshot;
}
