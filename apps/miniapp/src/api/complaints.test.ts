import {
  COMPLAINT_STATUS,
  type ComplaintDetail,
  type ComplaintListQuery,
  type ComplaintListResponse,
  type CreateComplaintRequest,
  type SubmitComplaintStatementRequest,
  type WithdrawComplaintRequest,
} from "@petcare/shared-types";
import { requestWithSession } from "../auth/auth.session";
import {
  createComplaint,
  getComplaintDetail,
  listMyComplaints,
  submitFirstResponse,
  submitSecondAppeal,
  withdrawComplaint,
} from "./complaints";

jest.mock("../auth/auth.session", () => ({
  requestWithSession: jest.fn(),
}));

const complaintId = "11111111-1111-4111-8111-111111111111";
const orderId = "22222222-2222-4222-8222-222222222222";
const complainantId = "33333333-3333-4333-8333-333333333333";
const respondentId = "44444444-4444-4444-8444-444444444444";

const detail: ComplaintDetail = {
  id: complaintId,
  orderId,
  complainantId,
  respondentId,
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

const mockedRequestWithSession = jest.mocked(requestWithSession);

describe("complaints API", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("creates a complaint through the shared request client", async () => {
    const request: CreateComplaintRequest = {
      orderId,
      complaintType: "service_quality",
      reason: "服务步骤缺失",
      evidenceUrls: ["https://cdn.example/evidence.mp4"],
      expectedSolution: "重新服务",
    };

    mockedRequestWithSession.mockResolvedValue(detail);

    await expect(createComplaint(request)).resolves.toBe(detail);

    expect(mockedRequestWithSession).toHaveBeenCalledWith("/complaints", {
      method: "POST",
      data: request,
    });
  });

  it("lists the current user's complaints with pagination", async () => {
    mockedRequestWithSession.mockResolvedValue(list);

    const query: ComplaintListQuery = { page: 2, pageSize: 10 };

    await expect(listMyComplaints(query)).resolves.toBe(list);

    expect(mockedRequestWithSession).toHaveBeenCalledWith("/complaints?page=2&pageSize=10");
  });

  it("loads a complaint detail", async () => {
    mockedRequestWithSession.mockResolvedValue(detail);

    await expect(getComplaintDetail(complaintId)).resolves.toBe(detail);

    expect(mockedRequestWithSession).toHaveBeenCalledWith(`/complaints/${complaintId}`);
  });

  it("submits the first response", async () => {
    const request: SubmitComplaintStatementRequest = {
      statement: "已按约完成全部服务步骤",
      evidenceUrls: ["https://cdn.example/response.mp4"],
      version: 1,
    };

    mockedRequestWithSession.mockResolvedValue(detail);

    await expect(submitFirstResponse(complaintId, request)).resolves.toBe(detail);

    expect(mockedRequestWithSession).toHaveBeenCalledWith(`/complaints/${complaintId}/respond`, {
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

    mockedRequestWithSession.mockResolvedValue(detail);

    await expect(submitSecondAppeal(complaintId, request)).resolves.toBe(detail);

    expect(mockedRequestWithSession).toHaveBeenCalledWith(`/complaints/${complaintId}/appeals`, {
      method: "POST",
      data: request,
    });
  });

  it("withdraws a complaint with its current version", async () => {
    const request: WithdrawComplaintRequest = { version: 2 };

    mockedRequestWithSession.mockResolvedValue(detail);

    await expect(withdrawComplaint(complaintId, request)).resolves.toBe(detail);

    expect(mockedRequestWithSession).toHaveBeenCalledWith(`/complaints/${complaintId}/withdraw`, {
      method: "POST",
      data: request,
    });
  });
});
