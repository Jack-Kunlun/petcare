import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { EditorPageLayout, FormSection } from "./EditorPageLayout";

describe("EditorPageLayout", () => {
  it("renders the shared unsaved-changes confirmation dialog with the stay action focused", () => {
    const reset = vi.fn();
    const proceed = vi.fn();

    render(
      <EditorPageLayout title="编辑文章" unsavedChanges={{ state: "blocked", reset, proceed }}>
        内容
      </EditorPageLayout>,
    );

    expect(screen.getByRole("dialog")).toHaveTextContent("放弃未保存的修改？");
    expect(screen.getByRole("dialog")).toHaveTextContent(
      "当前页面的修改尚未保存，离开后将无法恢复。",
    );
    expect(screen.getByRole("button", { name: "继续编辑" })).toHaveFocus();
    expect(screen.getByRole("button", { name: "继续编辑" })).toHaveClass("focus-visible:ring-2");
    expect(screen.getByRole("button", { name: "放弃修改" })).toHaveClass("focus-visible:ring-2");
  });

  it("renders the stable header, content, and optional footer slots", () => {
    const { container } = render(
      <EditorPageLayout
        title="编辑文章"
        description="更新文章正文"
        back={<button type="button">返回</button>}
        status={<span>草稿</span>}
        actions={<button type="button">保存</button>}
        footerActions={<button type="button">底部保存</button>}
      >
        <p>编辑内容</p>
      </EditorPageLayout>,
    );

    const page = container.querySelector("section.editor-page");
    const header = page?.querySelector("header.editor-page__header");
    const content = page?.querySelector("div.editor-page__content");
    const footer = page?.querySelector("footer.editor-page__footer");

    expect(page).toBeInTheDocument();
    expect(header).toContainElement(screen.getByRole("button", { name: "返回" }));
    expect(header).toHaveTextContent("编辑文章");
    expect(header).toHaveTextContent("更新文章正文");
    expect(header).toHaveTextContent("草稿");
    expect(header).toContainElement(screen.getByRole("button", { name: "保存" }));
    expect(content).toHaveTextContent("编辑内容");
    expect(footer).toContainElement(screen.getByRole("button", { name: "底部保存" }));
    expect(footer).toHaveClass("border-t", "bg-surface", "px-6", "py-4", "gap-3");
  });

  it.each([
    ["narrow", "max-w-[var(--editor-width-narrow)]"],
    ["default", "max-w-[var(--editor-width-default)]"],
    ["wide", "max-w-[var(--editor-width-wide)]"],
  ] as const)("uses the %s editor width token", (width, widthClass) => {
    const { container } = render(
      <EditorPageLayout title="编辑文章" width={width}>
        内容
      </EditorPageLayout>,
    );

    expect(container.querySelector(".editor-page")).toHaveClass(widthClass);
  });

  it("wraps title metadata and actions without creating a persistent scroll overlay", () => {
    const { container } = render(
      <EditorPageLayout
        title="编辑文章"
        description="更新文章正文"
        status={<span>草稿</span>}
        actions={<button type="button">保存</button>}
      >
        内容
      </EditorPageLayout>,
    );

    const header = container.querySelector(".editor-page__header");
    const actions = container.querySelector(".editor-page__actions");

    expect(header).toHaveClass("flex", "flex-wrap");
    expect(header).not.toHaveClass("sticky", "top-0");
    expect(actions).toHaveClass("w-full", "flex-wrap", "sm:w-auto");
  });
});

describe("FormSection", () => {
  it("forwards an aria-labelledby value to its native section", () => {
    const { container } = render(
      <FormSection ariaLabelledBy="recent-history-heading">
        <h2 id="recent-history-heading">最近发布历史</h2>
      </FormSection>,
    );

    expect(container.querySelector("section.form-section")).toHaveAttribute(
      "aria-labelledby",
      "recent-history-heading",
    );
  });

  it("renders heading slots with the shared radius, padding, and section spacing", () => {
    const { container } = render(
      <FormSection
        title="基本信息"
        description="填写文章基本资料"
        actions={<button type="button">重置</button>}
      >
        <p>字段内容</p>
      </FormSection>,
    );

    const section = container.querySelector("section.form-section");
    const header = section?.querySelector("header.form-section__header");
    const content = section?.querySelector("div.form-section__content");

    expect(section).toHaveClass("rounded-xl", "p-6", "shadow-panel");
    expect(header).toHaveClass("flex", "flex-wrap");
    expect(header).toHaveTextContent("基本信息");
    expect(header).toHaveTextContent("填写文章基本资料");
    expect(header).toContainElement(screen.getByRole("button", { name: "重置" }));
    expect(content).toHaveClass("mt-6");
    expect(content).toHaveTextContent("字段内容");
  });
});
