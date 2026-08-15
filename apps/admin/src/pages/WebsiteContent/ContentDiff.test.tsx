import type { WebsiteContentDiffItem } from "@petcare/shared-types";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ContentDiff } from "./ContentDiff";

describe("ContentDiff", () => {
  it("renders field paths, values, and change labels", () => {
    const items: WebsiteContentDiffItem[] = [
      { path: "seo.title", before: "旧标题", after: "新标题", changeType: "modified" },
      {
        path: "sections.hero.image",
        before: undefined,
        after: { assetId: "asset-1" },
        changeType: "added",
      },
    ];

    render(<ContentDiff items={items} />);

    expect(screen.getByRole("list", { name: "官网内容字段差异" })).toBeInTheDocument();
    expect(screen.getByText("seo.title")).toBeInTheDocument();
    expect(screen.getByText("旧标题")).toBeInTheDocument();
    expect(screen.getByText("新标题")).toBeInTheDocument();
    expect(screen.getByText("新增")).toBeInTheDocument();
    expect(screen.getByText(/assetId/)).toBeInTheDocument();
  });

  it("communicates that no changes exist", () => {
    render(<ContentDiff items={[]} />);

    expect(screen.getByText("当前草稿与已发布版本没有字段差异。")).toBeInTheDocument();
  });
});
