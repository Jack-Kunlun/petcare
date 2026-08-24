import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { RichTextEditor } from "./RichTextEditor";

const globalErrors = vi.hoisted(() => ({ showApiError: vi.fn() }));

vi.mock("../../../lib/global-error", () => globalErrors);

describe("RichTextEditor", () => {
  beforeAll(() => {
    Object.defineProperty(document, "elementFromPoint", {
      configurable: true,
      value: () => document.querySelector(".ProseMirror"),
    });
    Object.defineProperty(Range.prototype, "getClientRects", {
      configurable: true,
      value: () => [] as unknown as DOMRectList,
    });
    Object.defineProperty(Range.prototype, "getBoundingClientRect", {
      configurable: true,
      value: () =>
        ({ bottom: 0, height: 0, left: 0, right: 0, top: 0, width: 0, x: 0, y: 0 }) as DOMRect,
    });
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("emits HTML for typed and bold content", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();

    render(<RichTextEditor value="" onChange={onChange} onUpload={vi.fn()} />);

    await user.type(screen.getByRole("textbox", { name: "文章正文" }), "护理知识");
    await user.keyboard("{Control>}a{/Control}");
    await user.click(screen.getByRole("button", { name: "粗体" }));

    await waitFor(() =>
      expect(onChange).toHaveBeenLastCalledWith(
        expect.stringContaining("<strong>护理知识</strong>"),
      ),
    );
  });

  it("uploads and inserts only a managed image node", async () => {
    const onChange = vi.fn();
    const onUpload = vi.fn().mockResolvedValue({
      id: "asset-1",
      url: "https://cdn.example/care.png",
      width: 800,
      height: 600,
      mimeType: "image/png",
    });

    render(<RichTextEditor value="" onChange={onChange} onUpload={onUpload} />);

    fireEvent.change(screen.getByLabelText("插入正文图片"), {
      target: { files: [new File(["png"], "care.png", { type: "image/png" })] },
    });

    await waitFor(() => expect(onUpload).toHaveBeenCalledOnce());
    await waitFor(() =>
      expect(onChange).toHaveBeenLastCalledWith(expect.stringContaining('data-asset-id="asset-1"')),
    );
  });

  it("does not parse an external image without a managed asset id", async () => {
    const onChange = vi.fn();
    const { rerender } = render(<RichTextEditor value="" onChange={onChange} onUpload={vi.fn()} />);

    rerender(
      <RichTextEditor
        value={'<img src="https://cdn.example/unmanaged.png" alt="未托管图片">'}
        onChange={onChange}
        onUpload={vi.fn()}
      />,
    );

    await waitFor(() =>
      expect(screen.getByRole("textbox", { name: "文章正文" }).innerHTML).not.toContain("<img"),
    );
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });

  it("reports a failed image upload through the global message", async () => {
    const failure = { response: { data: { message: "图片上传失败" } } };
    const user = userEvent.setup();

    render(
      <RichTextEditor value="" onChange={vi.fn()} onUpload={vi.fn().mockRejectedValue(failure)} />,
    );

    await user.upload(
      screen.getByLabelText("插入正文图片"),
      new File(["png"], "care.png", { type: "image/png" }),
    );

    await waitFor(() => expect(globalErrors.showApiError).toHaveBeenCalledWith(failure));
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });

  it("uses the fixed image types and disables the actual editor when disabled", async () => {
    render(<RichTextEditor value="" disabled onChange={vi.fn()} onUpload={vi.fn()} />);

    const editor = screen.getByRole("textbox", { name: "文章正文" });
    const fileInput = screen.getByLabelText("插入正文图片");

    expect(fileInput).toHaveAttribute("accept", "image/jpeg,image/png,image/webp");
    expect(fileInput).toBeDisabled();
    expect(screen.getByRole("button", { name: "粗体" })).toBeDisabled();
    await waitFor(() => {
      expect(editor).toHaveAttribute("contenteditable", "false");
      expect(editor).toHaveAttribute("aria-disabled", "true");
    });
  });

  it("does not emit a value change when editability changes", async () => {
    const onChange = vi.fn();
    const { rerender } = render(<RichTextEditor value="" onChange={onChange} onUpload={vi.fn()} />);

    await screen.findByRole("textbox", { name: "文章正文" });
    vi.clearAllMocks();
    rerender(<RichTextEditor value="" disabled onChange={onChange} onUpload={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByRole("textbox", { name: "文章正文" })).toHaveAttribute(
        "contenteditable",
        "false",
      );
    });
    expect(onChange).not.toHaveBeenCalled();
  });

  it("locks the toolbar, file input, and editor while an image uploads", async () => {
    const failure = { response: { data: { message: "图片上传失败" } } };
    const onChange = vi.fn();
    let rejectUpload!: (reason?: unknown) => void;
    const onUpload = vi.fn(
      () =>
        new Promise<never>((_resolve, reject) => {
          rejectUpload = reject;
        }),
    );
    const user = userEvent.setup();

    render(<RichTextEditor value="" onChange={onChange} onUpload={onUpload} />);

    const editor = screen.getByRole("textbox", { name: "文章正文" });
    const fileInput = screen.getByLabelText("插入正文图片");

    await user.upload(fileInput, new File(["png"], "coat.png", { type: "image/png" }));

    await waitFor(() => {
      expect(onUpload).toHaveBeenCalledOnce();
      expect(screen.getByRole("button", { name: "粗体" })).toBeDisabled();
      expect(fileInput).toBeDisabled();
      expect(editor).toHaveAttribute("contenteditable", "false");
      expect(editor).toHaveAttribute("aria-disabled", "true");
    });
    expect(onChange).not.toHaveBeenCalled();

    rejectUpload(failure);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "粗体" })).not.toBeDisabled();
      expect(fileInput).not.toBeDisabled();
      expect(editor).toHaveAttribute("contenteditable", "true");
      expect(editor).toHaveAttribute("aria-disabled", "false");
    });
    expect(onChange).not.toHaveBeenCalled();
  });

  it("applies external values without emitting an editor update", async () => {
    const onChange = vi.fn();
    const { rerender } = render(<RichTextEditor value="" onChange={onChange} onUpload={vi.fn()} />);

    await screen.findByRole("textbox", { name: "文章正文" });
    vi.clearAllMocks();
    rerender(<RichTextEditor value="<h2>外部正文</h2>" onChange={onChange} onUpload={vi.fn()} />);

    await waitFor(() =>
      expect(screen.getByRole("textbox", { name: "文章正文" })).toHaveTextContent("外部正文"),
    );
    expect(onChange).not.toHaveBeenCalled();
  });
});
