import { describe, expect, it, vi } from "vitest";
import {
  WEBSITE_PREVIEW_COOKIE,
  createPreviewSessionHandler,
  type PreviewSessionApi,
} from "../pages/preview/session";

function createContext(body: unknown) {
  return {
    request: new Request("https://www.petcare.example/preview/session", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }),
    cookies: { set: vi.fn() },
  };
}

describe("createPreviewSessionHandler", () => {
  it("accepts the fixed Help key for an Admin capability preview", async () => {
    const api: PreviewSessionApi = { getPreview: vi.fn().mockResolvedValue({}) };
    const context = createContext({ contentKey: "help", token: "preview-token" });

    const response = await createPreviewSessionHandler(api)(context as never);

    await expect(response.json()).resolves.toEqual({ path: "/preview/help" });
    expect(api.getPreview).toHaveBeenCalledWith("help", "preview-token");
  });

  it("validates the capability before storing it only in a fixed HttpOnly cookie", async () => {
    const api: PreviewSessionApi = { getPreview: vi.fn().mockResolvedValue({}) };
    const context = createContext({ contentKey: "home", token: "preview-token" });

    const response = await createPreviewSessionHandler(api)(context as never);

    await expect(response.json()).resolves.toEqual({ path: "/preview/home" });
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect(api.getPreview).toHaveBeenCalledWith("home", "preview-token");
    expect(context.cookies.set).toHaveBeenCalledWith(WEBSITE_PREVIEW_COOKIE, "preview-token", {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      path: "/preview",
      maxAge: 600,
    });
  });

  it("rejects malformed exchanges without storing a cookie or calling Nest", async () => {
    const api: PreviewSessionApi = { getPreview: vi.fn() };
    const context = createContext({ contentKey: "not-a-page", token: "preview-token" });

    const response = await createPreviewSessionHandler(api)(context as never);

    expect(response.status).toBe(400);
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect(api.getPreview).not.toHaveBeenCalled();
    expect(context.cookies.set).not.toHaveBeenCalled();
  });

  it("does not create a session cookie when Nest rejects the preview capability", async () => {
    const api: PreviewSessionApi = { getPreview: vi.fn().mockRejectedValue(new Error("expired")) };
    const context = createContext({ contentKey: "home", token: "expired-token" });

    const response = await createPreviewSessionHandler(api)(context as never);

    expect(response.status).toBe(401);
    expect(context.cookies.set).not.toHaveBeenCalled();
  });
});
