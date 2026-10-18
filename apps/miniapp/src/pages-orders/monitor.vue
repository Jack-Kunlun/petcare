<script setup lang="ts">
import { onLoad, onShow } from "@dcloudio/uni-app";
import { BOUNTY_STATUS, BOUNTY_STATUS_LABELS } from "@petcare/shared-types";
import type { BountySop, BountySopStep } from "@petcare/shared-types";
import { computed, ref, watch } from "vue";
import type { OrderRecord, OrderRole } from "./order-data";
import { findOrderRecord } from "./order-data";
import { getBountySop } from "@/api/bounties";
import { getSafeRequestErrorMessage, MiniappApiError } from "@/api/request";
import BountySopPanel from "@/components/bounty/BountySopPanel.vue";
import PcButton from "@/components/PcButton.vue";
import PcStatePanel from "@/components/PcStatePanel.vue";
import SubPageLayout from "@/components/SubPageLayout.vue";
import { commercialServicesEnabled } from "@/config/features";
import { captureSessionUserRevision, isSessionUserRevisionCurrent, session } from "@/state/session";

definePage({ style: { navigationBarTextStyle: "black", navigationStyle: "custom" } });

type PageStatus = "loading" | "ready" | "error" | "unauthenticated" | "unavailable" | "notFound";
type SopStatus = "idle" | "loading" | "ready" | "error";

const bountyId = ref("");
const preferredRole = ref<OrderRole>();
const pageStatus = ref<PageStatus>(commercialServicesEnabled ? "loading" : "unavailable");
const record = ref<OrderRecord | null>(null);
const sop = ref<BountySop | null>(null);
const sopStatus = ref<SopStatus>("idle");
const errorMessage = ref("");
const loading = ref(false);

const completedStepCount = computed(
  () => sop.value?.steps.filter((step) => Boolean(step.completedAt)).length ?? 0,
);
const progressPercent = computed(() =>
  sop.value?.steps.length
    ? Math.round((completedStepCount.value / sop.value.steps.length) * 100)
    : 0,
);

function openLogin(): void {
  uni.navigateTo({ url: "/pages/auth/index" });
}

function openOrderDetail(): void {
  if (!record.value) {
    return;
  }

  uni.navigateTo({
    url: `/pages-orders/detail?bountyId=${encodeURIComponent(record.value.bounty.id)}&role=${record.value.role}`,
  });
}

function openBounties(): void {
  uni.navigateTo({ url: "/pages-bounty/index?tab=mine" });
}

function stepVisualState(step: BountySopStep): "complete" | "current" | "waiting" {
  if (step.completedAt) {
    return "complete";
  }

  return sop.value?.currentStepNumber === step.stepNumber ? "current" : "waiting";
}

function stepStateLabel(step: BountySopStep): string {
  const state = stepVisualState(step);

  return { complete: "已完成", current: "当前步骤", waiting: "待执行" }[state];
}

function formatCompletionDate(value: string | null): string {
  if (!value) {
    return "";
  }

  const date = new Date(value);

  if (!Number.isFinite(date.getTime())) {
    return "";
  }

  return `${date.getMonth() + 1}月${date.getDate()}日 ${date
    .getHours()
    .toString()
    .padStart(2, "0")}:${date.getMinutes().toString().padStart(2, "0")}`;
}

async function load(): Promise<void> {
  if (loading.value || !commercialServicesEnabled) {
    return;
  }

  if (!bountyId.value) {
    pageStatus.value = "notFound";
    record.value = null;

    return;
  }

  if (!session.user) {
    pageStatus.value = session.bootstrapped ? "unauthenticated" : "loading";
    record.value = null;

    return;
  }

  loading.value = true;
  pageStatus.value = "loading";
  errorMessage.value = "";
  record.value = null;
  sop.value = null;
  sopStatus.value = "loading";
  const revision = captureSessionUserRevision();

  try {
    const found = await findOrderRecord(bountyId.value, preferredRole.value);

    if (!isSessionUserRevisionCurrent(revision)) {
      pageStatus.value = "unauthenticated";

      return;
    }

    if (!found) {
      pageStatus.value = "notFound";

      return;
    }

    record.value = found;

    if (
      found.bounty.status !== BOUNTY_STATUS.CONFIRMED &&
      found.bounty.status !== BOUNTY_STATUS.IN_PROGRESS &&
      found.bounty.status !== BOUNTY_STATUS.COMPLETED
    ) {
      sopStatus.value = "idle";
      pageStatus.value = "ready";

      return;
    }

    const snapshot = await getBountySop(found.bounty.id);

    if (isSessionUserRevisionCurrent(revision)) {
      sop.value = snapshot;
      sopStatus.value = "ready";
      pageStatus.value = "ready";
    }
  } catch (error) {
    if (!isSessionUserRevisionCurrent(revision)) {
      return;
    }

    if (error instanceof MiniappApiError && error.statusCode === 401) {
      pageStatus.value = "unauthenticated";
    } else {
      pageStatus.value = record.value ? "ready" : "error";
      sopStatus.value = "error";
      errorMessage.value = getSafeRequestErrorMessage(error, "履约记录读取失败，请重试。");
    }
  } finally {
    loading.value = false;
  }
}

