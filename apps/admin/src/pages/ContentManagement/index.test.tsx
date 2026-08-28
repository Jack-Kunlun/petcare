import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import ContentManagement from ".";

describe("ContentManagement", () => {
  it("只展示社区与课堂两个当前内容入口", () => {
    render(
      <MemoryRouter initialEntries={["/content"]}>
        <ContentManagement />
      </MemoryRouter>,
    );

    expect(screen.getByRole("heading", { name: "内容概览" })).toBeInTheDocument();
    expect(screen.getByText("2 个已启用模块")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "管理社区帖子" })).toHaveAttribute(
      "href",
      "/content/posts",
    );
    expect(screen.getByRole("link", { name: "管理课堂文章" })).toHaveAttribute(
      "href",
      "/content/articles",
    );
    expect(screen.queryByText("悬赏管理")).not.toBeInTheDocument();
    expect(screen.queryByText(/履约状态/)).not.toBeInTheDocument();
    expect(screen.queryByText(/个人版|仅当前内容域/)).not.toBeInTheDocument();
  });
});
