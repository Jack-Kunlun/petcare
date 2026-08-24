import type { UploadAdminClassroomArticleMediaResponse } from "@petcare/shared-types";
import Image from "@tiptap/extension-image";
import { EditorContent, useEditor, useEditorState } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import {
  Bold,
  ImagePlus,
  Italic,
  Link as LinkIcon,
  List,
  ListOrdered,
  Quote,
  Redo2,
  Strikethrough,
  Undo2,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
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

interface ToolbarButtonProps {
  label: string;
  tooltipId: string;
  icon: LucideIcon;
  pressed?: boolean;
  disabled?: boolean;
  onClick(): void;
}

function ToolbarButton({
  label,
  tooltipId,
  icon: Icon,
  pressed,
  disabled = false,
  onClick,
}: ToolbarButtonProps) {
  return (
    <span className="group/tool relative">
      <button
        type="button"
        aria-label={label}
        aria-describedby={tooltipId}
        aria-pressed={pressed}
        disabled={disabled}
        onClick={onClick}
        className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-md text-slate-600 outline-none transition-colors hover:bg-slate-100 hover:text-slate-950 focus-visible:ring-2 focus-visible:ring-blue-700 aria-pressed:bg-blue-50 aria-pressed:text-blue-700 disabled:cursor-not-allowed disabled:text-slate-300 disabled:hover:bg-transparent"
      >
        <Icon aria-hidden="true" className="h-4 w-4" />
      </button>
      <span
        id={tooltipId}
        role="tooltip"
        className="pointer-events-none absolute bottom-full left-1/2 z-30 mb-2 w-max -translate-x-1/2 rounded-md bg-slate-900 px-2 py-1 text-xs font-normal text-white opacity-0 transition-opacity group-hover/tool:opacity-100 group-focus-within/tool:opacity-100"
      >
        {label}
      </span>
    </span>
  );
}

/** Edits classroom article HTML using only the supported formatting and managed images. */
export function RichTextEditor({
  value,
  disabled = false,
  onChange,
  onUpload,
}: RichTextEditorProps) {
  const [uploading, setUploading] = useState(false);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const tooltipPrefix = useId();
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
      block: currentEditor.isActive("heading", { level: 2 })
        ? "heading2"
        : (currentEditor.isActive("heading", { level: 3 })
          ? "heading3"
          : "paragraph"),
      empty: currentEditor.isEmpty,
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
    editor.setEditable(!isLocked, false);
    editor.view.dom.setAttribute("aria-disabled", String(isLocked));
  }, [editor, isLocked]);

  const controlGroups = [
    [
      {
        label: "粗体",
        icon: Bold,
        pressed: editorState.bold,
        run: () => editor.chain().focus().toggleBold().run(),
      },
      {
        label: "斜体",
        icon: Italic,
        pressed: editorState.italic,
        run: () => editor.chain().focus().toggleItalic().run(),
      },
      {
        label: "删除线",
        icon: Strikethrough,
        pressed: editorState.strike,
        run: () => editor.chain().focus().toggleStrike().run(),
      },
    ],
    [
      {
        label: "无序列表",
        icon: List,
        pressed: editorState.bulletList,
        run: () => editor.chain().focus().toggleBulletList().run(),
      },
      {
        label: "有序列表",
        icon: ListOrdered,
        pressed: editorState.orderedList,
        run: () => editor.chain().focus().toggleOrderedList().run(),
      },
      {
        label: "引用",
        icon: Quote,
        pressed: editorState.blockquote,
        run: () => editor.chain().focus().toggleBlockquote().run(),
      },
    ],
    [
      {
        label: "撤销",
        icon: Undo2,
        disabled: !editorState.undo,
        run: () => editor.chain().focus().undo().run(),
      },
      {
        label: "重做",
        icon: Redo2,
        disabled: !editorState.redo,
        run: () => editor.chain().focus().redo().run(),
      },
    ],
  ];

  function setTextStyle(style: string): void {
    if (style === "heading2") {
      editor.chain().focus().setHeading({ level: 2 }).run();
    } else if (style === "heading3") {
      editor.chain().focus().setHeading({ level: 3 }).run();
    } else {
      editor.chain().focus().setParagraph().run();
    }
  }

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
    <div
      data-rich-text-editor
      className="overflow-hidden rounded-xl border border-border bg-white transition-[border-color,box-shadow] focus-within:border-blue-700 focus-within:ring-2 focus-within:ring-blue-700/15"
    >
      <div
        role="toolbar"
        aria-label="文章格式"
        className="flex min-h-12 flex-wrap items-center gap-1 border-b border-border bg-white px-3 py-2"
      >
        <label>
          <span className="sr-only">文本样式</span>
          <select
            aria-label="文本样式"
            value={editorState.block}
            disabled={isLocked}
            onChange={(event) => setTextStyle(event.target.value)}
            className="h-8 cursor-pointer rounded-md border border-border bg-white px-2 text-sm font-medium text-slate-700 outline-none hover:border-slate-400 focus-visible:border-blue-700 focus-visible:ring-2 focus-visible:ring-blue-700/15 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
          >
            <option value="paragraph">正文</option>
            <option value="heading2">二级标题</option>
            <option value="heading3">三级标题</option>
          </select>
        </label>

        {controlGroups.map((group, groupIndex) => (
          <span key={groupIndex} className="contents">
            <span aria-hidden="true" className="mx-1 h-5 w-px bg-slate-200" />
            <span className="flex items-center gap-1">
              {group.map((control) => (
                <ToolbarButton
                  key={control.label}
                  label={control.label}
                  tooltipId={`${tooltipPrefix}-${control.label}`}
                  icon={control.icon}
                  pressed={"pressed" in control ? control.pressed : undefined}
                  disabled={isLocked || ("disabled" in control && control.disabled)}
                  onClick={control.run}
                />
              ))}
            </span>
          </span>
        ))}

        <span aria-hidden="true" className="mx-1 h-5 w-px bg-slate-200" />
        <span className="flex items-center gap-1">
          <ToolbarButton
            label="链接"
            tooltipId={`${tooltipPrefix}-link`}
            icon={LinkIcon}
            pressed={editorState.link}
            disabled={isLocked}
            onClick={editLink}
          />
          <ToolbarButton
            label="插入图片"
            tooltipId={`${tooltipPrefix}-image`}
            icon={ImagePlus}
            disabled={isLocked}
            onClick={() => imageInputRef.current?.click()}
          />
          <input
            ref={imageInputRef}
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
        </span>
      </div>

      <div
        data-editor-body
        className={`relative min-h-120 ${
          isLocked ? "cursor-not-allowed bg-slate-100" : "bg-white"
        }`}
      >
        {editorState.empty ? (
          <p className="pointer-events-none absolute left-6 top-6 text-base text-slate-400 md:left-7">
            开始撰写文章正文……
          </p>
        ) : null}
        <EditorContent
          editor={editor}
          className={`[&_.tiptap]:mx-auto [&_.tiptap]:box-border [&_.tiptap]:min-h-120 [&_.tiptap]:w-full [&_.tiptap]:max-w-[840px] [&_.tiptap]:px-6 [&_.tiptap]:py-6 [&_.tiptap]:text-base [&_.tiptap]:leading-7 [&_.tiptap]:outline-none md:[&_.tiptap]:px-7 ${
            isLocked ? "[&_.tiptap]:cursor-not-allowed" : ""
          } [&_.tiptap_a]:text-blue-700 [&_.tiptap_a]:underline-offset-2 hover:[&_.tiptap_a]:underline [&_.tiptap_blockquote]:my-4 [&_.tiptap_blockquote]:rounded-r-lg [&_.tiptap_blockquote]:border-l-4 [&_.tiptap_blockquote]:border-blue-700 [&_.tiptap_blockquote]:bg-slate-50 [&_.tiptap_blockquote]:px-4 [&_.tiptap_blockquote]:py-3 [&_.tiptap_h2]:mb-4 [&_.tiptap_h2]:mt-8 [&_.tiptap_h2]:text-2xl [&_.tiptap_h2]:font-semibold [&_.tiptap_h3]:mb-3 [&_.tiptap_h3]:mt-6 [&_.tiptap_h3]:text-xl [&_.tiptap_h3]:font-semibold [&_.tiptap_img]:my-6 [&_.tiptap_img]:max-w-full [&_.tiptap_img]:rounded-lg [&_.tiptap_li]:my-1 [&_.tiptap_ol]:my-3 [&_.tiptap_ol]:list-decimal [&_.tiptap_ol]:pl-6 [&_.tiptap_p]:mb-4 [&_.tiptap_ul]:my-3 [&_.tiptap_ul]:list-disc [&_.tiptap_ul]:pl-6`}
        />
      </div>
    </div>
  );
}
