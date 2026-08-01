import type { AdminComplaintListItem } from "@petcare/shared-types";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fetchAdminComplaints } from "../../../api/complaints";
import ComplaintWorkQueue from ".";

vi.mock("../../../api/complaints", () => ({
  fetchAdminComplaints: vi.fn(),
}));

const complaint: AdminComplaintListItem = {
  id: "11111111-1111-4111-8111-111111111111",
  caseNumber: "CP20260729001",
  orderId: "ORDER20260729001",
  complaintType: "service_quality",
  complainantId: "owner-1",
  complainant: { id: "owner-1", nickname: "豆包家长", phone: "17600000001" },
  respondentId: "provider-1",
  respondent: { id: "provider-1", nickname: "安心宠护", phone: "17600000002" },
  status: "initial_decided",
  handlerId: "admin-1",
  handler: { id: "admin-1", nickname: "值班管理员", phone: "17600000003" },
  appealDeadlineAt: "2099-08-04T12:00:00.000Z",
  hasFailedExecution: true,
  createdAt: "2026-07-29T00:00:00.000Z",
  updatedAt: "2026-07-29T01:00:00.000Z",
};

function LocationProbe() {
  const location = useLocation();

  return <output data-testid="location">{`${location.pathname}${location.search}`}</output>;
}

function renderPage(initialEntry = "/orders/complaints") {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });

  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <QueryClientProvider client={queryClient}>
        <Routes>
          <Route
            path="/orders/complaints"
            element={
              <>
                <ComplaintWorkQueue />
                <LocationProbe />
              </>
            }
          />
        </Routes>
      </QueryClientProvider>
    </MemoryRouter>,
  );
}

describe("ComplaintWorkQueue", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(fetchAdminComplaints).mockResolvedValue({
      list: [complaint],
      total: 1,
      page: 1,
      pageSize: 20,
    });
  });

  it("loads my work queue by default", async () => {
    renderPage();

    expect((await screen.findAllByText("CP20260729001"))[0]).toBeInTheDocument();
    expect(fetchAdminComplaints).toHaveBeenCalledWith({
      queue: "mine",
      page: 1,
      pageSize: 20,
      keyword: undefined,
      status: undefined,
      handlerId: undefined,
    });
  });

  it("shows all eight work queues and returns to page one when the queue changes", async () => {
    const user = userEvent.setup();

    renderPage("/orders/complaints?page=3");

    for (const label of [
      "待我处理",
      "待认领",
      "待回应",
      "待初裁",
      "申诉期内",
      "待终裁",
      "执行异常",
      "已结案",
    ]) {
      expect(screen.getByRole("button", { name: label })).toBeInTheDocument();
    }

    await user.click(screen.getByRole("button", { name: "待认领" }));

    expect(fetchAdminComplaints).toHaveBeenLastCalledWith(
      expect.objectContaining({ queue: "unassigned", page: 1 }),
    );
    expect(screen.getByTestId("location")).toHaveTextContent("/orders/complaints?");
    expect(screen.getByTestId("location")).toHaveTextContent("queue=unassigned");
    expect(screen.getByTestId("location")).toHaveTextContent("page=1");
  });

  it("normalizes combined URL filters into the complete query", async () => {
    renderPage(
      "/orders/complaints?queue=processing_final&page=2&keyword=%20ORDER-9%20&status=processing_final&handlerId=admin-9",
    );

    await screen.findAllByText("CP20260729001");
    expect(fetchAdminComplaints).toHaveBeenCalledWith({
      queue: "processing_final",
      page: 2,
      pageSize: 20,
      keyword: "ORDER-9",
      status: "processing_final",
      handlerId: "admin-9",
    });
  });

  it("renders an explicit loading state", () => {
    vi.mocked(fetchAdminComplaints).mockReturnValue(new Promise(() => undefined));

    renderPage();

    expect(screen.getByLabelText("正在加载投诉工作队列")).toBeInTheDocument();
  });

  it("renders an explicit empty state", async () => {
    vi.mocked(fetchAdminComplaints).mockResolvedValue({
      list: [],
      total: 0,
      page: 1,
      pageSize: 20,
    });

    renderPage();

    expect(await screen.findByRole("heading", { name: "暂无待处理案件" })).toBeInTheDocument();
  });

  it("explains loading failures and retries", async () => {
    const user = userEvent.setup();

    vi.mocked(fetchAdminComplaints)
      .mockRejectedValueOnce(new Error("network unavailable"))
      .mockResolvedValueOnce({ list: [complaint], total: 1, page: 1, pageSize: 20 });

    renderPage();

    expect(await screen.findByRole("alert")).toHaveTextContent("投诉工作队列加载失败");
    await user.click(screen.getByRole("button", { name: "重新加载" }));
    expect((await screen.findAllByText("CP20260729001"))[0]).toBeInTheDocument();
    expect(fetchAdminComplaints).toHaveBeenCalledTimes(2);
  });

  it("persists pagination in the URL", async () => {
    const user = userEvent.setup();

    vi.mocked(fetchAdminComplaints).mockResolvedValue({
      list: [complaint],
      total: 21,
      page: 1,
      pageSize: 20,
    });

    renderPage();
    await screen.findAllByText("CP20260729001");
    await user.click(screen.getByRole("button", { name: "下一页" }));

    expect(fetchAdminComplaints).toHaveBeenLastCalledWith(
      expect.objectContaining({ queue: "mine", page: 2 }),
    );
    expect(screen.getByTestId("location")).toHaveTextContent("/orders/complaints?page=2");
  });

  it("shows overdue and execution-failure markers with icons and text", async () => {
    renderPage();

    expect((await screen.findAllByText("阶段已超时"))[0]).toBeInTheDocument();
    expect(screen.getAllByText("执行异常")[0]).toBeInTheDocument();
    expect(screen.getAllByLabelText("超时提醒")[0]).toBeInTheDocument();
    expect(screen.getAllByLabelText("执行异常提醒")[0]).toBeInTheDocument();
  });

  it("uses the same response data for the desktop table and narrow-screen cards", async () => {
    renderPage();

    expect(await screen.findByRole("table", { name: "投诉纠纷工作队列表格" })).toBeInTheDocument();
    expect(screen.getByRole("list", { name: "投诉纠纷工作队列卡片" })).toBeInTheDocument();
    const links = screen.getAllByRole("link", { name: "查看案件 CP20260729001" });

    expect(links).toHaveLength(2);
    expect(links[0]).toHaveAttribute(
      "href",
      "/orders/complaints/11111111-1111-4111-8111-111111111111",
    );
  });
});
