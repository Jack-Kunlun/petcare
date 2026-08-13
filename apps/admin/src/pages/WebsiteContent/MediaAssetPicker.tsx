import type { WebsiteImageReference, WebsiteMediaAsset } from "@petcare/shared-types";
import { useQuery } from "@tanstack/react-query";
import { ImagePlus, RefreshCw } from "lucide-react";
import { fetchWebsiteMediaAssets, websiteContentQueryKeys } from "../../api/website-content";
import { inputClassName } from "./editors/fields";

export interface MediaAssetPickerProps {
  /** Visible name of the fixed image-use context. */
  label: string;
  /** Asset identity and required context-specific alternative text. */
  value: WebsiteImageReference;
  /** Replaces the complete image reference without exposing storage details. */
  onChange(value: WebsiteImageReference): void;
  /** Disables selection for read-only operators. */
  disabled?: boolean;
}

function selectedAssetLabel(asset: WebsiteMediaAsset): string {
  return `${asset.originalName}（${asset.width} × ${asset.height}）`;
}

/** Lets an editor select an existing managed image and record meaningful alternative text. */
export function MediaAssetPicker({
  label,
  value,
  onChange,
  disabled = false,
}: MediaAssetPickerProps) {
  const assetsQuery = useQuery({
    queryKey: websiteContentQueryKeys.media({ page: 1, pageSize: 100, status: "active" }),
    queryFn: () => fetchWebsiteMediaAssets({ page: 1, pageSize: 100, status: "active" }),
    enabled: !disabled,
  });

  return (
    <fieldset className="rounded-lg border border-slate-200 p-4">
      <legend className="px-1 text-sm font-semibold text-slate-900">{label}</legend>
      <label className="mt-2 block">
        <span className="text-sm font-medium text-slate-800">选择素材</span>
        <select
          aria-label={`${label}素材`}
          value={value.assetId ?? ""}
          disabled={disabled || assetsQuery.isPending}
          onChange={(event) => onChange({ ...value, assetId: event.target.value || null })}
          className={inputClassName}
        >
          <option value="">使用已批准的默认图片</option>
          {assetsQuery.data?.list.map((asset) => (
            <option key={asset.id} value={asset.id}>
              {selectedAssetLabel(asset)}
            </option>
          ))}
        </select>
      </label>
      {assetsQuery.isError ? (
        <div role="alert" className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-950">
          素材加载失败。
          <button
            type="button"
            onClick={() => void assetsQuery.refetch()}
            className="ml-2 inline-flex min-h-9 items-center gap-1 rounded-md px-2 font-semibold underline outline-none focus-visible:ring-2 focus-visible:ring-red-700"
          >
            <RefreshCw aria-hidden="true" className="h-3.5 w-3.5" />
            重试
          </button>
        </div>
      ) : null}
      <label className="mt-3 block">
        <span className="text-sm font-medium text-slate-800">图片替代文本</span>
        <input
          aria-label={`${label}替代文本`}
          value={value.altText}
          disabled={disabled}
          required
          maxLength={250}
          onChange={(event) => onChange({ ...value, altText: event.target.value })}
          className={inputClassName}
        />
      </label>
      <p className="mt-2 flex items-center gap-2 text-sm text-slate-500">
        <ImagePlus aria-hidden="true" className="h-4 w-4" />
        上传和归档在素材库中完成；这里仅选择已验证的图片。
      </p>
    </fieldset>
  );
}
