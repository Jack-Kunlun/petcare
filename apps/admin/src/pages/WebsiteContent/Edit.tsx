import { AlertCircle, ArrowLeft } from "lucide-react";
import { Link, useParams } from "react-router-dom";

/** Route-readable placeholder for the fixed preset-section editor. */
export default function WebsiteContentEdit() {
  const { contentKey } = useParams();

  return (
    <section className="mx-auto w-full max-w-[960px]">
      <Link
        to="/website-content"
        className="inline-flex min-h-11 items-center gap-2 rounded-lg px-2 font-medium text-blue-800 outline-none hover:bg-blue-50 focus-visible:ring-2 focus-visible:ring-blue-800"
      >
        <ArrowLeft aria-hidden="true" className="h-4 w-4" />
        返回官网内容
      </Link>
      <div className="mt-4 rounded-xl border border-slate-200 bg-white p-6">
        <p className="font-medium text-blue-800">预设区块编辑</p>
        <h1 className="mt-1 text-2xl font-bold text-slate-950">编辑 {contentKey ?? "官网内容"}</h1>
        <div className="mt-4 flex gap-3 rounded-lg border border-blue-200 bg-blue-50 p-4 text-blue-950">
          <AlertCircle aria-hidden="true" className="h-5 w-5 shrink-0" />
          <p>区块结构固定；编辑表单、保存草稿与预览将在后续界面中提供。</p>
        </div>
      </div>
    </section>
  );
}
