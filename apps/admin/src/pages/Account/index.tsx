import type { AdminAccountProfile } from "@petcare/shared-types";
import { useQuery } from "@tanstack/react-query";
import { RefreshCw } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { getAdminAccountProfile } from "../../api/admin-account";
import {
  Badge,
  Button,
  PageHeader,
  PageShell,
  Panel,
  Skeleton,
  StatePanel,
} from "../../components/ui";
import { PasswordCard } from "./PasswordCard";
import { ProfileCard } from "./ProfileCard";

function AccountSkeleton() {
  return (
    <PageShell role="status" aria-label="正在加载个人资料" aria-busy="true">
      <Skeleton className="max-w-[576px]" lines={2} />
      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_400px]">
        {[0, 1].map((item) => (
          <Panel key={item} className="space-y-5">
            <Skeleton lines={item === 0 ? 8 : 6} />
          </Panel>
        ))}
      </div>
    </PageShell>
  );
}

/** The current administrator's self-service account page. */
export default function Account() {
  const location = useLocation();
  const currentPasswordRef = useRef<HTMLInputElement>(null);
  const passwordSectionRef = useRef<HTMLElement>(null);
  const [profile, setProfile] = useState<AdminAccountProfile | null>(null);
  const profileQuery = useQuery({
    queryKey: ["admin-account-profile"],
    queryFn: getAdminAccountProfile,
  });

  useEffect(() => {
    if (profileQuery.data) {
      setProfile(profileQuery.data);
    }
  }, [profileQuery.data]);

  useEffect(() => {
    if (location.hash === "#password" && profile) {
      passwordSectionRef.current?.scrollIntoView({ block: "start" });
      currentPasswordRef.current?.focus();
    }
  }, [location.hash, profile]);

  if (profileQuery.isError) {
    return (
      <StatePanel
        role="alert"
        tone="danger"
        icon={<RefreshCw aria-hidden="true" className="h-5 w-5" />}
        title="个人资料加载失败"
        description="请检查网络连接后重试。"
        action={
          <Button intent="dangerOutline" onClick={() => void profileQuery.refetch()}>
            <RefreshCw aria-hidden="true" className="h-4 w-4" />
            重新加载
          </Button>
        }
      />
    );
  }

  if (profileQuery.isPending || !profile) {
    return <AccountSkeleton />;
  }

  return (
    <PageShell>
      <PageHeader
        eyebrow="账户与安全"
        title="个人中心"
        description="管理个人资料、头像和账户安全设置。"
        meta={<Badge tone="success">{profile.status}</Badge>}
      />
      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_400px]">
        <ProfileCard profile={profile} onProfileChange={setProfile} />
        <PasswordCard currentPasswordRef={currentPasswordRef} sectionRef={passwordSectionRef} />
      </div>
    </PageShell>
  );
}
