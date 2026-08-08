import { Button, Text, View } from "@tarojs/components";
import type { AuthStatus } from "../../../auth/auth.context";
import type { HomeService } from "../home.data";

export interface ServiceOverviewProps {
  status: AuthStatus;
  service: HomeService | null;
  onLogin(): void;
  onPublish(): void;
  onViewService(): void;
  onContact(): void;
}

export default function ServiceOverview({
  status,
  service,
  onLogin,
  onPublish,
  onViewService,
  onContact,
}: ServiceOverviewProps) {
  if (status === "loading") {
    return (
      <View className="rounded-card bg-white p-compact shadow-card">
        <Text className="block text-subtitle font-semibold text-ink-strong">正在恢复登录状态</Text>
        <Text className="mt-note block text-base text-muted-brand">正在为你同步照护计划</Text>
      </View>
    );
  }

  if (status === "guest") {
    return (
      <View className="rounded-card bg-white p-compact shadow-card">
        <Text className="block text-subtitle font-semibold text-ink-strong">
          登录后管理照护计划
        </Text>
        <Text className="mt-note block text-base text-muted-brand">
          查看服务进度、照护记录和消息
        </Text>
        <Button
          className="mt-compact h-control rounded-button border-none bg-brand text-white"
          onClick={onLogin}
        >
          微信登录
        </Button>
      </View>
    );
  }

  if (!service) {
    return (
      <View className="rounded-card bg-white p-section shadow-card">
        <Text className="block text-subtitle font-semibold text-ink-strong">暂无进行中的服务</Text>
        <Text className="mt-note block text-base text-muted-brand">去悬赏大厅发布新的照护需求</Text>
        <Button
          className="mt-compact h-control rounded-button border-none bg-brand text-white"
          onClick={onPublish}
        >
          发布悬赏
        </Button>
      </View>
    );
  }

  return (
    <View className="rounded-card bg-brand p-compact shadow-floating">
      <Text className="block text-subtitle font-bold text-white">{service.serviceType}</Text>
      <Text className="mt-tab-label block text-base text-white">
        预计 {service.estimatedTime} 完成
      </Text>
      <View className="mt-compact h-progress w-full overflow-hidden rounded-pill bg-surface-brand">
        <View
          className="h-progress rounded-pill bg-care"
          style={{ width: `${service.progress}%` }}
          data-testid="service-progress"
        />
      </View>
      <View className="mt-compact flex gap-note">
        <Button
          className="h-control flex-1 rounded-button border-none bg-care text-white"
          onClick={onViewService}
        >
          查看实时
        </Button>
        <Button
          className="h-control flex-1 rounded-button border border-solid border-white bg-brand text-white"
          onClick={onContact}
        >
          联系宠托师
        </Button>
      </View>
    </View>
  );
}
