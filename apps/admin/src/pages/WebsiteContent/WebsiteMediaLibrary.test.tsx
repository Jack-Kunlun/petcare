import type { WebsiteMediaAsset } from "@petcare/shared-types";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { WebsiteMediaLibrary } from "./WebsiteMediaLibrary";

const asset: WebsiteMediaAsset = {
  id: "asset-1",
  originalName: "hero.webp",
  mimeType: "image/webp",
  sizeBytes: 2048,
  width: 1200,
  height: 800,
  checksum: "checksum",
  status: "active",
  publicAsset: {
    id: "asset-1",
    url: "https://cdn.example/hero.webp",
    width: 1200,
    height: 800,
    mimeType: "image/webp",
  },
  createdBy: { id: "admin-1", displayName: "运营管理员" },
  createdAt: "2026-08-12T00:00:00.000Z",
  references: [],
};

describe("WebsiteMediaLibrary", () => {
  it("blocks invalid uploads before calling the Server and archives unreferenced assets", () => {
    const onUpload = vi.fn();
    const onArchive = vi.fn();

    render(
      <WebsiteMediaLibrary
        assets={[asset]}
        query={{ page: 1, pageSize: 20 }}
        total={1}
        onUpload={onUpload}
        onArchive={onArchive}
        onQueryChange={vi.fn()}
      />,
    );

    const input = document.querySelector('input[type="file"]') as HTMLInputElement;

    expect(screen.getByRole("button", { name: "上传图片" })).toHaveClass("h-10");
    expect(screen.getByRole("textbox", { name: "搜索文件名" })).toHaveClass("h-10");
    expect(screen.getByRole("combobox", { name: "素材状态" })).toHaveClass("h-10");
    expect(screen.getByRole("button", { name: "归档" })).toHaveClass("h-10");
    expect(screen.getByRole("button", { name: "上一页" })).toHaveClass("h-10");
    expect(screen.getByRole("button", { name: "下一页" })).toHaveClass("h-10");

    fireEvent.change(input, {
      target: { files: [new File(["x"], "note.txt", { type: "text/plain" })] },
    });
    expect(onUpload).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveTextContent("JPEG、PNG 或 WebP");

    fireEvent.click(screen.getByRole("button", { name: "归档" }));
    expect(onArchive).toHaveBeenCalledWith(asset);
  });

  it("disables archive and explains references", () => {
    const referenced = {
      ...asset,
      references: [
        {
          contentKey: "home" as const,
          versionId: "v1",
          sectionKey: "hero",
          status: "published" as const,
        },
      ],
    };

    render(
      <WebsiteMediaLibrary
        assets={[referenced]}
        query={{ page: 1, pageSize: 20 }}
        total={1}
        onUpload={vi.fn()}
        onArchive={vi.fn()}
        onQueryChange={vi.fn()}
      />,
    );

    expect(screen.getByText(/已被 1 个草稿或发布版本引用/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "已引用" })).toBeDisabled();
  });
});
