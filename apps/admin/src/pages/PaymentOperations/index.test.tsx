import type { PaymentBillRunSummary } from "@petcare/shared-types";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createPaymentBill, fetchPaymentBills, fetchPaymentIssues } from "../../api/payment";
import PaymentOperations from ".";

const auth = vi.hoisted(() => ({ permissions: [] as string[] }));

vi.mock("../../auth/auth.context", () => ({
  useAuth: () => ({ user: { id: "admin", permissions: auth.permissions } }),
}));
vi.mock("../../api/payment", () => ({
  createPaymentBill: vi.fn(),
  fetchPaymentBills: vi.fn(),
  fetchPaymentIssues: vi.fn(),
}));

const run: PaymentBillRunSummary = {
  id: "00000000-0000-4000-8000-000000000001",
  billDate: "2026-01-02",
  requestedById: "admin",
  status: "running",
  fileSha256: null,
  rowCount: null,
  localCount: null,
  differenceCount: 0,
  snapshotAt: null,
  failureCode: null,
  createdAt: "2026-01-03T00:00:00.000Z",
  finishedAt: null,
};

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });

  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={["/payment-operations"]}>
        <PaymentOperations />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("PaymentOperations", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("crypto", { randomUUID: () => "00000000-0000-4000-8000-000000000002" });
    auth.permissions = ["payment.bill_read", "payment.reconciliation_read"];
    vi.mocked(fetchPaymentBills).mockResolvedValue({ list: [run], nextCursor: null });
    vi.mocked(fetchPaymentIssues).mockResolvedValue({ list: [], nextCursor: null });
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("keeps read-only administrators out of the bill action while showing real inspection results", async () => {
    renderPage();

    expect(await screen.findByText(/原始差异 0 项/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "发起日账核对" })).not.toBeInTheDocument();
    expect(screen.getByText(/后台展示不代表外部通知已送达/)).toBeInTheDocument();
  });

  it("retries an uncertain bill request with the original date and idempotency key", async () => {
    auth.permissions = [...auth.permissions, "payment.bill_action"];
    vi.mocked(createPaymentBill)
      .mockRejectedValueOnce(new Error("response lost"))
      .mockResolvedValueOnce(run);
    renderPage();
    await screen.findByText(/原始差异 0 项/);

    fireEvent.click(screen.getByRole("button", { name: "发起日账核对" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("结果尚未确认");
    expect(screen.getByLabelText(/账单日期（中国时间）/)).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "重试原核对请求" }));
    await waitFor(() => expect(createPaymentBill).toHaveBeenCalledTimes(2));
    expect(vi.mocked(createPaymentBill).mock.calls[0][0]).toEqual(
      vi.mocked(createPaymentBill).mock.calls[1][0],
    );
  });

  it("uses the server cursor to show older bill runs", async () => {
    vi.mocked(fetchPaymentBills)
      .mockResolvedValueOnce({ list: [run], nextCursor: run.id })
      .mockResolvedValueOnce({ list: [], nextCursor: null });
    renderPage();
    await screen.findByText(/原始差异 0 项/);

    fireEvent.click(screen.getByRole("button", { name: "下一页日账" }));
    await waitFor(() => expect(fetchPaymentBills).toHaveBeenCalledWith({ after: run.id }));
  });
});