onLoad((query = {}) => {
  bountyId.value = String(query.bountyId ?? query.id ?? "");

  if (query.role === "owner" || query.role === "provider") {
    preferredRole.value = query.role;
  }
});
onShow(() => void load());
watch(
  () => session.bootstrapped,
  (bootstrapped) => {
    if (bootstrapped) {
      void load();
    }
  },
);
</script>

<template>
  <SubPageLayout title="服务进度">
    <view class="order-monitor flex flex-col gap-copy px-action pb-section pt-copy">
      <PcStatePanel
        v-if="pageStatus === 'unavailable'"
        status="unavailable"
        title="服务进度暂不可用"
        description="当前构建未启用商业服务。"
      />
      <PcStatePanel
        v-else-if="pageStatus === 'unauthenticated'"
        status="unauthenticated"
        title="登录后查看服务记录"
        description="服务履约信息仅对发布者或已确认的服务者开放。"
        primary-label="微信登录"
        @primary="openLogin"
      />
      <PcStatePanel v-else-if="pageStatus === 'loading'" status="loading" title="服务记录加载中…" />
      <PcStatePanel
        v-else-if="pageStatus === 'error'"
        status="error"
        title="服务记录读取失败"
        :description="errorMessage"
        primary-label="重试"
        @primary="load"
      />
      <PcStatePanel
        v-else-if="pageStatus === 'notFound'"
        status="empty"
        title="没有找到这笔服务订单"
        description="该订单可能尚未确认服务者，或当前账号不是参与者。"
      />

      <template v-else-if="record">
        <view class="order-monitor__hero">
          <image
            class="order-monitor__pet-image"
            :src="record.bounty.pet.coverImage || '/static/main/petcare-placeholder-light.svg'"
            mode="aspectFill"
            :aria-label="`${record.bounty.pet.name}的宠物资料照片，并非实时画面`"
          />
          <view class="order-monitor__photo-caption">
            <text>{{ record.bounty.pet.name }}的资料照片</text>
            <text>暂未接入实时视频或定位</text>
          </view>
        </view>

        <view class="order-monitor__progress-card">
          <view class="flex items-start justify-between gap-copy">
            <view class="min-w-0 flex flex-col gap-caption">
              <text class="order-monitor__progress-title">
                {{ sop?.currentStepNumber ? `第 ${sop.currentStepNumber} 步服务` : "当前服务" }}
              </text>
              <text class="order-monitor__progress-subtitle">
                {{ BOUNTY_STATUS_LABELS[record.bounty.status] }}
                <template v-if="sop">
                  · 已完成 {{ completedStepCount }}/{{ sop.steps.length }} 步</template
                >
              </text>
            </view>
            <text class="order-monitor__progress-percent">{{
              sop ? `${progressPercent}%` : "—"
            }}</text>
          </view>
          <view class="order-monitor__progress-track" aria-label="履约步骤完成比例">
            <view class="order-monitor__progress-fill" :style="{ width: `${progressPercent}%` }" />
          </view>
          <text class="quiet-text">进度只依据服务者提交并由服务端记录的步骤，不代表实时位置。</text>
        </view>

        <view class="order-monitor__section-heading">
          <text class="section-heading">履约步骤</text>
          <PcButton size="control" variant="ghost" @click="openOrderDetail">订单详情</PcButton>
        </view>

        <view v-if="sop" class="order-monitor__timeline">
          <view v-for="step in sop.steps" :key="step.stepNumber" class="order-monitor__step">
            <view class="order-monitor__step-rail">
              <view
                class="order-monitor__step-dot"
                :class="`order-monitor__step-dot--${stepVisualState(step)}`"
              />
              <view v-if="step.stepNumber < sop.steps.length" class="order-monitor__step-line" />
            </view>
            <view class="order-monitor__step-copy">
              <view class="flex items-center justify-between gap-copy">
                <text class="order-monitor__step-name"
                  >{{ step.stepNumber }}. {{ step.stepName }}</text
                >
                <text
                  class="order-monitor__step-state"
                  :class="`order-monitor__step-state--${stepVisualState(step)}`"
                >
                  {{ stepStateLabel(step) }}
                </text>
              </view>
              <text v-if="step.completedAt" class="quiet-text"
                >记录于 {{ formatCompletionDate(step.completedAt) }}</text
              >
              <text v-else-if="sop.currentStepNumber === step.stepNumber" class="quiet-text"
                >等待服务记录更新</text
              >
              <text v-else class="quiet-text">等待前序步骤完成</text>
            </view>
          </view>
        </view>

        <view v-else class="order-monitor__notice" role="status">
          <text>
            {{
              record.bounty.status === BOUNTY_STATUS.OPEN
                ? "等待发布者确认服务者后生成履约记录。"
                : "当前订单尚未进入可展示履约步骤的服务状态。"
            }}
          </text>
        </view>

        <view
          v-if="errorMessage"
          class="order-monitor__notice order-monitor__notice--error"
          role="alert"
        >
          <text>{{ errorMessage }}</text>
        </view>

        <BountySopPanel v-if="sop" :status="sopStatus" :sop="sop" :read-only="true" @load="load" />
        <view v-else-if="sopStatus === 'error'" class="flex flex-col gap-sm">
          <PcStatePanel
            status="error"
            title="履约记录未能读取"
            description="服务进度不会使用静态状态替代，请重试查询。"
            primary-label="重试"
            @primary="load"
          />
        </view>

        <view class="order-monitor__bottom-actions">
          <PcButton variant="secondary" disabled block aria-label="联系服务参与者功能暂未开放">
            联系{{ record.role === "owner" ? "照护者" : "主人" }}（暂未开放）
          </PcButton>
          <PcButton block variant="ghost" @click="openBounties">返回悬赏</PcButton>
        </view>
      </template>
    </view>
  </SubPageLayout>
