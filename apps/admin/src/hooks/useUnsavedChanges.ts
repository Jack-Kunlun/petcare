import { useCallback, useEffect } from "react";
import { useBlocker } from "react-router-dom";

/** Route-leave controls consumed by the shared editor confirmation dialog. */
export interface UnsavedChangesController {
  state: ReturnType<typeof useBlocker>["state"];
  reset: () => void;
  proceed: () => void;
}

/** Blocks navigation and browser unloads while the owning page has unsaved changes. */
export function useUnsavedChanges(dirty: boolean): UnsavedChangesController {
  const blocker = useBlocker(dirty);

  useEffect(() => {
    if (!dirty) {
      return;
    }

    const preventUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };

    window.addEventListener("beforeunload", preventUnload);

    return () => window.removeEventListener("beforeunload", preventUnload);
  }, [dirty]);

  const reset = useCallback(() => {
    if (blocker.state === "blocked") {
      blocker.reset();
    }
  }, [blocker]);

  const proceed = useCallback(() => {
    if (blocker.state === "blocked") {
      blocker.proceed();
    }
  }, [blocker]);

  return { state: blocker.state, reset, proceed };
}
