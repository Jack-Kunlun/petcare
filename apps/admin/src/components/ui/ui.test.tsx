import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AlertTriangle } from "lucide-react";
import { describe, expect, it, vi } from "vitest";
import { Badge } from "./Badge";
import { Button } from "./Button";
import { ConfirmDialog } from "./ConfirmDialog";
import {
  DataPanel,
  DataTable,
  DataTableBody,
  DataTableCell,
  DataTableHead,
  DataTableHeadCell,
  DataTableRow,
  FilterBar,
  Pagination,
} from "./DataList";
import { Field, Input } from "./FormControls";
import { PageHeader, PageShell } from "./PageShell";
import { Panel } from "./Panel";
import { Skeleton, StatePanel } from "./StatePanel";

describe("Admin UI foundation", () => {
  it("applies shared action intent and loading semantics", () => {
    render(
      <Button intent="danger" loading>
        删除
      </Button>,
    );

    const button = screen.getByRole("button", { name: "删除" });

    expect(button).toBeDisabled();
    expect(button).toHaveAttribute("aria-busy", "true");
    expect(button).toHaveClass("bg-danger", "h-10", "focus-visible:ring-2");
  });

  it("renders semantic badges and surfaces", () => {
    render(
      <Panel data-testid="panel" interactive padding="lg">
        <Badge tone="success">正常</Badge>
      </Panel>,
    );

    expect(screen.getByTestId("panel")).toHaveClass("border-border", "shadow-panel", "p-6");
    expect(screen.getByText("正常")).toHaveClass("bg-success-soft", "text-success");
  });

  it("groups a form control with an accessible error", () => {
    render(
      <Field error="请输入标题" htmlFor="title" label="标题" required>
        <Input id="title" />
      </Field>,
    );

    expect(screen.getByRole("textbox", { name: /标题/ })).toHaveClass(
      "h-10",
      "border-border-strong",
    );
    expect(screen.getByRole("alert")).toHaveTextContent("请输入标题");
  });

  it("keeps overview pages on the shared width and heading rhythm", () => {
    render(
      <PageShell data-testid="page">
        <PageHeader actions={<Button>新增</Button>} description="统一描述" title="用户管理" />
      </PageShell>,
    );

    expect(screen.getByTestId("page")).toHaveClass("max-w-[var(--admin-content-width)]", "gap-6");
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("用户管理");
    expect(screen.getByRole("button", { name: "新增" })).toBeInTheDocument();
  });

  it("renders a consistent state and shimmer placeholder", () => {
    const { container } = render(
      <>
        <StatePanel
          description="请稍后重试"
          icon={<AlertTriangle aria-hidden="true" />}
          title="加载失败"
          tone="danger"
        />
        <Skeleton lines={3} />
      </>,
    );

    expect(screen.getByRole("heading", { name: "加载失败" })).toBeInTheDocument();
    expect(container.querySelectorAll(".pc-skeleton")).toHaveLength(3);
  });

  it("focuses the safe action and only confirms explicitly", async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    const onOpenChange = vi.fn();

    render(
      <ConfirmDialog
        confirmLabel="删除"
        confirmTone="danger"
        description="删除后无法恢复。"
        onConfirm={onConfirm}
        onOpenChange={onOpenChange}
        open
        title="删除内容？"
      />,
    );

    expect(screen.getByRole("button", { name: "取消" })).toHaveFocus();
    await user.click(screen.getByRole("button", { name: "删除" }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onOpenChange).not.toHaveBeenCalled();
  });

  it("shares one filter, table, and pagination structure across list pages", async () => {
    const user = userEvent.setup();
    const onPageChange = vi.fn();

    render(
      <>
        <FilterBar aria-label="内容筛选">
          <Input aria-label="关键词" />
        </FilterBar>
        <DataPanel aria-label="内容列表">
          <DataTable minWidthClassName="min-w-[760px]">
            <DataTableHead>
              <tr>
                <DataTableHeadCell>标题</DataTableHeadCell>
              </tr>
            </DataTableHead>
            <DataTableBody>
              <DataTableRow>
                <DataTableCell>示例内容</DataTableCell>
              </DataTableRow>
            </DataTableBody>
          </DataTable>
          <Pagination
            itemLabel="条内容"
            onPageChange={onPageChange}
            page={1}
            pageSize={20}
            total={21}
            totalPages={2}
          />
        </DataPanel>
      </>,
    );

    expect(screen.getByRole("form", { name: "内容筛选" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "内容列表" })).toHaveClass("shadow-panel");
    expect(screen.getByRole("table")).toHaveClass("min-w-[760px]");
    await user.click(screen.getByRole("button", { name: "下一页" }));
    expect(onPageChange).toHaveBeenCalledWith(2);
  });
});
