import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  CalendarDays,
  Heart,
  MessageSquare,
  PawPrint,
  RefreshCw,
  UserRound,
} from "lucide-react";
import { Link, useParams } from "react-router-dom";
import { fetchAdminUser } from "../../api/users";
import { EditorPageLayout, FormSection } from "../../components/EditorPageLayout";
import { Button, StatePanel } from "../../components/ui";
import { UserStatusBadge } from "./UserStatusBadge";

const userTypeLabels = {
  pet_owner: "宠物账户",
  provider: "历史服务者账户",
} as const;

/** 将 ISO 时间格式化为详情页使用的本地时间。 */
function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat("zh-CN", {
    dateStyle: "medium",
    timeStyle: "short",
    hour12: false,
  }).format(new Date(value));
}

/** 展示单个用户的账户、资料和当前使用概况。 */
export default function UserDetail() {
  const { id = "" } = useParams<{ id: string }>();
  const query = useQuery({
    queryKey: ["admin-user", id],
    queryFn: () => fetchAdminUser(id),
    enabled: Boolean(id),
  });

  const back = (
    <Button asChild intent="ghost">
      <Link to="/users">
        <ArrowLeft aria-hidden="true" className="h-4 w-4" />
        返回用户列表
      </Link>
    </Button>
  );

  if (!id) {
    return (
      <StatePanel
        title="用户详情地址无效"
        description="请返回用户列表并选择一个有效用户。"
        action={back}
        tone="danger"
      />
    );
  }

  if (query.isPending) {
    return (
      <StatePanel aria-live="polite" title="正在加载用户详情" description="正在读取账户资料。" />
    );
  }

  if (query.isError || !query.data) {
    return (
      <StatePanel
        role="alert"
        title="用户详情加载失败"
        description="用户可能已不存在，或当前服务暂时不可用。"
        icon={<RefreshCw aria-hidden="true" className="h-5 w-5" />}
        tone="danger"
        action={
          <div className="flex flex-wrap justify-center gap-2">
            {back}
            <Button intent="dangerOutline" onClick={() => void query.refetch()}>
              <RefreshCw aria-hidden="true" className="h-4 w-4" />
              重新加载
            </Button>
          </div>
        }
      />
    );
  }

  const user = query.data;
  const activities = [
    { label: "宠物档案", value: user.activity.petCount, icon: PawPrint },
    { label: "社区帖子", value: user.activity.postCount, icon: UserRound },
    { label: "评论", value: user.activity.commentCount, icon: MessageSquare },
    { label: "收藏", value: user.activity.favoriteCount, icon: Heart },
  ];

  return (
    <EditorPageLayout
      width="wide"
      title={user.nickname}
      description="查看该用户当前的账户身份、资料摘要和使用概况。"
      back={back}
      status={<UserStatusBadge status={user.status} />}
    >
      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="min-w-0 space-y-6">
          <FormSection title="账户信息">
            <dl className="grid gap-x-8 gap-y-5 text-sm sm:grid-cols-2">
              <div className="min-w-0">
                <dt className="text-text-muted">用户 ID</dt>
                <dd className="mt-1 break-all font-mono text-xs leading-5 text-text-primary">
                  {user.id}
                </dd>
              </div>
              <div>
                <dt className="text-text-muted">账户类型</dt>
                <dd className="mt-1 font-medium text-text-primary">
                  {userTypeLabels[user.userType]}
                </dd>
              </div>
              <div>
                <dt className="text-text-muted">手机号</dt>
                <dd className="mt-1 font-medium tabular-nums text-text-primary">
                  {user.phone ?? "未绑定"}
                </dd>
              </div>
              <div>
                <dt className="text-text-muted">登录账号</dt>
                <dd className="mt-1 font-medium text-text-primary">
                  {user.username ? `@${user.username}` : "未设置"}
                </dd>
              </div>
            </dl>
          </FormSection>

          <FormSection title="使用概况" description="以下数量反映当前仍关联到该账户的数据。">
            <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {activities.map(({ label, value, icon: Icon }) => (
                <div key={label} className="rounded-xl border border-border bg-surface-subtle p-4">
                  <dt className="flex items-center gap-2 text-sm text-text-secondary">
                    <Icon aria-hidden="true" className="h-4 w-4 text-brand-primary" />
                    {label}
                  </dt>
                  <dd className="mt-3 text-2xl font-semibold tabular-nums text-text-primary">
                    {value}
                  </dd>
                </div>
              ))}
            </dl>
          </FormSection>

          <FormSection title="时间信息">
            <dl className="grid gap-5 text-sm sm:grid-cols-2">
              <div>
                <dt className="flex items-center gap-2 text-text-muted">
                  <CalendarDays aria-hidden="true" className="h-4 w-4" />
                  注册时间
                </dt>
                <dd className="mt-1 font-medium tabular-nums text-text-primary">
                  {formatDateTime(user.createdAt)}
                </dd>
              </div>
              <div>
                <dt className="flex items-center gap-2 text-text-muted">
                  <RefreshCw aria-hidden="true" className="h-4 w-4" />
                  最后更新
                </dt>
                <dd className="mt-1 font-medium tabular-nums text-text-primary">
                  {formatDateTime(user.updatedAt)}
                </dd>
              </div>
            </dl>
          </FormSection>
        </div>

        <aside className="min-w-0 xl:sticky xl:top-28">
          <FormSection title="资料摘要">
            <div className="flex flex-col items-center text-center">
              <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-full bg-brand-soft text-2xl font-semibold text-brand-primary">
                {user.avatar ? (
                  <img src={user.avatar} alt="" className="h-full w-full object-cover" />
                ) : (
                  user.nickname.slice(0, 1).toUpperCase()
                )}
              </div>
              <p className="mt-4 text-lg font-semibold text-text-primary">{user.nickname}</p>
              <p className="mt-1 text-sm text-text-secondary">
                {user.username ? `@${user.username}` : "未设置登录账号"}
              </p>
            </div>
            <div className="mt-6 border-t border-border pt-5">
              <p className="text-xs font-medium text-text-muted">个人简介</p>
              <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-text-primary">
                {user.profile?.bio || "暂未填写个人简介。"}
              </p>
            </div>
          </FormSection>
        </aside>
      </div>
    </EditorPageLayout>
  );
}
