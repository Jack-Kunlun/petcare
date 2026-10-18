<script setup lang="ts">
import { onLoad, onShow } from "@dcloudio/uni-app";
import {
  BOUNTY_SERVICE_TYPE_LABELS,
  BOUNTY_STATUS,
  BOUNTY_STATUS_LABELS,
} from "@petcare/shared-types";
import type { BountySop } from "@petcare/shared-types";
import { computed, ref, watch } from "vue";
import type { OrderRecord, OrderRole } from "./order-data";
import { findOrderRecord } from "./order-data";
import { getBountySop } from "@/api/bounties";
import { getSafeRequestErrorMessage, MiniappApiError } from "@/api/request";
import BountyPaymentPanel from "@/components/bounty/BountyPaymentPanel.vue";
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
const sopErrorMessage = ref("");
const loading = ref(false);
const isServiceOrder = computed(
  () =>
    record.value?.bounty.status === BOUNTY_STATUS.CONFIRMED ||
    record.value?.bounty.status === BOUNTY_STATUS.IN_PROGRESS ||
    record.value?.bounty.status === BOUNTY_STATUS.COMPLETED,
);

function formatServiceTime(value: string): string {
  const date = new Date(value);

  if (!Number.isFinite(date.getTime())) {
    return "服务时间待确认";
  }

  const dateText = `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`;
  const timeText = `${date.getHours().toString().padStart(2, "0")}:${date.getMinutes().toString().padStart(2, "0")}`;

  return `${dateText} ${timeText}`;
}

function formatAmount(amountCents: number): string {
  return `¥${(amountCents / 100).toFixed(2)}`;
}

function openLogin(): void {
  uni.navigateTo({ url: "/pages/auth/index" });
}

function openMonitor(): void {
  if (!record.value || !isServiceOrder.value) {
    return;
  }

  uni.navigateTo({
    url: `/pages-orders/monitor?bountyId=${encodeURIComponent(record.value.bounty.id)}&role=${record.value.role}`,
  });
}

function openBountyIntents(): void {
  uni.navigateTo({ url: "/pages-bounty/index?tab=mine" });
}

async function loadOrder(): Promise<void> {
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
  sopStatus.value = "idle";
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
    pageStatus.value = "ready";

    if (
      found.bounty.status === BOUNTY_STATUS.CONFIRMED ||
      found.bounty.status === BOUNTY_STATUS.IN_PROGRESS ||
      found.bounty.status === BOUNTY_STATUS.COMPLETED
    ) {
      void loadSop(found.bounty.id, revision);
    }
  } catch (error) {
    if (!isSessionUserRevisionCurrent(revision)) {
      return;
    }

    if (error instanceof MiniappApiError && error.statusCode === 401) {
      pageStatus.value = "unauthenticated";
    } else {
      pageStatus.value = "error";
      errorMessage.value = getSafeRequestErrorMessage(error, "订单读取失败，请稍后重试。");
    }
  } finally {
    loading.value = false;
  }
}

async function loadSop(
  orderId = bountyId.value,
  revision = captureSessionUserRevision(),
): Promise<void> {
  if (sopStatus.value === "loading" || !session.user) {
    return;
  }

  sopStatus.value = "loading";
  sopErrorMessage.value = "";

  try {
    const snapshot = await getBountySop(orderId);

    if (isSessionUserRevisionCurrent(revision)) {
      sop.value = snapshot;
      sopStatus.value = "ready";
    }
  } catch (error) {
    if (isSessionUserRevisionCurrent(revision)) {
      sopStatus.value = "error";
      sopErrorMessage.value = getSafeRequestErrorMessage(error, "履约记录读取失败，请重试。");
    }
  }
}

onLoad((query = {}) => {
  bountyId.value = String(query.bountyId ?? query.id ?? "");

  if (query.role === "owner" || query.role === "provider") {
    preferredRole.value = query.role;
  }
});
onShow(() => void loadOrder());
watch(
  () => session.bootstrapped,
  (bootstrapped) => {
    if (bootstrapped) {
      void loadOrder();
    }
  },
);
</script>

