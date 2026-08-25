import { describe, expect, it } from "vitest";
import { filterFavorites } from "./favorite-filter";

describe("filterFavorites", () => {
  it("returns only items in the selected content category", () => {
    const items = [
      { id: "article-1", kind: "文章" },
      { id: "post-1", kind: "动态" },
      { id: "service-1", kind: "服务" },
    ];

    expect(filterFavorites(items, "动态")).toEqual([{ id: "post-1", kind: "动态" }]);
  });
});
