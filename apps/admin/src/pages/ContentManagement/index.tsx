import { ArrowRight, BookOpenText, MessageSquareText, ShieldCheck } from "lucide-react";
import { Link } from "react-router-dom";
import { Badge, Button, PageHeader, PageShell, Panel } from "../../components/ui";

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
    <PageShell>
      <PageHeader
        actions={
          <Badge className="h-9 px-3" tone="success">
            <ShieldCheck aria-hidden="true" className="h-4 w-4" />2 个已启用模块
          </Badge>
        }
        description="审核社区帖子，维护面向用户发布的养宠知识。"
        eyebrow="内容管理"
        title="内容概览"
      />

      <section aria-label="当前内容管理能力" className="grid gap-4 lg:grid-cols-2">
        {contentAreas.map((area) => {
          const Icon = area.icon;

          return (
            <article key={area.title}>
              <Panel className="flex min-h-56 h-full flex-col" interactive padding="lg">
                <span className="grid h-11 w-11 place-items-center rounded-xl bg-brand-soft text-brand-primary">
                  <Icon aria-hidden="true" className="h-6 w-6" />
                </span>
                <h2 className="mt-5 text-lg font-semibold text-text-primary">{area.title}</h2>
                <p className="mt-2 flex-1 text-sm leading-6 text-text-secondary">
                  {area.description}
                </p>
                <Button asChild className="-ml-3 mt-4 w-fit" intent="ghost" size="sm">
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
    </PageShell>
  );
}
