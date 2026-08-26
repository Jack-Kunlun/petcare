import { CLASSROOM_ARTICLE_CATEGORY } from "@petcare/shared-types";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getClassroomArticle, getClassroomArticles } from "./content";
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

  it("passes public classroom filters through the native GET query", async () => {
    rawRequestMock.mockResolvedValue({ list: [], total: 0, page: 1, pageSize: 10 });
    const query = {
      page: 1,
      pageSize: 10,
      keyword: "幼犬",
      category: CLASSROOM_ARTICLE_CATEGORY.FEEDING_GUIDE,
    };

    await getClassroomArticles(query);

    expect(rawRequestMock).toHaveBeenCalledWith("/content/articles", { data: query });
  });

  it("omits unset public classroom filters from the native GET query", async () => {
    rawRequestMock.mockResolvedValue({ list: [], total: 0, page: 1, pageSize: 10 });

    await getClassroomArticles({
      page: 1,
      pageSize: 10,
      keyword: undefined,
      category: undefined,
    });

    const options = rawRequestMock.mock.calls[0]?.[1];

    expect(Object.keys(options?.data as object)).toEqual(["page", "pageSize"]);
  });
});
