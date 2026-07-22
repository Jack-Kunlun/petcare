import { randomUUID } from "node:crypto";
import { Injectable, NestMiddleware } from "@nestjs/common";
import { NextFunction, Request, Response } from "express";
import { RequestWithId } from "./api-response.types";

const validRequestId = /^[A-Za-z0-9._:-]{1,128}$/;

@Injectable()
export class RequestIdMiddleware implements NestMiddleware {
  use(request: Request, response: Response, next: NextFunction): void {
    const header = request.headers["x-request-id"];
    const incoming = Array.isArray(header) ? header[0] : header;
    const requestId = incoming && validRequestId.test(incoming) ? incoming : randomUUID();

    (request as RequestWithId).requestId = requestId;
    response.setHeader("X-Request-Id", requestId);
    next();
  }
}
