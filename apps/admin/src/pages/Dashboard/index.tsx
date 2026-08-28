import {
  ArrowRight,
  BookOpenText,
  Globe2,
  MessageSquareText,
  Settings2,
  ShieldCheck,
  Users,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Link } from "react-router-dom";
import { Badge, Button, PageHeader, PageShell, Panel } from "../../components/ui";

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
    description: "维护官网框架、首页和关于页。",
    path: "/website-content",
    action: "管理官网内容",
    icon: Globe2,
  },
  {
    title: "公共内容",
    description: "维护官网与小程序共用的客服、帮助和协议内容。",
    path: "/shared-content",
    action: "管理公共内容",
    icon: Settings2,
  },
];

export default function Dashboard() {
  return (
    <PageShell>
      <PageHeader
        actions={
          <Badge className="h-9 px-3" tone="success">
            <ShieldCheck aria-hidden="true" className="h-4 w-4" />5 个已启用模块
          </Badge>
        }
        description="集中进入账户、社区、课堂、官网和公共内容管理。"
        eyebrow="管理工作台"
        title="管理概览"
      />

      <section
        aria-label="当前管理能力"
        className="grid gap-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-5"
      >
        {managementAreas.map((area) => {
          const Icon = area.icon;

          return (
            <article key={area.title}>
              <Panel className="flex min-h-52 h-full flex-col" interactive>
                <span className="grid h-10 w-10 place-items-center rounded-lg bg-brand-soft text-brand-primary">
                  <Icon aria-hidden="true" className="h-5 w-5" />
                </span>
                <h2 className="mt-4 text-base font-semibold text-text-primary">{area.title}</h2>
                <p className="mt-2 flex-1 text-sm leading-6 text-text-secondary">
                  {area.description}
                </p>
                <Button asChild className="-ml-3 mt-3 w-fit" intent="ghost" size="sm">
                  <Link to={area.path}>
                    {area.action}
                    <ArrowRight aria-hidden="true" className="h-4 w-4" />
                  </Link>
                </Button>
              </Panel>
            </article>
          );
        })}
      </section>

      <Panel>
        <h2 className="text-base font-semibold text-text-primary">能力说明</h2>
        <p className="mt-2 max-w-[896px] text-sm leading-6 text-text-secondary">
          当前支持账户资料、宠物档案、萌宠课堂、受控社区、通知以及相关内容与权限管理。这里的每个入口都对应已启用功能。
        </p>
      </Panel>
    </PageShell>
  );
}