<template>
  <SubPageLayout title="订单详情">
    <view class="order-detail flex flex-col gap-copy px-action pb-section pt-copy">
      <PcStatePanel
        v-if="pageStatus === 'unavailable'"
        status="unavailable"
        title="订单服务未开放"
        description="当前构建未启用商业服务。"
      />
      <PcStatePanel
        v-else-if="pageStatus === 'unauthenticated'"
        status="unauthenticated"
        title="登录后查看订单"
        description="订单详情只展示给发布者或已确认的服务者。"
        primary-label="微信登录"
        @primary="openLogin"
      />
      <PcStatePanel v-else-if="pageStatus === 'loading'" status="loading" title="订单详情加载中…" />
      <PcStatePanel
        v-else-if="pageStatus === 'error'"
        status="error"
        title="订单读取失败"
        :description="errorMessage"
        primary-label="重试"
        @primary="loadOrder"
      />
      <PcStatePanel
        v-else-if="pageStatus === 'notFound'"
        status="empty"
        title="没有找到这笔订单"
        description="订单可能已不可见，或当前账号不是参与者。"
      />

      <template v-else-if="record">
        <view class="order-detail__status-card">
          <view class="flex items-center justify-between gap-copy">
            <text class="order-detail__status-title">{{
              BOUNTY_STATUS_LABELS[record.bounty.status]
            }}</text>
            <text
              class="order-detail__status-pill"
              :class="{
                'order-detail__status-pill--active':
                  record.bounty.status === BOUNTY_STATUS.IN_PROGRESS,
              }"
            >
              {{ record.role === "owner" ? "发布者" : "已确认服务者" }}
            </text>
          </view>
          <text class="order-detail__status-description">
            {{
              record.bounty.status === BOUNTY_STATUS.IN_PROGRESS
                ? "服务者正在履行已确认的服务。"
                : "此状态来自悬赏订单的服务端记录。"
            }}
          </text>
          <text class="quiet-text">订单编号：{{ record.bounty.id }}</text>
        </view>

        <view class="order-detail__section">
          <text class="section-heading">服务信息</text>
          <view class="order-detail__pet-row">
            <image
              class="order-detail__pet-image"
              :src="record.bounty.pet.coverImage || '/static/main/petcare-placeholder-light.svg'"
              mode="aspectFill"
              :aria-label="`${record.bounty.pet.name}的资料照片`"
            />
            <view class="min-w-0 flex-1">
              <text class="order-detail__pet-name">{{ record.bounty.pet.name }}</text>
              <text class="order-detail__pet-meta">{{
                record.bounty.pet.breed || "宠物资料"
              }}</text>
            </view>
          </view>
          <view class="order-detail__data-row">
            <text class="meta-text">服务类型</text>
            <text class="order-detail__data-value">{{
              BOUNTY_SERVICE_TYPE_LABELS[record.bounty.serviceType]
            }}</text>
          </view>
          <view class="order-detail__data-row">
            <text class="meta-text">服务时间</text>
            <text class="order-detail__data-value">{{
              formatServiceTime(record.bounty.serviceTime)
            }}</text>
          </view>
          <view class="order-detail__data-row">
            <text class="meta-text">订单金额</text>
            <text class="order-detail__amount">{{ formatAmount(record.bounty.amountCents) }}</text>
          </view>
          <view class="order-detail__address">
            <text class="order-detail__address-label">服务地址</text>
            <text class="order-detail__address-value">
              {{ record.bounty.address || "详细地址暂不可见" }}
            </text>
            <text v-if="record.bounty.remark" class="order-detail__remark"
              >备注：{{ record.bounty.remark }}</text
            >
          </view>
        </view>

        <view class="order-detail__notice" role="note">
          <text>此订单没有提供带时间戳的状态事件或实时定位。下方进度以服务端履约步骤为准。</text>
        </view>

        <view
          v-if="record.role === 'owner' && record.bounty.status === BOUNTY_STATUS.CONFIRMED"
          class="order-detail__section"
        >
          <BountyPaymentPanel
            :order-id="record.bounty.id"
            :amount-cents="record.bounty.amountCents"
          />
        </view>

        <view v-if="isServiceOrder" class="order-detail__section">
          <view class="flex items-center justify-between gap-copy">
            <text class="section-heading">服务进度</text>
            <PcButton size="control" variant="ghost" @click="openMonitor">查看进度</PcButton>
          </view>
          <text v-if="sopErrorMessage" class="order-detail__inline-error" role="alert">{{
            sopErrorMessage
          }}</text>
          <BountySopPanel
            :status="sopStatus"
            :sop="sop ?? undefined"
            :read-only="true"
            @load="loadSop(record.bounty.id)"
          />
        </view>

        <view
          v-if="record.role === 'owner' && record.bounty.status === BOUNTY_STATUS.OPEN"
          class="order-detail__actions"
        >
          <PcButton block @click="openBountyIntents">管理接单意向</PcButton>
        </view>
        <view v-else-if="isServiceOrder" class="order-detail__actions">
          <PcButton variant="secondary" disabled block aria-label="联系照护者功能暂未开放">
            联系{{ record.role === "owner" ? "照护者" : "主人" }}（暂未开放）
          </PcButton>
          <PcButton block @click="openMonitor">查看履约记录</PcButton>
        </view>
      </template>
    </view>
  </SubPageLayout>
