import type { WebsiteMediaAsset, WebsiteMediaListQuery } from "@petcare/shared-types";
import { Archive, Image as ImageIcon, LoaderCircle, Upload } from "lucide-react";
import { useRef, useState } from "react";

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
const ACCEPTED_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

interface WebsiteMediaLibraryProps {
  /** Current page of assets returned by the Server. */
  assets: readonly WebsiteMediaAsset[];
  /** Pagination and filter state used for the current list. */
  query: WebsiteMediaListQuery;
  /** Total matching asset count. */
  total: number;
  /** Whether the list query is pending. */
  loading?: boolean;
  /** Whether the list query failed. */
  error?: boolean;
  /** Uploads one client-selected file after Server validation. */
  onUpload(file: File): void | Promise<void>;
  /** Archives an asset that has no active references. */
  onArchive(asset: WebsiteMediaAsset): void | Promise<void>;
  /** Updates keyword/status/page filters. */
  onQueryChange(query: WebsiteMediaListQuery): void;
  /** Selects one asset for a section field. */
  onSelect?(asset: WebsiteMediaAsset): void;
  /** Asset identifier currently selected by the caller. */
  selectedAssetId?: string | null;
  /** Asset identifier currently being archived or uploaded. */
  pendingAssetId?: string | null;
}

