type SessionExpiredListener = (message: string) => void;

const sessionExpiredListeners = new Set<SessionExpiredListener>();

/** Registers a listener for an unrecoverable authenticated-session failure. */
export function onSessionExpired(listener: SessionExpiredListener): () => void {
  sessionExpiredListeners.add(listener);

  return () => sessionExpiredListeners.delete(listener);
}

/** Notifies listeners that an authenticated session has expired. */
export function emitSessionExpired(message: string): void {
  for (const listener of sessionExpiredListeners) {
    listener(message);
  }
}
