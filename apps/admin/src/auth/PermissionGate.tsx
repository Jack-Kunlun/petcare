import type { ReactNode } from "react";
import { usePermissions } from "./permissions";

/** Props for conditionally rendering a UI control from the current authenticated permissions. */
export interface PermissionGateProps {
  /** Every permission code required to render the children. */
  all?: readonly string[];
  /** At least one permission code required to render the children. */
  any?: readonly string[];
  /** Content to render when the permission requirements are not satisfied. */
  fallback?: ReactNode;
  /** Bypasses permission checks while the gate is explicitly disabled. */
  disabled?: boolean;
  /** Content protected by the permission checks. */
  children: ReactNode;
}

/**
 * Conditionally renders UI from permissions already held in AuthContext.
 *
 * This is a presentation guard only; server-side authorization remains mandatory.
 */
export function PermissionGate({
  all,
  any,
  fallback = null,
  disabled = false,
  children,
}: PermissionGateProps) {
  const permissions = usePermissions();
  const hasRequiredAll = !all || permissions.hasAll(all);
  const hasRequiredAny = !any || permissions.hasAny(any);

  if (!disabled && (!hasRequiredAll || !hasRequiredAny)) {
    return fallback;
  }

  return children;
}
