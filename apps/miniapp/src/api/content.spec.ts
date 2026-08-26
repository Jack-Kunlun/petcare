import { beforeEach, describe, expect, it, vi } from "vitest";
import { getClassroomArticle } from "./content";
import { rawRequest } from "./request";

vi.mock("./request", () => ({ rawRequest: vi.fn() }));

const rawRequestMock = vi.mocked(rawRequest);

describe("miniapp content API", () => {
  beforeEach(() => vi.clearAllMocks());

  it("reads a published classroom article with an encoded route value", async () => {
    rawRequestMock.mockResolvedValue({ slug: "article/1" });

    await getClassroomArticle("article/1");

    expect(rawRequestMock).toHaveBeenCalledWith("/content/articles/article%2F1");
  });
});
