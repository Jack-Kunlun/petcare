import { beforeEach, describe, expect, it, vi } from "vitest";
import { authorizedRequest } from "../state/session";
import {
  confirmBountyIntent,
  createBounty,
  getBountyIntents,
  getBountyProviderEligibility,
  getMyBounties,
  getMyBountyIntents,
  getPublicBounties,
  getPublicBounty,
  submitBountyIntent,
} from "./bounties";
import { rawRequest } from "./request";

vi.mock("../state/session", () => ({ authorizedRequest: vi.fn() }));
vi.mock("./request", () => ({ rawRequest: vi.fn() }));

const authorizedRequestMock = vi.mocked(authorizedRequest);
const rawRequestMock = vi.mocked(rawRequest);

describe("miniapp bounty API", () => {
  beforeEach(() => vi.clearAllMocks());

  it("separates anonymous-safe discovery from authenticated owner routes", async () => {
    rawRequestMock.mockResolvedValue({ list: [] });
    authorizedRequestMock.mockResolvedValue({ list: [] });

    await getPublicBounties({ page: 2, pageSize: 20 });
    await getPublicBounty("bounty/1");
    await getMyBounties({ page: 1, pageSize: 10 });

    expect(rawRequestMock.mock.calls).toEqual([
      ["/bounties?page=2&pageSize=20"],
      ["/bounties/bounty%2F1"],
    ]);
    expect(authorizedRequestMock).toHaveBeenCalledWith("/bounties/mine?page=1&pageSize=10");
  });

  it("posts integer cents without client-owned identity fields", async () => {
    const request = {
      petId: "pet-1",
      serviceType: "feeding" as const,
      serviceTime: "2026-09-03T01:00:00.000Z",
      amountCents: 5_000,
      address: "上海市示例地址",
      remark: null,
    };

    authorizedRequestMock.mockResolvedValue({ id: "bounty-1" });
    await createBounty(request);

    expect(authorizedRequestMock).toHaveBeenCalledWith("/bounties", {
      method: "POST",
      data: request,
    });
  });

  it("keeps qualification, intent, and owner confirmation routes authenticated and encoded", async () => {
    authorizedRequestMock.mockResolvedValue({});

    await getBountyProviderEligibility();
    await getMyBountyIntents({ page: 2, pageSize: 10 });
    await getBountyIntents("bounty/1", { page: 1, pageSize: 20 });
    await submitBountyIntent("bounty/1");
    await confirmBountyIntent("bounty/1", "intent/1");

    expect(authorizedRequestMock.mock.calls).toEqual([
      ["/bounties/provider-eligibility"],
      ["/bounties/intents/mine?page=2&pageSize=10"],
      ["/bounties/bounty%2F1/intents?page=1&pageSize=20"],
      ["/bounties/bounty%2F1/intents", { method: "POST" }],
      ["/bounties/bounty%2F1/intents/intent%2F1/confirm", { method: "POST" }],
    ]);
  });
});
