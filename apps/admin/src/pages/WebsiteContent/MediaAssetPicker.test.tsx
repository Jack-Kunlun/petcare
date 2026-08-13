import type { WebsiteMediaAsset } from "@petcare/shared-types";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import * as websiteContentApi from "../../api/website-content";
import { MediaAssetPicker } from "./MediaAssetPicker";

vi.mock("../../api/website-content", async () => {
  const actual = await vi.importActual<typeof import("../../api/website-content")>(
    "../../api/website-content",
  );

  return { ...actual, fetchWebsiteMediaAssets: vi.fn() };
});

const asset: WebsiteMediaAsset = {
  id: "asset-hero",
  originalName: "hero.webp",
  mimeType: "image/webp",
  sizeBytes: 1024,
  width: 1200,
  height: 800,
  checksum: "checksum",
  status: "active",
  publicAsset: {
    id: "asset-hero",
    url: "https://assets.example.com/hero.webp",
    width: 1200,
    height: 800,
    mimeType: "image/webp",
  },
  createdBy: { id: "admin-1", displayName: "运营主管" },
  createdAt: "2026-08-13T00:00:00.000Z",
  references: [],
};

function renderPicker() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const onChange = vi.fn();

  function PickerHarness() {
    const [value, setValue] = useState({ assetId: null as string | null, altText: "原替代文本" });

    return (
      <MediaAssetPicker
        label="首屏图片"
        value={value}
        onChange={(next) => {
          onChange(next);
          setValue(next);
        }}
      />
    );
  }

  render(
    <QueryClientProvider client={queryClient}>
      <PickerHarness />
    </QueryClientProvider>,
  );

  return onChange;
}

describe("MediaAssetPicker", () => {
  it("selects only registered active media and retains contextual alt text", async () => {
    const user = userEvent.setup();

    vi.mocked(websiteContentApi.fetchWebsiteMediaAssets).mockResolvedValue({
      list: [asset],
      total: 1,
      page: 1,
      pageSize: 100,
    });
    const onChange = renderPicker();

    const mediaSelect = await screen.findByRole("combobox", { name: "首屏图片素材" });

    await screen.findByRole("option", { name: /hero\.webp/ });
    await user.selectOptions(mediaSelect, "asset-hero");
    await user.clear(screen.getByRole("textbox", { name: "首屏图片替代文本" }));
    await user.type(screen.getByRole("textbox", { name: "首屏图片替代文本" }), "宠物与照护者");

    expect(onChange).toHaveBeenNthCalledWith(1, { assetId: "asset-hero", altText: "原替代文本" });
    expect(onChange).toHaveBeenLastCalledWith({ assetId: "asset-hero", altText: "宠物与照护者" });
    expect(screen.queryByText(/COS|storageKey|对象路径/i)).toBeNull();
  });
});
