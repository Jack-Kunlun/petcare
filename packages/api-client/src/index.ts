// packages/api-client/src/index.ts

import { UserAPI, OrderAPI } from "./endpoints";
import ApiClient from "./http";

export class PetCareAPI {
  private client: ApiClient;
  public user: UserAPI;
  public order: OrderAPI;

  constructor(baseURL: string) {
    this.client = new ApiClient(baseURL);
    const http = this.client.getInstance();

    this.user = new UserAPI(http);
    this.order = new OrderAPI(http);
  }
}

export default PetCareAPI;
