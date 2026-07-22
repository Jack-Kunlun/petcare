import { Request } from "express";

export interface RequestWithId extends Request {
  requestId: string;
}

export interface ApiResponseMeta {
  requestId: string;
  timestamp: string;
}

export interface ApiResponseEnvelope<T> {
  code: string;
  message: string;
  data: T;
  meta: ApiResponseMeta;
}
