import { ArrowRight, BookOpenText, MessageSquareText, ShieldCheck } from "lucide-react";
import { Link } from "react-router-dom";

const contentAreas = [
  {
    title: "社区帖子",
    description: "审核、驳回或下架受控社区中的用户帖子，并查看举报上下文。",
    path: "/content/posts",
    action: "管理社区帖子",
    icon: MessageSquareText,
  },
  {
    title: "萌宠课堂",
    description: "创建、编辑、发布或下线面向用户的养宠知识文章。",
    path: "/content/articles",
    action: "管理课堂文章",
    icon: BookOpenText,
  },
];

export default function ContentManagement() {
  return (
    <div className="mx-auto flex w-full max-w-[1600px] flex-col gap-6 text-text-primary">
      <section className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="mb-1 text-sm font-medium text-blue-700">内容管理</p>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-950">内容概览</h1>
          <p className="mt-1 text-sm text-slate-500">
            管理当前个人版已启用的受控社区与萌宠课堂内容。
          </p>
        </div>
        <div className="flex items-center gap-2 self-start rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800 shadow-sm sm:self-auto">
          <ShieldCheck aria-hidden="true" className="h-4 w-4" />
          <span className="font-medium">仅当前内容域</span>
        </div>
      </section>

      <section aria-label="当前内容管理能力" className="grid gap-4 lg:grid-cols-2">
        {contentAreas.map((area) => {
          const Icon = area.icon;

          return (
            <article
              key={area.title}
              className="flex min-h-56 flex-col rounded-xl border border-border bg-white p-6 shadow-sm transition-[box-shadow,border-color,background-color] duration-200 hover:border-brand-primary/30 hover:shadow-md"
            >
              <span className="w-fit rounded-lg bg-blue-50 p-3 text-blue-700">
                <Icon aria-hidden="true" className="h-6 w-6" />
              </span>
              <h2 className="mt-5 text-lg font-semibold text-slate-950">{area.title}</h2>
              <p className="mt-2 flex-1 text-sm leading-6 text-slate-500">{area.description}</p>
              <Link
                to={area.path}
                className="mt-5 inline-flex w-fit cursor-pointer items-center rounded-sm text-sm font-semibold text-brand-primary outline-none transition-colors hover:text-brand-primary-hover active:text-brand-primary-hover focus-visible:ring-2 focus-visible:ring-brand-primary focus-visible:ring-offset-2"
              >
                {area.action}
                <ArrowRight aria-hidden="true" className="ml-1.5 h-4 w-4" />
              </Link>
            </article>
          );
        })}
      </section>
    </div>
  );
}
