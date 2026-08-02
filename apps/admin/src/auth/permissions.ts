import { useMemo } from "react";
import { useAuth } from "./auth.context";

/** Predicate helpers for checking the authenticated administrator's permission codes. */
export interface PermissionHelpers {
  /** Returns whether the authenticated administrator has one permission code. */
  has(code: string): boolean;
  /** Returns whether the authenticated administrator has every supplied permission code. */
  hasAll(codes: readonly string[]): boolean;
  /** Returns whether the authenticated administrator has at least one supplied permission code. */
  hasAny(codes: readonly string[]): boolean;
}

/**
 * Returns memoized permission predicates based solely on the current AuthContext user.
 *
 * The hook intentionally performs no network requests: server authorization remains the source of truth.
 */
export function usePermissions(): PermissionHelpers {
  const auth = useAuth();
  const permissionSet = useMemo(
    () => new Set(auth.user?.permissions ?? []),
    [auth.user?.permissions],
  );

  return useMemo(
    () => ({
      has: (code: string) => permissionSet.has(code),
      hasAll: (codes: readonly string[]) => codes.every((code) => permissionSet.has(code)),
      hasAny: (codes: readonly string[]) => codes.some((code) => permissionSet.has(code)),
    }),
    [permissionSet],
  );
}

/** Returns whether the authenticated administrator has one specified permission. */
export function usePermission(code: string): boolean {
  return usePermissions().has(code);
}
