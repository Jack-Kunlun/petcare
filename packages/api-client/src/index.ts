// packages/api-client/src/index.ts

import { UserAPI } from "./endpoints";
import ApiClient from "./http";

export { ApiClientError, toApiClientError, unwrapApiResponse } from "./http";

export class PetCareAPI {
  private client: ApiClient;
  public user: UserAPI;

  constructor(baseURL: string) {
    this.client = new ApiClient(baseURL);
    const http = this.client.getInstance();

    this.user = new UserAPI(http);
  }
}

export default PetCareAPI;
