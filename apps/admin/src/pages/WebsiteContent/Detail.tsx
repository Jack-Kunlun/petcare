import { ArrowLeft, History } from "lucide-react";
import { Link, useParams } from "react-router-dom";

/** Route-readable placeholder for an immutable Website Content history version. */
export default function WebsiteContentDetail() {
  const { contentKey, versionId } = useParams();

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
        <History aria-hidden="true" className="h-6 w-6 text-blue-800" />
        <h1 className="mt-3 text-2xl font-bold text-slate-950">历史版本</h1>
        <p className="mt-2 text-slate-600">
          内容单元：{contentKey ?? "未知"}；版本：{versionId ?? "未知"}。
        </p>
      </div>
    </section>
  );
}
