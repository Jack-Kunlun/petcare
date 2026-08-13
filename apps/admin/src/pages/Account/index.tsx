import type { AdminAccountProfile } from "@petcare/shared-types";
import { useQuery } from "@tanstack/react-query";
import { RefreshCw } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { getAdminAccountProfile } from "../../api/admin-account";
import { PasswordCard } from "./PasswordCard";
import { ProfileCard } from "./ProfileCard";

function AccountSkeleton() {
  return (
    <div role="status" aria-label="正在加载个人资料" className="grid gap-5" aria-busy="true">
      {[0, 1].map((item) => (
        <div
          key={item}
          className="h-72 rounded-xl bg-slate-100 animate-[pc-skeleton-shimmer_220ms_linear_infinite] motion-reduce:animate-none"
        />
      ))}
    </div>
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
      <section role="alert" className="rounded-xl border border-red-200 bg-red-50 p-5 text-red-950">
        <h1 className="text-xl font-semibold">个人资料加载失败</h1>
        <p className="mt-1 leading-6">请检查网络连接后重试。</p>
        <button
          type="button"
          className="mt-4 inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-lg border border-red-700 px-4 py-2 font-semibold outline-none transition-colors hover:bg-red-100 focus-visible:ring-2 focus-visible:ring-red-700 focus-visible:ring-offset-2"
          onClick={() => void profileQuery.refetch()}
        >
          <RefreshCw aria-hidden="true" className="h-4 w-4" />
          重新加载
        </button>
      </section>
    );
  }

  if (profileQuery.isPending || !profile) {
    return <AccountSkeleton />;
  }

  return (
    <section className="mx-auto flex w-full max-w-[1024px] min-w-0 flex-col gap-5 text-slate-900">
      <header>
        <p className="font-medium text-blue-700">账户与安全</p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-950">个人中心</h1>
        <p className="mt-2 leading-6 text-slate-600">管理个人资料和账户安全设置。</p>
      </header>
      <ProfileCard profile={profile} onProfileChange={setProfile} />
      <PasswordCard currentPasswordRef={currentPasswordRef} sectionRef={passwordSectionRef} />
    </section>
  );
}
