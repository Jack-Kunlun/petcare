import { WEBSITE_CONTENT_KEY } from "@petcare/shared-types";
import { WebsiteContentHistoryService } from "./website-content-history.service";

describe("WebsiteContentHistoryService", () => {
  it("lists published history and restores a selected version as a new draft", async () => {
    const repository = {
      listHistory: jest.fn(async () => ({
        list: [{ id: "published-1" }],
        total: 1,
        page: 1,
        pageSize: 20,
      })),
      getHistoryVersion: jest.fn(async () => ({ id: "published-1" })),
      restoreAsDraft: jest.fn(async () => ({
        id: "draft-4",
        revision: 4,
        sourceVersionId: "published-1",
      })),
    };
    const service = new WebsiteContentHistoryService(repository as never);

    await expect(
      service.listHistory(WEBSITE_CONTENT_KEY.HOME, { page: 1, pageSize: 20 }),
    ).resolves.toMatchObject({ total: 1 });
    await expect(
      service.getHistoryVersion(WEBSITE_CONTENT_KEY.HOME, "published-1"),
    ).resolves.toMatchObject({ id: "published-1" });
    await expect(
      service.restoreAsDraft({
        contentKey: WEBSITE_CONTENT_KEY.HOME,
        versionId: "published-1",
        revision: 3,
        changeSummary: "恢复首页",
        operatorId: "admin-1",
        requestId: "request-3",
      }),
    ).resolves.toMatchObject({ sourceVersionId: "published-1", revision: 4 });
  });
});
