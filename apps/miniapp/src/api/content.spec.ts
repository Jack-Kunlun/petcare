import { CLASSROOM_ARTICLE_CATEGORY } from "@petcare/shared-types";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { authorizedRequest, authorizedUpload } from "../state/session";
import {
  createCommunityPost,
  discardCommunityMedia,
  getClassroomArticle,
  getClassroomArticles,
  getMyCommunityPosts,
  uploadCommunityMedia,
} from "./content";
import { rawRequest } from "./request";

vi.mock("./request", () => ({ rawRequest: vi.fn() }));
vi.mock("../state/session", () => ({ authorizedRequest: vi.fn(), authorizedUpload: vi.fn() }));

const rawRequestMock = vi.mocked(rawRequest);
const authorizedRequestMock = vi.mocked(authorizedRequest);
const authorizedUploadMock = vi.mocked(authorizedUpload);

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

  it("uses authenticated community submission and author-only list endpoints", async () => {
    authorizedRequestMock.mockResolvedValue({});

    await createCommunityPost({ content: "今天带旺财散步" });
    await getMyCommunityPosts({ page: 1, pageSize: 20 });

    expect(authorizedRequestMock.mock.calls).toEqual([
      ["/community/posts", { method: "POST", data: { content: "今天带旺财散步" } }],
      ["/community/posts/mine", { data: { page: 1, pageSize: 20 } }],
    ]);
  });

  it("uploads community media through the authenticated native boundary", async () => {
    const onProgress = vi.fn();

    authorizedUploadMock.mockResolvedValue({ id: "asset-1" });
    await uploadCommunityMedia("temp/pet.png", onProgress);

    expect(authorizedUploadMock).toHaveBeenCalledWith(
      "/community/media-assets",
      "temp/pet.png",
      "file",
      {},
      onProgress,
    );

    authorizedRequestMock.mockResolvedValue(undefined);
    await discardCommunityMedia("asset/1");
    expect(authorizedRequestMock).toHaveBeenCalledWith(
      "/community/media-assets/asset%2F1/discard",
      { method: "POST" },
    );
  });
});
