import type { WebsiteContentVersion } from "@petcare/shared-types";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { ContentHistory } from "./ContentHistory";

const version: WebsiteContentVersion = {
  id: "version-1",
  contentKey: "home",
  revision: 3,
  businessVersion: 2,
  status: "superseded",
  changeSummary: "更新首页可信度文案",
  seo: { title: "首页", description: "描述", canonicalPath: "/", image: null },
  sections: [],
  sourceVersionId: null,
  createdBy: { id: "admin-1", displayName: "运营管理员" },
  createdAt: "2026-08-12T00:00:00.000Z",
  publishedBy: { id: "admin-1", displayName: "运营管理员" },
  publishedAt: "2026-08-12T00:00:00.000Z",
};

describe("ContentHistory", () => {
  it("links immutable versions and does not call them rollbacks", () => {
    render(
      <MemoryRouter>
        <ContentHistory contentKey="home" items={[version]} selectedVersionId="version-1" />
      </MemoryRouter>,
    );

    const link = screen.getByRole("link", { name: /已发布 v2/ });

    expect(link).toHaveAttribute("href", "/website-content/home/history/version-1");
    expect(link).toHaveAttribute("aria-current", "page");
    expect(screen.queryByText(/回滚/)).not.toBeInTheDocument();
  });

  it("exposes loading, empty, and retry states", () => {
    const { rerender } = render(<ContentHistory contentKey="home" items={[]} loading />);

    expect(screen.getByText("正在加载历史版本…")).toBeInTheDocument();

    rerender(<ContentHistory contentKey="home" items={[]} />);
    expect(screen.getByText("暂无已发布历史版本。")).toBeInTheDocument();

    rerender(<ContentHistory contentKey="home" items={[]} error onRetry={() => undefined} />);
    expect(screen.getByRole("alert")).toHaveTextContent("历史版本加载失败");
    expect(screen.getByRole("button", { name: "重试" })).toBeInTheDocument();
  });
});
