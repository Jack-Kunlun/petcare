import type { PaymentBillReviewEntry } from "@petcare/shared-types";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createBillReview, fetchBillReviews } from "../../api/payment";
import { ReviewPanel } from "./ReviewPanel";

const auth = vi.hoisted(() => ({ permissions: [] as string[] }));

vi.mock("../../auth/auth.context", () => ({
  useAuth: () => ({ user: { id: "admin", permissions: auth.permissions } }),
}));
vi.mock("../../api/payment", () => ({
  createBillReview: vi.fn(),
  fetchBillReviews: vi.fn(),
}));

const saved: PaymentBillReviewEntry = {
  id: "00000000-0000-4000-8000-000000000002",
  runId: "run-1",
  ordinal: 1,
  version: 1,
  actorId: "admin",
  action: "record_outcome",
  status: "documented",
  note: "已核查原始交易",
  evidenceReference: "CASE-123",
  createdAt: "2026-01-03T00:00:00.000Z",
};

function renderPanel(onLock = vi.fn()) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });

  return render(
    <QueryClientProvider client={client}>
      <ReviewPanel runId="run-1" ordinal={1} onLock={onLock} />
    </QueryClientProvider>,
  );
}

describe("ReviewPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("crypto", { randomUUID: () => saved.id });
    auth.permissions = ["payment.bill_read"];
    vi.mocked(fetchBillReviews).mockResolvedValue({
      status: "open",
      version: 0,
      entries: [],
      nextCursor: null,
    });
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("keeps review history read-only without the independent write permission", async () => {
    renderPanel();

    expect(await screen.findByText("只读权限，不能追加处理记录。")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "保存处理记录" })).not.toBeInTheDocument();
  });

  it("holds the original review request after an uncertain result", async () => {
    auth.permissions = [...auth.permissions, "payment.bill_review"];
    vi.mocked(createBillReview)
      .mockRejectedValueOnce(new Error("response lost"))
      .mockResolvedValueOnce(saved);
    const onLock = vi.fn();

    renderPanel(onLock);
    await screen.findByRole("button", { name: "保存处理记录" });
    fireEvent.change(screen.getByLabelText("处理动作"), { target: { value: "record_outcome" } });
    fireEvent.change(screen.getByLabelText(/处理说明/), {
      target: { value: "已核查原始交易" },
    });
    fireEvent.change(screen.getByLabelText(/依据编号/), { target: { value: "CASE-123" } });
    fireEvent.click(screen.getByRole("button", { name: "保存处理记录" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("提交结果未知");
    expect(onLock).toHaveBeenLastCalledWith(true);
    fireEvent.click(screen.getByRole("button", { name: "重试原处理请求" }));
    await waitFor(() => expect(createBillReview).toHaveBeenCalledTimes(2));
    expect(vi.mocked(createBillReview).mock.calls[0][2]).toEqual(
      vi.mocked(createBillReview).mock.calls[1][2],
    );
  });
});
