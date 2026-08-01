import type { ApiErrorResponse } from "@petcare/shared-types";
import axios from "axios";

const SYSTEM_CONFIG_VERSION_CONFLICT = "SYSTEM_CONFIG_VERSION_CONFLICT";

/** 判断错误是否为系统配置乐观锁版本冲突。 */
export function isSystemConfigVersionConflict(error: unknown): boolean {
  return (
    axios.isAxiosError<ApiErrorResponse>(error) &&
    error.response?.status === 409 &&
    error.response.data?.code === SYSTEM_CONFIG_VERSION_CONFLICT
  );
}
