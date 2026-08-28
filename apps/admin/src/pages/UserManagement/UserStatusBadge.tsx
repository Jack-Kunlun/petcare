import type { AdminUserStatus } from "@petcare/shared-types";
import { Badge } from "../../components/ui";

const userStatusLabels: Record<AdminUserStatus, string> = {
  active: "正常",
  inactive: "未激活",
  banned: "已封禁",
};

const userStatusTones: Record<AdminUserStatus, "success" | "neutral" | "danger"> = {
  active: "success",
  inactive: "neutral",
  banned: "danger",
};

/** 以统一颜色和文案展示后台用户的当前账号状态。 */
export function UserStatusBadge({ status }: { status: AdminUserStatus }) {
  return <Badge tone={userStatusTones[status]}>{userStatusLabels[status]}</Badge>;
}
