import type { WebsiteContentDiffItem, PublishWebsiteContentRequest } from "@petcare/shared-types";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { PublishDialog } from "./PublishDialog";

const diff: WebsiteContentDiffItem[] = [
  { path: "seo.title", before: "旧标题", after: "新标题", changeType: "modified" },
];

function renderDialog(onPublish = vi.fn<(request: PublishWebsiteContentRequest) => void>()) {
  render(
    <PublishDialog
      open
      contentKey="home"
      revision={4}
      diff={diff}
      diffLoading={false}
      diffError={false}
      pending={false}
      onOpenChange={vi.fn()}
      onRetryDiff={vi.fn()}
      onPublish={onPublish}
    />,
  );

  return onPublish;
}

describe("PublishDialog", () => {
  it("requires a change summary and a second confirmation before publishing", () => {
    const onPublish = renderDialog();

    expect(screen.getByRole("button", { name: "继续发布" })).toBeDisabled();
    fireEvent.change(screen.getByRole("textbox", { name: "变更摘要" }), {
      target: { value: "更新首页内容" },
    });
    expect(screen.getByText("旧标题")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "继续发布" })).toBeEnabled();
    fireEvent.click(screen.getByRole("button", { name: "继续发布" }));
    expect(screen.getByText("这是第二次确认。发布后新的业务版本会立即对外生效。"))
      .toBeInTheDocument();
    expect(onPublish).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "确认发布" }));
    expect(onPublish).toHaveBeenCalledWith(
      expect.objectContaining({ revision: 4, changeSummary: "更新首页内容", idempotencyKey: expect.any(String) }),
    );
  });

  it("does not allow publishing when the draft diff is unavailable or unsaved", () => {
    const onPublish = vi.fn();
    const { rerender } = render(
      <PublishDialog
        open
        contentKey="home"
        revision={4}
        diff={diff}
        diffLoading
        diffError={false}
        pending={false}
        canPublish={false}
        onOpenChange={vi.fn()}
        onRetryDiff={vi.fn()}
        onPublish={onPublish}
      />,
    );

    expect(screen.getByRole("button", { name: "继续发布" })).toBeDisabled();
    rerender(
      <PublishDialog
        open
        contentKey="home"
        revision={4}
        diff={diff}
        diffLoading={false}
        diffError
        pending={false}
        onOpenChange={vi.fn()}
        onRetryDiff={vi.fn()}
        onPublish={onPublish}
      />,
    );
    expect(screen.getByRole("button", { name: "重试加载差异" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "继续发布" })).toBeDisabled();
  });
});