</template>

<style scoped lang="scss">
.order-detail {
  min-height: 100%;
  background: #f7f9fc;
}

.order-detail__status-card,
.order-detail__section {
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 16px;
  border: 1px solid #edf0f5;
  border-radius: 18px;
  background: #ffffff;
}

.order-detail__status-title {
  color: #1d2939;
  font-size: 19px;
  font-weight: 600;
  line-height: 28px;
}

.order-detail__status-pill {
  flex-shrink: 0;
  padding: 5px 10px;
  border-radius: 999px;
  background: #eef2ff;
  color: #4a6cf7;
  font-size: 12px;
  line-height: 18px;
}

.order-detail__status-pill--active {
  background: #e9f9f4;
  color: #14836c;
}

.order-detail__status-description {
  color: #667085;
  font-size: 14px;
  line-height: 22px;
}

.order-detail__pet-row {
  display: flex;
  align-items: center;
  gap: 12px;
}

.order-detail__pet-image {
  width: 58px;
  height: 58px;
  flex-shrink: 0;
  border-radius: 16px;
  background: #eef2f7;
}

.order-detail__pet-name,
.order-detail__pet-meta {
  display: block;
  overflow-wrap: anywhere;
}

.order-detail__pet-name {
  color: #1d2939;
  font-size: 16px;
  font-weight: 600;
  line-height: 24px;
}

.order-detail__pet-meta,
.order-detail__data-value {
  color: #344054;
  font-size: 14px;
  line-height: 21px;
}

.order-detail__data-row {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
}

.order-detail__data-value {
  text-align: right;
}

.order-detail__amount {
  color: #1d2939;
  font-size: 20px;
  font-weight: 600;
  line-height: 28px;
}

.order-detail__address {
  display: flex;
  flex-direction: column;
  gap: 5px;
  padding: 12px;
  border-radius: 12px;
  background: #f5f7ff;
}

.order-detail__address-label,
.order-detail__remark {
  color: #667085;
  font-size: 12px;
  line-height: 18px;
}

.order-detail__remark {
  overflow-wrap: anywhere;
}

.order-detail__address-value {
  color: #344054;
  font-size: 14px;
  line-height: 21px;
  overflow-wrap: anywhere;
}

.order-detail__notice {
  padding: 12px;
  border: 1px solid #dbe4ff;
  border-radius: 12px;
  background: #eef2ff;
  color: #4456a8;
  font-size: 12px;
  line-height: 19px;
}

.order-detail__inline-error {
  color: #b42318;
  font-size: 13px;
  line-height: 20px;
}

.order-detail__actions {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding-bottom: 16px;
}
</style>
