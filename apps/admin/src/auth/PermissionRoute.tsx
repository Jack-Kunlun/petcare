import { LockKeyhole } from "lucide-react";
import { Outlet } from "react-router-dom";
import { usePermissions } from "./permissions";

interface PermissionRouteProps {
  requireAll: readonly string[];
}

/** 为前端导航提供权限提示；服务端权限守卫仍是最终授权源。 */
export function PermissionRoute({ requireAll }: PermissionRouteProps) {
  const permissions = usePermissions();
  const missing = requireAll.filter((permission) => !permissions.has(permission));

  if (missing.length > 0) {
    return (
      <section
        className="mx-auto max-w-[448px] rounded-xl border border-amber-200 bg-amber-50 p-6 text-amber-950"
        role="alert"
      >
        <LockKeyhole aria-hidden="true" className="h-8 w-8" />
        <h1 className="mt-3 text-xl font-semibold">没有访问权限</h1>
        <p className="mt-2 leading-6">请联系管理员授予 {missing.join("、")} 权限。</p>
      </section>
    );
  }

  return <Outlet />;
}
