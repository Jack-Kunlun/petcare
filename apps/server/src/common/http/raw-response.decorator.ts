import { SetMetadata } from "@nestjs/common";

export const RAW_RESPONSE_KEY = "petcare:raw-response";

export const RawResponse = () => SetMetadata(RAW_RESPONSE_KEY, true);