/** Renders the bounded Tencent COS-backed media library without exposing storage keys. */
export function WebsiteMediaLibrary({
  assets,
  query,
  total,
  loading = false,
  error = false,
  onUpload,
  onArchive,
  onQueryChange,
  onSelect,
  selectedAssetId = null,
  pendingAssetId = null,
}: WebsiteMediaLibraryProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);

  function handleFile(file: File | undefined) {
    if (!file) {
      return;
    }

    if (!ACCEPTED_MIME_TYPES.has(file.type)) {
      setUploadError("请选择 JPEG、PNG 或 WebP 图片。");

      return;
    }

    if (file.size > MAX_UPLOAD_BYTES) {
      setUploadError("图片大小不能超过 10 MB。");

      return;
    }

    setUploadError(null);
    void onUpload(file);
  }

  return (
    <section aria-label="官网素材库" className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="font-medium text-blue-800">官网素材库</p>
          <h2 className="mt-1 text-xl font-semibold text-slate-950">图片素材</h2>
          <p className="mt-1 text-sm leading-6 text-slate-600">素材由 Server 管理并保存到腾讯云 COS，内容只引用素材 ID。</p>
        </div>
        <div>
          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="sr-only"
            onChange={(event) => {
              handleFile(event.target.files?.[0]);
              event.currentTarget.value = "";
            }}
          />
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-lg bg-blue-800 px-4 py-2 font-semibold text-white outline-none hover:bg-blue-900 focus-visible:ring-2 focus-visible:ring-blue-800 focus-visible:ring-offset-2"
          >
            <Upload aria-hidden="true" className="h-4 w-4" />
            上传图片
          </button>
        </div>
      </div>

      {uploadError ? <p role="alert" className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">{uploadError}</p> : null}
      {error ? <p role="alert" className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-950">素材加载失败，请稍后重试。</p> : null}

      <div className="mt-5 grid gap-3 sm:grid-cols-[minmax(0,1fr)_180px]">
        <label className="block">
          <span className="text-sm font-medium text-slate-800">搜索文件名</span>
          <input
            aria-label="搜索文件名"
            value={query.keyword ?? ""}
            onChange={(event) => onQueryChange({ ...query, page: 1, keyword: event.target.value || undefined })}
            className="mt-2 h-11 w-full rounded-lg border border-slate-300 px-3 outline-none focus:border-blue-700 focus:ring-2 focus:ring-blue-700/20"
          />
        </label>
        <label className="block">
          <span className="text-sm font-medium text-slate-800">素材状态</span>
          <select
            aria-label="素材状态"
            value={query.status ?? "all"}
            onChange={(event) => onQueryChange({ ...query, page: 1, status: event.target.value === "all" ? undefined : event.target.value as WebsiteMediaListQuery["status"] })}
            className="mt-2 h-11 w-full rounded-lg border border-slate-300 bg-white px-3 outline-none focus:border-blue-700 focus:ring-2 focus:ring-blue-700/20"
          >
            <option value="all">全部</option>
            <option value="active">可用</option>
            <option value="archived">已归档</option>
          </select>
        </label>
      </div>

      {loading ? <p aria-live="polite" className="mt-5 rounded-lg border border-slate-200 bg-slate-50 p-5 text-slate-600">正在加载素材…</p> : null}
      {!loading && assets.length === 0 ? <p className="mt-5 rounded-lg border border-dashed border-slate-300 bg-slate-50 p-5 text-slate-600">暂无匹配素材。</p> : null}

      {!loading && assets.length > 0 ? (
        <ul className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {assets.map((asset) => {
            const referenced = asset.references.length > 0;
            const pending = pendingAssetId === asset.id;

            return (
              <li key={asset.id} className={`rounded-lg border p-3 ${selectedAssetId === asset.id ? "border-blue-700 ring-2 ring-blue-700/20" : "border-slate-200"}`}>
                <button
                  type="button"
                  onClick={() => onSelect?.(asset)}
                  className="block w-full text-left outline-none focus-visible:ring-2 focus-visible:ring-blue-800"
                  aria-pressed={selectedAssetId === asset.id}
                >
                  <img src={asset.publicAsset.url} alt={asset.originalName} width={asset.width} height={asset.height} className="aspect-video w-full rounded-md bg-slate-100 object-cover" />
                  <span className="mt-3 flex items-center gap-2 font-medium text-slate-950"><ImageIcon aria-hidden="true" className="h-4 w-4 text-blue-800" />{asset.originalName}</span>
                  <span className="mt-1 block text-xs text-slate-600">{asset.width} × {asset.height} · {asset.mimeType} · {Math.ceil(asset.sizeBytes / 1024)} KB</span>
                </button>
                {referenced ? <p className="mt-3 rounded-md bg-amber-50 p-2 text-xs leading-5 text-amber-950">已被 {asset.references.length} 个草稿或发布版本引用，不能归档。</p> : null}
                <button
                  type="button"
                  disabled={referenced || pending || asset.status === "archived"}
                  onClick={() => void onArchive(asset)}
                  className="mt-3 inline-flex min-h-10 items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-800 outline-none hover:bg-slate-50 focus-visible:ring-2 focus-visible:ring-blue-800 disabled:cursor-not-allowed disabled:opacity-45"
                >
                  {pending ? <LoaderCircle aria-hidden="true" className="h-4 w-4 animate-spin" /> : <Archive aria-hidden="true" className="h-4 w-4" />}
                  {asset.status === "archived" ? "已归档" : (referenced ? "已引用" : "归档")}
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}

      <div className="mt-5 flex items-center justify-between text-sm text-slate-600">
        <span>共 {total} 个素材</span>
        <div className="flex gap-2">
          <button type="button" disabled={query.page <= 1} onClick={() => onQueryChange({ ...query, page: query.page - 1 })} className="min-h-10 rounded-lg border border-slate-300 px-3 font-semibold outline-none hover:bg-slate-50 focus-visible:ring-2 focus-visible:ring-blue-800 disabled:opacity-40">上一页</button>
          <button type="button" disabled={query.page * query.pageSize >= total} onClick={() => onQueryChange({ ...query, page: query.page + 1 })} className="min-h-10 rounded-lg border border-slate-300 px-3 font-semibold outline-none hover:bg-slate-50 focus-visible:ring-2 focus-visible:ring-blue-800 disabled:opacity-40">下一页</button>
        </div>
      </div>
    </section>
  );
}
