import { Response } from "express";
import { RequestWithId } from "./api-response.types";
import { RequestIdMiddleware } from "./request-id.middleware";

describe("RequestIdMiddleware", () => {
  it("preserves a valid incoming request id", () => {
    const request = {
      headers: { "x-request-id": "request-123" },
    } as unknown as RequestWithId;
    const response = { setHeader: jest.fn() } as unknown as Response;
    const next = jest.fn();

    new RequestIdMiddleware().use(request, response, next);

    expect(request.requestId).toBe("request-123");
    expect(response.setHeader).toHaveBeenCalledWith("X-Request-Id", "request-123");
    expect(next).toHaveBeenCalledTimes(1);
  });

  it("replaces an invalid incoming request id", () => {
    const request = {
      headers: { "x-request-id": "contains spaces" },
    } as unknown as RequestWithId;
    const response = { setHeader: jest.fn() } as unknown as Response;

    new RequestIdMiddleware().use(request, response, jest.fn());

    expect(request.requestId).toMatch(/^[0-9a-f-]{36}$/);
    expect(response.setHeader).toHaveBeenCalledWith("X-Request-Id", request.requestId);
  });
});
