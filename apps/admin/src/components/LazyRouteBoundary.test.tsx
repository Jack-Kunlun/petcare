import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { lazy, Suspense } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { LazyRouteBoundary } from "./LazyRouteBoundary";

const RejectedLazyChunk = lazy(() => Promise.reject(new Error("Loading chunk Settings failed")));

describe("LazyRouteBoundary", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("lazy chunk 加载失败时显示可感知错误并允许整页重试", async () => {
    const user = userEvent.setup();
    const retry = vi.fn();

    vi.spyOn(console, "error").mockImplementation(() => undefined);

    render(
      <LazyRouteBoundary onRetry={retry}>
        <Suspense fallback={<p>正在加载测试路由</p>}>
          <RejectedLazyChunk />
        </Suspense>
      </LazyRouteBoundary>,
    );

    const alert = await screen.findByRole("alert", { name: "页面资源加载失败" });

    expect(alert).toHaveTextContent("系统设置加载失败");
    expect(alert).toHaveTextContent("网络恢复后可重新加载页面");
    await user.click(screen.getByRole("button", { name: "重新加载页面" }));

    expect(retry).toHaveBeenCalledTimes(1);
  });

  it("未提供自定义重试时使用生产默认分支重新加载当前页面", async () => {
    const user = userEvent.setup();
    const reload = vi.fn();

    vi.spyOn(console, "error").mockImplementation(() => undefined);
    vi.stubGlobal("location", { reload });

    render(
      <LazyRouteBoundary>
        <Suspense fallback={<p>正在加载测试路由</p>}>
          <RejectedLazyChunk />
        </Suspense>
      </LazyRouteBoundary>,
    );

    await user.click(
      await screen.findByRole("button", {
        name: "重新加载页面",
      }),
    );

    expect(reload).toHaveBeenCalledTimes(1);
  });
});
