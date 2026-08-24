import type { UploadAdminClassroomArticleMediaResponse } from "@petcare/shared-types";
import Image from "@tiptap/extension-image";
import { EditorContent, useEditor, useEditorState } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { useEffect, useState } from "react";
import { showApiError } from "../../../lib/global-error";

const ManagedImage = Image.extend({
  addInputRules() {
    return [];
  },
  addAttributes() {
    return {
      ...this.parent?.(),
      alt: { default: "" },
      "data-asset-id": {
        default: null,
        parseHTML: (element) => element.getAttribute("data-asset-id"),
        renderHTML: (attributes) =>
          attributes["data-asset-id"] ? { "data-asset-id": attributes["data-asset-id"] } : {},
      },
    };
  },
  parseHTML() {
    return [{ tag: 'img[data-asset-id]:not([data-asset-id=""])[src]:not([src^="data:"])' }];
  },
});

interface RichTextEditorProps {
  value: string;
  disabled?: boolean;
  onChange: (value: string) => void;
  onUpload: (file: File) => Promise<UploadAdminClassroomArticleMediaResponse>;
}

/** Edits classroom article HTML using only the supported formatting and managed images. */
export function RichTextEditor({
  value,
  disabled = false,
  onChange,
  onUpload,
}: RichTextEditorProps) {
  const [uploading, setUploading] = useState(false);
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        code: false,
        codeBlock: false,
        underline: false,
        heading: { levels: [2, 3] },
        link: {
          openOnClick: false,
          autolink: false,
          defaultProtocol: "https",
          isAllowedUri: (href) => /^(https?:|mailto:)/iu.test(href),
        },
      }),
      ManagedImage.configure({ allowBase64: false, inline: false }),
    ],
    content: value,
    editable: !disabled,
    editorProps: {
      attributes: { role: "textbox", "aria-label": "文章正文", "aria-multiline": "true" },
    },
    onUpdate: ({ editor: nextEditor }) => onChange(nextEditor.getHTML()),
  });
  const editorState = useEditorState({
    editor,
    selector: ({ editor: currentEditor }) => ({
      paragraph: currentEditor.isActive("paragraph"),
      heading2: currentEditor.isActive("heading", { level: 2 }),
      heading3: currentEditor.isActive("heading", { level: 3 }),
      bold: currentEditor.isActive("bold"),
      italic: currentEditor.isActive("italic"),
      strike: currentEditor.isActive("strike"),
      orderedList: currentEditor.isActive("orderedList"),
      bulletList: currentEditor.isActive("bulletList"),
      blockquote: currentEditor.isActive("blockquote"),
      link: currentEditor.isActive("link"),
      undo: currentEditor.can().undo(),
      redo: currentEditor.can().redo(),
    }),
  });
  const isLocked = disabled || uploading;

  useEffect(() => {
    if (editor.getHTML() !== value) {
      editor.commands.setContent(value, { emitUpdate: false });
    }
  }, [editor, value]);

  useEffect(() => {
    editor.setEditable(!isLocked);
    editor.view.dom.setAttribute("aria-disabled", String(isLocked));
  }, [editor, isLocked]);

  const controls = [
    {
      label: "段落",
      toggle: true,
      active: editorState.paragraph,
      run: () => editor.chain().focus().setParagraph().run(),
    },
    {
      label: "二级标题",
      toggle: true,
      active: editorState.heading2,
      run: () => editor.chain().focus().toggleHeading({ level: 2 }).run(),
    },
    {
      label: "三级标题",
      toggle: true,
      active: editorState.heading3,
      run: () => editor.chain().focus().toggleHeading({ level: 3 }).run(),
    },
    {
      label: "粗体",
      toggle: true,
      active: editorState.bold,
      run: () => editor.chain().focus().toggleBold().run(),
    },
    {
      label: "斜体",
      toggle: true,
      active: editorState.italic,
      run: () => editor.chain().focus().toggleItalic().run(),
    },
    {
      label: "删除线",
      toggle: true,
      active: editorState.strike,
      run: () => editor.chain().focus().toggleStrike().run(),
    },
    {
      label: "有序列表",
      toggle: true,
      active: editorState.orderedList,
      run: () => editor.chain().focus().toggleOrderedList().run(),
    },
    {
      label: "无序列表",
      toggle: true,
      active: editorState.bulletList,
      run: () => editor.chain().focus().toggleBulletList().run(),
    },
    {
      label: "引用",
      toggle: true,
      active: editorState.blockquote,
      run: () => editor.chain().focus().toggleBlockquote().run(),
    },
    {
      label: "撤销",
      toggle: false,
      active: false,
      disabled: !editorState.undo,
      run: () => editor.chain().focus().undo().run(),
    },
    {
      label: "重做",
      toggle: false,
      active: false,
      disabled: !editorState.redo,
      run: () => editor.chain().focus().redo().run(),
    },
  ];

  function editLink(): void {
    const href = window.prompt("请输入 http、https 或 mailto 链接");

    if (href === null) {
      return;
    }

    const normalizedHref = href.trim();

    if (!normalizedHref) {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();

      return;
    }

    if (!/^(https?:|mailto:)/iu.test(normalizedHref)) {
      return;
    }

    editor.chain().focus().extendMarkRange("link").setLink({ href: normalizedHref }).run();
  }

  async function insertImage(file: File): Promise<void> {
    if (isLocked) {
      return;
    }

    setUploading(true);

    try {
      const asset = await onUpload(file);

      editor
        .chain()
        .focus()
        .insertContent({
          type: "image",
          attrs: { src: asset.url, alt: file.name, "data-asset-id": asset.id },
        })
        .run();
    } catch (error) {
      showApiError(error);
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="space-y-2">
      <div
        role="toolbar"
        aria-label="文章格式"
        className="flex flex-wrap gap-2 rounded-t-lg border border-slate-300 bg-slate-50 p-2"
      >
        {controls.map((control) => (
          <button
            key={control.label}
            type="button"
            aria-label={control.label}
            aria-pressed={control.toggle ? control.active : undefined}
            disabled={isLocked || control.disabled}
            onClick={control.run}
            className="min-h-10 cursor-pointer rounded-md border border-slate-300 bg-white px-3 text-sm aria-pressed:border-blue-700 aria-pressed:bg-blue-50 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
          >
            {control.label}
          </button>
        ))}
        <button
          type="button"
          aria-label="链接"
          aria-pressed={editorState.link}
          disabled={isLocked}
          onClick={editLink}
          className="min-h-10 cursor-pointer rounded-md border border-slate-300 bg-white px-3 text-sm aria-pressed:border-blue-700 aria-pressed:bg-blue-50 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
        >
          链接
        </button>
        <label className="inline-flex min-h-10 cursor-pointer items-center rounded-md border border-slate-300 bg-white px-3 text-sm has-[:disabled]:cursor-not-allowed has-[:disabled]:bg-slate-100 has-[:disabled]:text-slate-400">
          插入图片
          <input
            type="file"
            aria-label="插入正文图片"
            accept="image/jpeg,image/png,image/webp"
            disabled={isLocked}
            className="sr-only"
            onChange={(event) => {
              const file = event.currentTarget.files?.[0];

              event.currentTarget.value = "";

              if (file) {
                void insertImage(file);
              }
            }}
          />
        </label>
      </div>
      <EditorContent
        editor={editor}
        className={`min-h-64 rounded-b-lg border border-t-0 border-slate-300 p-4 ${
          isLocked ? "cursor-not-allowed bg-slate-100 [&_.tiptap]:cursor-not-allowed" : "bg-white"
        } [&_.tiptap]:min-h-56 [&_.tiptap]:outline-none [&_.tiptap_a]:text-blue-700 [&_.tiptap_a]:underline [&_.tiptap_blockquote]:border-l-4 [&_.tiptap_blockquote]:border-slate-300 [&_.tiptap_blockquote]:pl-4 [&_.tiptap_h2]:mt-6 [&_.tiptap_h2]:text-xl [&_.tiptap_h2]:font-semibold [&_.tiptap_h3]:mt-5 [&_.tiptap_h3]:text-lg [&_.tiptap_h3]:font-semibold [&_.tiptap_img]:my-4 [&_.tiptap_img]:max-w-full [&_.tiptap_ol]:list-decimal [&_.tiptap_ol]:pl-6 [&_.tiptap_ul]:list-disc [&_.tiptap_ul]:pl-6`}
      />
    </div>
  );
}
