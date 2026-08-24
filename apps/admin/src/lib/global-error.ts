import { readApiErrorMessage } from "../api/api-response";

export type GlobalErrorPriority = "normal" | "session";

export interface GlobalErrorSnapshot {
  id: number;
  message: string;
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

export function showGlobalError(message: string, priority: GlobalErrorPriority = "normal"): void {
  if (snapshot && priority === "normal") {
    return;
  }

  snapshot = { id: ++sequence, message, priority };
  emit();
}

export function showApiError(error: unknown, priority: GlobalErrorPriority = "normal"): void {
  showGlobalError(readApiErrorMessage(error), priority);
}

export function dismissGlobalError(expectedId?: number): void {
  if (!snapshot || (expectedId !== undefined && snapshot.id !== expectedId)) {
    return;
  }

  snapshot = null;
  emit();
}

export function subscribeGlobalError(listener: () => void): () => void {
  listeners.add(listener);

  return () => listeners.delete(listener);
}

export function getGlobalErrorSnapshot(): GlobalErrorSnapshot | null {
  return snapshot;
}
