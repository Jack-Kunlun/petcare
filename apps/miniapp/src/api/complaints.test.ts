import {
  COMPLAINT_STATUS,
  type ComplaintDetail,
  type ComplaintListQuery,
  type ComplaintListResponse,
  type CreateComplaintRequest,
  type SubmitComplaintStatementRequest,
  type WithdrawComplaintRequest,
} from "@petcare/shared-types";
import {
  createComplaint,
  getComplaintDetail,
  listMyComplaints,
  submitFirstResponse,
  submitSecondAppeal,
  withdrawComplaint,
} from "./complaints";
import { apiRequest } from "./request";

jest.mock("./request", () => ({
  apiRequest: jest.fn(),
}));

const detail: ComplaintDetail = {
  id: "complaint-1",
  orderId: "order-1",
  complainantId: "owner-1",
  respondentId: "provider-1",
  complaintType: "service_quality",
  expectedSolution: "重新服务",
  status: COMPLAINT_STATUS.PENDING_RESPONSE,
  reason: "服务步骤缺失",
  evidenceUrls: ["https://cdn.example/evidence.mp4"],
  respondentStatement: null,
  respondentEvidenceUrls: [],
  handlerId: null,
  initialDecision: null,
  finalDecision: null,
  statements: [],
  events: [],
  secondAppealDeadline: null,
  allowedActions: [],
  version: 1,
  createdAt: "2026-07-29T00:00:00.000Z",
  updatedAt: "2026-07-29T00:00:00.000Z",
};

const list: ComplaintListResponse = {
  list: [],
  total: 0,
  page: 2,
  pageSize: 10,
};

const mockedRequest = jest.mocked(apiRequest);

describe("complaints API", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("creates a complaint through the shared request client", async () => {
    const request: CreateComplaintRequest = {
      orderId: "order-1",
      complaintType: "service_quality",
      reason: "服务步骤缺失",
      evidenceUrls: ["https://cdn.example/evidence.mp4"],
      expectedSolution: "重新服务",
    };

    mockedRequest.mockResolvedValue(detail);

    await expect(createComplaint(request)).resolves.toBe(detail);

    expect(mockedRequest).toHaveBeenCalledWith("/complaints", {
      method: "POST",
      data: request,
    });
  });

  it("lists the current user's complaints with pagination", async () => {
    mockedRequest.mockResolvedValue(list);

    const query: ComplaintListQuery = { page: 2, pageSize: 10 };

    await expect(listMyComplaints(query)).resolves.toBe(list);

    expect(mockedRequest).toHaveBeenCalledWith("/complaints?page=2&pageSize=10");
  });

  it("loads a complaint detail", async () => {
    mockedRequest.mockResolvedValue(detail);

    await expect(getComplaintDetail("complaint-1")).resolves.toBe(detail);

    expect(mockedRequest).toHaveBeenCalledWith("/complaints/complaint-1");
  });

  it("submits the first response", async () => {
    const request: SubmitComplaintStatementRequest = {
      statement: "已按约完成全部服务步骤",
      evidenceUrls: ["https://cdn.example/response.mp4"],
      version: 1,
    };

    mockedRequest.mockResolvedValue(detail);

    await expect(submitFirstResponse("complaint-1", request)).resolves.toBe(detail);

    expect(mockedRequest).toHaveBeenCalledWith("/complaints/complaint-1/respond", {
      method: "POST",
      data: request,
    });
  });

  it("submits a second appeal", async () => {
    const request: SubmitComplaintStatementRequest = {
      statement: "新增现场视频能够证明服务步骤缺失",
      evidenceUrls: ["https://cdn.example/new-video.mp4"],
      version: 3,
    };

    mockedRequest.mockResolvedValue(detail);

    await expect(submitSecondAppeal("complaint-1", request)).resolves.toBe(detail);

    expect(mockedRequest).toHaveBeenCalledWith("/complaints/complaint-1/appeals", {
      method: "POST",
      data: request,
    });
  });

  it("withdraws a complaint with its current version", async () => {
    const request: WithdrawComplaintRequest = { version: 2 };

    mockedRequest.mockResolvedValue(detail);

    await expect(withdrawComplaint("complaint-1", request)).resolves.toBe(detail);

    expect(mockedRequest).toHaveBeenCalledWith("/complaints/complaint-1/withdraw", {
      method: "POST",
      data: request,
    });
  });
});
