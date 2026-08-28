import { beforeEach, describe, expect, it, vi } from "vitest";
import { getSafeRequestErrorMessage, MiniappApiError, rawRequest, rawUpload } from "./request";

interface RequestCallbacks {
  success?: (response: {
    statusCode: number;
    data: unknown;
    header: Record<string, string>;
    cookies: string[];
  }) => void;
}

interface UploadCallbacks {
  success?: (response: {
    statusCode: number;
    data: string;
    header: Record<string, string>;
  }) => void;
}

const request = vi.fn();
const uploadFile = vi.fn();
const onProgressUpdate = vi.fn();

function completeRequest(statusCode: number, data: unknown): void {
  const options = request.mock.calls.at(-1)?.[0] as RequestCallbacks;

  options.success?.({ statusCode, data, header: {}, cookies: [] });
}

function completeUpload(statusCode: number, data: unknown): void {
  const options = uploadFile.mock.calls.at(-1)?.[0] as UploadCallbacks;

  options.success?.({ statusCode, data: JSON.stringify(data), header: {} });
}

describe("native Miniapp request boundary", () => {
  beforeEach(() => {
    request.mockReset();
    uploadFile.mockReset();
    onProgressUpdate.mockReset();
    uploadFile.mockReturnValue({ onProgressUpdate });
    vi.stubEnv("VITE_MINIAPP_API_BASE_URL", "https://api.example.test/");
    vi.stubGlobal("uni", { request, uploadFile });
  });

  it("joins the configured URL and unwraps a successful response", async () => {
    const pending = rawRequest<{ id: string }>("/users/me");

    expect(request).toHaveBeenCalledWith(
      expect.objectContaining({ url: "https://api.example.test/users/me" }),
    );
    completeRequest(200, {
      code: "SUCCESS",
      message: "操作成功",
      data: { id: "user-1" },
      meta: { requestId: "request-1", timestamp: "2026-08-24T00:00:00.000Z" },
    });

    await expect(pending).resolves.toEqual({ id: "user-1" });
  });

  it.each([
    {
      label: "missing data",
      envelope: {
        code: "SUCCESS",
        message: "操作成功",
        meta: { requestId: "request-1", timestamp: "2026-08-24T00:00:00.000Z" },
      },
    },
    {
      label: "missing meta",
      envelope: { code: "SUCCESS", message: "操作成功", data: { id: "user-1" } },
    },
    {
      label: "invalid meta",
      envelope: {
        code: "SUCCESS",
        message: "操作成功",
        data: { id: "user-1" },
        meta: { requestId: "", timestamp: "not-a-timestamp" },
      },
    },
  ])("rejects a malformed success envelope with $label", async ({ envelope }) => {
    const pending = rawRequest<{ id: string }>("/users/me");

    completeRequest(200, envelope);

    await expect(pending).rejects.toMatchObject({
      name: "MiniappApiError",
      statusCode: 200,
      code: "INVALID_RESPONSE",
    });
  });

  it("throws a typed error from a non-success response envelope", async () => {
    const pending = rawRequest("/users/me");

    completeRequest(403, {
      code: "PROFILE_INCOMPLETE",
      message: "请先完善手机号",
      data: null,
      meta: { requestId: "request-2", timestamp: "2026-08-24T00:00:00.000Z" },
    });

    await expect(pending).rejects.toMatchObject({
      name: "MiniappApiError",
      statusCode: 403,
      code: "PROFILE_INCOMPLETE",
      message: "请先完善手机号",
    });
  });

  it("resolves undefined for a 204 response", async () => {
    const pending = rawRequest<void>("/auth/wechat/logout", { method: "POST" });

    completeRequest(204, "");

    await expect(pending).resolves.toBeUndefined();
  });

  it("uses the same envelope contract for native uploads", async () => {
    const pending = rawUpload<{ avatar: string }>("/users/me/avatar", "temp/avatar.png", "file", {
      Authorization: "Bearer access-token",
    });

    completeUpload(200, {
      code: "SUCCESS",
      message: "操作成功",
      data: { avatar: "https://cdn.example.test/avatar.png" },
      meta: { requestId: "request-3", timestamp: "2026-08-24T00:00:00.000Z" },
    });

    await expect(pending).resolves.toEqual({ avatar: "https://cdn.example.test/avatar.png" });
  });

  it("forwards native upload progress", async () => {
    const onProgress = vi.fn();
    const pending = rawUpload("/community/media-assets", "temp/pet.png", "file", {}, onProgress);
    const listener = onProgressUpdate.mock.calls[0]?.[0] as (event: { progress: number }) => void;

    listener({ progress: 42 });
    completeUpload(200, {
      code: "SUCCESS",
      message: "操作成功",
      data: { id: "asset-1" },
      meta: { requestId: "request-4", timestamp: "2026-08-24T00:00:00.000Z" },
    });

    await pending;
    expect(onProgress).toHaveBeenCalledWith(42);
  });

  it("keeps native failure details out of page-visible messages", async () => {
    const pending = rawRequest("/users/me");
    const options = request.mock.calls.at(-1)?.[0] as {
      fail?: (error: { errMsg: string }) => void;
    };

    options.fail?.({ errMsg: "request:fail url not found" });

    await expect(pending).rejects.toMatchObject({
      statusCode: 0,
      code: "NETWORK_ERROR",
      message: "网络请求失败，请检查网络后重试",
    });
    expect(getSafeRequestErrorMessage(new Error("request:fail"), "操作失败，请重试")).toBe(
      "操作失败，请重试",
    );
  });

  it("maps known transport and configuration errors without changing their contract", () => {
    expect(
      getSafeRequestErrorMessage(
        new MiniappApiError(0, "NETWORK_ERROR", "request:fail"),
        "操作失败",
      ),
    ).toBe("网络请求失败，请检查网络后重试");
    expect(
      getSafeRequestErrorMessage(
        new MiniappApiError(0, "CONFIG_ERROR", "internal config"),
        "操作失败",
      ),
    ).toBe("服务暂不可用，请稍后重试");
    expect(
      getSafeRequestErrorMessage(new MiniappApiError(400, "BAD_INPUT", "请检查输入"), "操作失败"),
    ).toBe("请检查输入");
  });
});
