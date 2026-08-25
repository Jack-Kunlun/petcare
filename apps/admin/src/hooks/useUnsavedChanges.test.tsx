import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Link, createMemoryRouter, RouterProvider } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { EditorPageLayout } from "../components/EditorPageLayout";
import { useUnsavedChanges } from "./useUnsavedChanges";

function EditorRoute({ dirty }: { dirty: boolean }) {
  const unsavedChanges = useUnsavedChanges(dirty);

  return (
    <EditorPageLayout title="编辑文章" unsavedChanges={unsavedChanges}>
      <p>编辑中</p>
      <Link to="/next">前往下一页</Link>
    </EditorPageLayout>
  );
}

function createTestRouter(dirty: boolean, initialEntries = ["/"]) {
  return createMemoryRouter(
    [
      { path: "/", element: <EditorRoute dirty={dirty} /> },
      { path: "/next", element: <p>下一页</p> },
    ],
    { initialEntries },
  );
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("useUnsavedChanges", () => {
  it("allows application navigation without a confirmation dialog when clean", async () => {
    const user = userEvent.setup();
    const router = createTestRouter(false);

    render(<RouterProvider router={router} />);

    await user.click(screen.getByRole("link", { name: "前往下一页" }));

    expect(await screen.findByText("下一页")).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("blocks application navigation and lets the user stay or discard changes", async () => {
    const user = userEvent.setup();
    const router = createTestRouter(true);

    render(<RouterProvider router={router} />);

    await user.click(screen.getByRole("link", { name: "前往下一页" }));

    expect(await screen.findByRole("dialog")).toBeInTheDocument();
    expect(router.state.location.pathname).toBe("/");

    await user.click(screen.getByRole("button", { name: "继续编辑" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(router.state.location.pathname).toBe("/");

    await user.click(screen.getByRole("link", { name: "前往下一页" }));
    await user.click(await screen.findByRole("button", { name: "放弃修改" }));
    expect(await screen.findByText("下一页")).toBeInTheDocument();
  });

  it("blocks browser history navigation while dirty", async () => {
    const router = createTestRouter(true, ["/next", "/"]);

    render(<RouterProvider router={router} />);

    await router.navigate(-1);

    expect(await screen.findByRole("dialog")).toBeInTheDocument();
    expect(router.state.location.pathname).toBe("/");
  });

  it("registers beforeunload only while dirty and removes it during cleanup", () => {
    const addEventListener = vi.spyOn(window, "addEventListener");
    const removeEventListener = vi.spyOn(window, "removeEventListener");
    const router = createTestRouter(false);
    const { rerender, unmount } = render(<RouterProvider router={router} />);

    expect(addEventListener).not.toHaveBeenCalledWith("beforeunload", expect.any(Function));

    const dirtyRouter = createTestRouter(true);

    rerender(<RouterProvider router={dirtyRouter} />);
    expect(addEventListener).toHaveBeenCalledWith("beforeunload", expect.any(Function));

    unmount();
    expect(removeEventListener).toHaveBeenCalledWith("beforeunload", expect.any(Function));
  });
});
