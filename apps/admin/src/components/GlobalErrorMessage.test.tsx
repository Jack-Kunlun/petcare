import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { dismissGlobalError, showGlobalError } from "../lib/global-error";
import { GlobalErrorMessage } from "./GlobalErrorMessage";

describe("GlobalErrorMessage", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    dismissGlobalError();
  });

  afterEach(() => vi.useRealTimers());

  it("shows only the first normal error for three seconds", () => {
    render(<GlobalErrorMessage />);
    act(() => {
      showGlobalError("第一个错误");
      showGlobalError("被忽略的错误");
    });

    expect(screen.getByRole("alert")).toHaveTextContent("第一个错误");
    act(() => vi.advanceTimersByTime(3_000));
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();

    act(() => showGlobalError("三秒后的新错误"));
    expect(screen.getByRole("alert")).toHaveTextContent("三秒后的新错误");
  });

  it("restarts the timer when a session error takes over", () => {
    render(<GlobalErrorMessage />);
    act(() => showGlobalError("普通错误"));
    act(() => vi.advanceTimersByTime(2_000));
    act(() => showGlobalError("登录状态已失效", "session"));
    act(() => vi.advanceTimersByTime(1_500));

    expect(screen.getByRole("alert")).toHaveTextContent("登录状态已失效");
  });
});
