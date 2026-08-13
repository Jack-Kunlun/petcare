import { useQuery } from "@tanstack/react-query";
import { AlertCircle, FileText, RefreshCw } from "lucide-react";
import { fetchWebsiteContentOverview, websiteContentQueryKeys } from "../../api/website-content";

/** Minimal read-only Website Content overview until the structured editor is introduced. */
export default function WebsiteContent() {
  const overviewQuery = useQuery({
    queryKey: websiteContentQueryKeys.overview(),
    queryFn: fetchWebsiteContentOverview,
  });

  return (
    <section className="mx-auto w-full max-w-[1280px]">
      <header>
        <p className="font-medium text-blue-800">官网内容管理</p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">官网内容</h1>
        <p className="mt-2 max-w-[720px] leading-6 text-slate-600">
          每个内容单元独立保存草稿并显式发布；本页仅展示当前状态。
        </p>
      </header>

      {overviewQuery.isPending ? (
        <div
          aria-label="正在加载官网内容"
          className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
        >
          {[0, 1, 2].map((item) => (
            <div
              key={item}
              className="h-44 rounded-xl bg-slate-200 animate-[pc-skeleton-shimmer_220ms_linear_infinite] motion-reduce:animate-none"
            />
          ))}
        </div>
      ) : null}

      {overviewQuery.isError ? (
        <div role="alert" className="mt-6 rounded-xl border border-red-200 bg-red-50 p-5 text-red-950">
          <AlertCircle aria-hidden="true" className="h-5 w-5" />
          <h2 className="mt-2 font-semibold">官网内容加载失败</h2>
          <p className="mt-1">请检查网络连接后重试，已发布内容不会受到影响。</p>
          <button
            type="button"
            onClick={() => void overviewQuery.refetch()}
            className="mt-4 inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-lg border border-red-700 px-4 py-2 font-semibold outline-none transition-colors hover:bg-red-100 focus-visible:ring-2 focus-visible:ring-red-700"
          >
            <RefreshCw aria-hidden="true" className="h-4 w-4" />
            重新加载
          </button>
        </div>
      ) : null}

      {overviewQuery.data ? (
        <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3" aria-label="官网内容单元">
          {overviewQuery.data.map((item) => (
            <li key={item.contentKey} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <FileText aria-hidden="true" className="h-5 w-5 text-blue-800" />
                  <h2 className="mt-2 font-semibold text-slate-950">{item.contentKey}</h2>
                </div>
                <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">
                  草稿 r{item.draftRevision}
                </span>
              </div>
              <p className="mt-4 text-sm text-slate-600">
                {item.publishedBusinessVersion === null
                  ? "尚未发布"
                  : `已发布 v${item.publishedBusinessVersion}`}
              </p>
              {item.hasUnpublishedChanges ? (
                <p className="mt-2 text-sm font-medium text-amber-800">有未发布变更</p>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
