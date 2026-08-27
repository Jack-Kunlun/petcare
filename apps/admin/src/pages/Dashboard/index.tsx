import {
  ArrowRight,
  BookOpenText,
  Globe2,
  MessageSquareText,
  ShieldCheck,
  Users,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Link } from "react-router-dom";

interface ManagementArea {
  title: string;
  description: string;
  path: string;
  action: string;
  icon: LucideIcon;
}

const managementAreas: ManagementArea[] = [
  {
    title: "用户资料",
    description: "查询当前账户资料与账号状态。",
    path: "/users",
    action: "查看用户资料",
    icon: Users,
  },
  {
    title: "社区审核",
    description: "审核受控社区中的帖子与互动内容。",
    path: "/content/posts",
    action: "进入社区审核",
    icon: MessageSquareText,
  },
  {
    title: "萌宠课堂",
    description: "维护面向用户发布的养宠知识文章。",
    path: "/content/articles",
    action: "管理课堂文章",
    icon: BookOpenText,
  },
  {
    title: "官网内容",
    description: "编辑个人版官网当前公开的页面内容。",
    path: "/website-content",
    action: "管理官网内容",
    icon: Globe2,
  },
];

export default function Dashboard() {
  return (
    <div className="mx-auto flex w-full max-w-[1600px] flex-col gap-6 text-text-primary">
      <section className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="mb-1 text-sm font-medium text-blue-700">个人版后台</p>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-950">管理概览</h1>
          <p className="mt-1 text-sm text-slate-500">
            当前后台只呈现已启用、可本地验证的账户与内容管理能力。
          </p>
        </div>
        <div className="flex items-center gap-2 self-start rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800 shadow-sm sm:self-auto">
          <ShieldCheck aria-hidden="true" className="h-4 w-4" />
          <span className="font-medium">当前范围已收窄</span>
        </div>
      </section>

      <section aria-label="当前管理能力" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {managementAreas.map((area) => {
          const Icon = area.icon;

          return (
            <article
              key={area.title}
              className="flex min-h-52 flex-col rounded-xl border border-border bg-white p-5 shadow-sm transition-[box-shadow,border-color,background-color] duration-200 hover:border-brand-primary/30 hover:shadow-md"
            >
              <span className="w-fit rounded-lg bg-blue-50 p-2.5 text-blue-700">
                <Icon aria-hidden="true" className="h-5 w-5" />
              </span>
              <h2 className="mt-4 text-base font-semibold text-slate-950">{area.title}</h2>
              <p className="mt-2 flex-1 text-sm leading-6 text-slate-500">{area.description}</p>
              <Link
                to={area.path}
                className="mt-4 inline-flex w-fit cursor-pointer items-center rounded-sm text-sm font-semibold text-brand-primary outline-none transition-colors hover:text-brand-primary-hover active:text-brand-primary-hover focus-visible:ring-2 focus-visible:ring-brand-primary focus-visible:ring-offset-2"
              >
                {area.action}
                <ArrowRight aria-hidden="true" className="ml-1.5 h-4 w-4" />
              </Link>
            </article>
          );
        })}
      </section>

      <section className="rounded-xl border border-border bg-white p-5 shadow-sm">
        <h2 className="text-base font-semibold text-slate-950">当前范围说明</h2>
        <p className="mt-2 max-w-[896px] text-sm leading-6 text-slate-600">
          本地个人版聚焦账户资料、宠物档案、萌宠课堂、受控社区、通知以及相关内容与权限管理。所有入口均对应当前已启用能力。
        </p>
      </section>
    </div>
  );
}
