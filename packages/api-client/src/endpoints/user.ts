// packages/api-client/src/endpoints/user.ts

import type { PublicUser } from "@petcare/shared-types";
import type { AxiosInstance } from "axios";

export class UserAPI {
  constructor(private http: AxiosInstance) {}

  /**
   * 获取用户详情
   */
  async getUserDetail(userId: string): Promise<PublicUser> {
    const response = await this.http.get<PublicUser>(`/users/${userId}`);

    return response.data;
  }
}