</template>

<style scoped lang="scss">
.order-monitor {
  min-height: 100%;
  background: #f7f9fc;
}

.order-monitor__hero {
  overflow: hidden;
  border: 1px solid #edf0f5;
  border-radius: 18px;
  background: #ffffff;
}

.order-monitor__pet-image {
  display: block;
  width: 100%;
  height: 210px;
  background: #eef2f7;
}

.order-monitor__photo-caption {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 10px 12px;
  color: #667085;
  font-size: 11px;
  line-height: 17px;
}

.order-monitor__progress-card {
  display: flex;
  flex-direction: column;
  gap: 11px;
  padding: 16px;
  border: 1px solid #edf0f5;
  border-radius: 16px;
  background: #ffffff;
}

.order-monitor__progress-title {
  color: #1d2939;
  font-size: 17px;
  font-weight: 600;
  line-height: 24px;
}

.order-monitor__progress-subtitle {
  color: #14836c;
  font-size: 13px;
  line-height: 19px;
}

.order-monitor__progress-percent {
  color: #4a6cf7;
  font-size: 18px;
  font-weight: 600;
  line-height: 24px;
}

.order-monitor__progress-track {
  overflow: hidden;
  height: 7px;
  border-radius: 999px;
  background: #e9eef8;
}

.order-monitor__progress-fill {
  height: 100%;
  border-radius: inherit;
  background: #4a6cf7;
  transition: width 180ms ease;
}

.order-monitor__section-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.order-monitor__timeline {
  display: flex;
  flex-direction: column;
  padding: 16px;
  border: 1px solid #edf0f5;
  border-radius: 16px;
  background: #ffffff;
}

.order-monitor__step {
  display: flex;
  gap: 12px;
  min-height: 72px;
}

.order-monitor__step:last-child {
  min-height: 34px;
}

.order-monitor__step-rail {
  display: flex;
  width: 16px;
  flex-shrink: 0;
  flex-direction: column;
  align-items: center;
}

.order-monitor__step-dot {
  z-index: 1;
  width: 12px;
  height: 12px;
  flex-shrink: 0;
  margin-top: 5px;
  border: 2px solid #d0d5dd;
  border-radius: 50%;
  background: #ffffff;
}

.order-monitor__step-dot--complete {
  border-color: #14836c;
  background: #14836c;
}

.order-monitor__step-dot--current {
  border-color: #4a6cf7;
  background: #4a6cf7;
}

.order-monitor__step-line {
  width: 1px;
  height: 100%;
  min-height: 52px;
  margin-top: -1px;
  background: #dbe4ff;
}

.order-monitor__step-copy {
  display: flex;
  min-width: 0;
  flex: 1;
  flex-direction: column;
  gap: 5px;
  padding-bottom: 14px;
}

.order-monitor__step-name {
  color: #344054;
  font-size: 14px;
  font-weight: 600;
  line-height: 22px;
}

.order-monitor__step-state {
  flex-shrink: 0;
  color: #667085;
  font-size: 11px;
  line-height: 17px;
}

.order-monitor__step-state--complete {
  color: #14836c;
}

.order-monitor__step-state--current {
  color: #4a6cf7;
}

.order-monitor__notice {
  padding: 12px;
  border: 1px solid #dbe4ff;
  border-radius: 12px;
  background: #eef2ff;
  color: #4456a8;
  font-size: 13px;
  line-height: 20px;
}

.order-monitor__notice--error {
  border-color: #fecdca;
  background: #fef3f2;
  color: #b42318;
}

.order-monitor__bottom-actions {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 4px 0 16px;
}
</style>
