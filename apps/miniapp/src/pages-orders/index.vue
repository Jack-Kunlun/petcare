<script setup lang="ts">
import { onPullDownRefresh, onShow } from "@dcloudio/uni-app";
import {
  BOUNTY_INTENT_STATUS,
  BOUNTY_SERVICE_TYPE_LABELS,
  BOUNTY_STATUS,
  BOUNTY_STATUS_LABELS,
} from "@petcare/shared-types";
import type { MyBounty, MyBountyIntentBounty, OrderPaymentStatus } from "@petcare/shared-types";
import { computed, ref, watch } from "vue";
import type { OrderRecord } from "./order-data";
import { getMyBounties, getMyBountyIntents } from "@/api/bounties";
import { getOrderPayment } from "@/api/payment";
import { MiniappApiError } from "@/api/request";
import PcButton from "@/components/PcButton.vue";
import PcStatePanel from "@/components/PcStatePanel.vue";
import SubPageLayout from "@/components/SubPageLayout.vue";
import { commercialServicesEnabled } from "@/config/features";
import { captureSessionUserRevision, isSessionUserRevisionCurrent, session } from "@/state/session";
import type { SessionUserRevision } from "@/state/session";

definePage({ style: { navigationBarTextStyle: "black", navigationStyle: "custom" } });

const PAGE_SIZE = 20;

type PageStatus = "loading" | "ready" | "error" | "unauthenticated" | "unavailable";
type OrderFilter = "all" | "toPay" | "inProgress" | "completed" | "cancelled";
type PaymentViewStatus = OrderPaymentStatus | "ready" | "checking" | "unavailable" | "error";

const pageStatus = ref<PageStatus>(commercialServicesEnabled ? "loading" : "unavailable");
const records = ref<OrderRecord[]>([]);
const paymentStates = ref<Record<string, PaymentViewStatus>>({});
const activeFilter = ref<OrderFilter>("all");
const ownerPage = ref(0);
const ownerTotalPages = ref(0);
const intentPage = ref(0);
const intentTotalPages = ref(0);
const loading = ref(false);
const loadingMore = ref(false);
const errorMessage = ref("");

const filters: Array<{ value: OrderFilter; label: string }> = [
  { value: "all", label: "全部" },
  { value: "toPay", label: "待支付" },
  { value: "inProgress", label: "进行中" },
  { value: "completed", label: "已完成" },
  { value: "cancelled", label: "已取消" },
];

const hasMore = computed(
  () => ownerPage.value < ownerTotalPages.value || intentPage.value < intentTotalPages.value,
);
const visibleRecords = computed(() =>
  records.value
    .filter((record) => matchesFilter(record))
    .sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt)),
);

function isPaymentNotFound(error: unknown): boolean {
  return error instanceof MiniappApiError && error.code === "PAYMENT_NOT_FOUND";
}

function isPaymentUnavailable(error: unknown): boolean {
  return error instanceof MiniappApiError && error.code === "PAYMENT_NOT_OPEN";
}

function paymentViewStatus(status: OrderPaymentStatus): PaymentViewStatus {
  return status;
}

function completedPages(total: number, pageSize: number): number {
  return Math.ceil(total / pageSize);
}

function matchesFilter(record: OrderRecord): boolean {
  const status = record.bounty.status;

  if (activeFilter.value === "toPay") {
    return (
      record.role === "owner" &&
      status === BOUNTY_STATUS.CONFIRMED &&
      paymentStates.value[record.bounty.id] === "ready"
    );
  }

  if (activeFilter.value === "inProgress") {
    return status === BOUNTY_STATUS.IN_PROGRESS;
  }

  if (activeFilter.value === "completed") {
    return status === BOUNTY_STATUS.COMPLETED;
  }

  if (activeFilter.value === "cancelled") {
    return status === BOUNTY_STATUS.CANCELLED;
  }

  return true;
}

function paymentStateLabel(record: OrderRecord): string {
  if (record.bounty.status !== BOUNTY_STATUS.CONFIRMED) {
    return BOUNTY_STATUS_LABELS[record.bounty.status];
  }

  if (record.role === "provider") {
    return "已确认服务者";
  }

  const state = paymentStates.value[record.bounty.id] ?? "checking";
  const labels: Record<PaymentViewStatus, string> = {
    ready: "待支付",
    checking: "正在核对支付",
    pending: "支付确认中",
    succeeded: "已支付 · 待服务",
    simulated: "未收款记录",
    closed: "支付已关闭",
    refund_pending: "退款处理中",
    refunded: "已退款",
    unavailable: "支付暂未开放",
    error: "支付状态读取失败",
  };

  return labels[state];
}

function paymentTone(record: OrderRecord): string {
  const state = paymentStates.value[record.bounty.id];

  if (record.bounty.status === BOUNTY_STATUS.IN_PROGRESS) {
    return "order-status--active";
  }

  if (record.bounty.status === BOUNTY_STATUS.COMPLETED) {
    return "order-status--complete";
  }

  if (record.bounty.status === BOUNTY_STATUS.CANCELLED) {
    return "order-status--muted";
  }

  if (record.bounty.status === BOUNTY_STATUS.CONFIRMED && state === "ready") {
    return "order-status--waiting";
  }

  return "order-status--neutral";
}

function formatDate(value: string): string {
  const date = new Date(value);

  if (!Number.isFinite(date.getTime())) {
    return "时间待确认";
  }

  const now = new Date();
  const today = `${now.getFullYear()}-${now.getMonth()}-${now.getDate()}`;
  const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
  const sameDay = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
  const time = `${date.getHours().toString().padStart(2, "0")}:${date.getMinutes().toString().padStart(2, "0")}`;

  if (sameDay === today) {
    return `今天 ${time}`;
  }

  if (
    date.getFullYear() === yesterday.getFullYear() &&
    date.getMonth() === yesterday.getMonth() &&
    date.getDate() === yesterday.getDate()
  ) {
    return `昨天 ${time}`;
  }

  return `${date.getMonth() + 1}月${date.getDate()}日 ${time}`;
}

function formatServiceTime(value: string): string {
  const date = new Date(value);

  if (!Number.isFinite(date.getTime())) {
    return "服务时间待确认";
  }

  const day = `${date.getMonth() + 1}月${date.getDate()}日`;
  const time = `${date.getHours().toString().padStart(2, "0")}:${date.getMinutes().toString().padStart(2, "0")}`;

  return `${day} ${time}`;
}

function formatAmount(amountCents: number): string {
  return `¥${(amountCents / 100).toFixed(2)}`;
}

function servicePet(record: OrderRecord): MyBounty["pet"] | MyBountyIntentBounty["pet"] {
  return record.bounty.pet;
}

function serviceName(record: OrderRecord): string {
  return `${servicePet(record).name}`;
}

function serviceSummary(record: OrderRecord): string {
  return `${BOUNTY_SERVICE_TYPE_LABELS[record.bounty.serviceType]} · ${servicePet(record).breed || "宠物资料"}`;
}

function openDetail(record: OrderRecord): void {
  uni.navigateTo({
    url: `/pages-orders/detail?bountyId=${encodeURIComponent(record.bounty.id)}&role=${record.role}`,
  });
}

function openBountyIntents(): void {
  uni.navigateTo({ url: "/pages-bounty/index?tab=mine" });
}

function openMonitor(record: OrderRecord): void {
  uni.navigateTo({
    url: `/pages-orders/monitor?bountyId=${encodeURIComponent(record.bounty.id)}&role=${record.role}`,
  });
}

async function readOwnerPaymentStates(
  bounties: MyBounty[],
  revision: SessionUserRevision,
): Promise<void> {
  const confirmed = bounties.filter((bounty) => bounty.status === BOUNTY_STATUS.CONFIRMED);

  async function readBatch(index: number): Promise<void> {
    const batch = confirmed.slice(index, index + 4);

    if (batch.length === 0) {
      return;
    }

    const results = await Promise.allSettled(
      batch.map(async (bounty) => {
        try {
          const payment = await getOrderPayment(bounty.id);

          return { id: bounty.id, state: paymentViewStatus(payment.status) };
        } catch (error) {
          if (isPaymentNotFound(error)) {
            return { id: bounty.id, state: "ready" as const };
          }

          if (isPaymentUnavailable(error)) {
            return { id: bounty.id, state: "unavailable" as const };
          }

          return { id: bounty.id, state: "error" as const };
        }
      }),
    );

    if (!isSessionUserRevisionCurrent(revision)) {
      return;
    }

    const next = { ...paymentStates.value };

    for (const result of results) {
      if (result.status === "fulfilled") {
        next[result.value.id] = result.value.state;
      }
    }

    paymentStates.value = next;

    return readBatch(index + 4);
  }

  return readBatch(0);
}

function ownerRecords(list: MyBounty[]): OrderRecord[] {
  return list.map((bounty) => ({ role: "owner", bounty, createdAt: bounty.createdAt }));
}

function providerRecords(
  list: MyBountyIntentBounty[],
  createdAtById: Map<string, string>,
): OrderRecord[] {
  return list.map((bounty) => ({
    role: "provider",
    bounty,
    createdAt: createdAtById.get(bounty.id) ?? "",
  }));
}

async function loadFirstPage(): Promise<void> {
  if (loading.value || !commercialServicesEnabled) {
    return;
  }

  if (!session.user) {
    records.value = [];
    pageStatus.value = session.bootstrapped ? "unauthenticated" : "loading";

    return;
  }

  loading.value = true;
  pageStatus.value = "loading";
  errorMessage.value = "";
  paymentStates.value = {};
  ownerPage.value = 0;
  ownerTotalPages.value = 0;
  intentPage.value = 0;
  intentTotalPages.value = 0;
  const revision = captureSessionUserRevision();

  try {
    const [owned, intents] = await Promise.all([
      getMyBounties({ page: 1, pageSize: PAGE_SIZE }),
      getMyBountyIntents({ page: 1, pageSize: PAGE_SIZE }),
    ]);

    if (!isSessionUserRevisionCurrent(revision)) {
      records.value = [];
      pageStatus.value = "unauthenticated";

      return;
    }

    const confirmedIntents = intents.list.filter(
      (intent) => intent.status === BOUNTY_INTENT_STATUS.CONFIRMED,
    );

    records.value = [
      ...ownerRecords(owned.list),
      ...providerRecords(
        confirmedIntents.map((intent) => intent.bounty),
        new Map(confirmedIntents.map((intent) => [intent.bounty.id, intent.createdAt])),
      ),
    ];
    ownerPage.value = 1;
    ownerTotalPages.value = completedPages(owned.total, owned.pageSize);
    intentPage.value = 1;
    intentTotalPages.value = completedPages(intents.total, intents.pageSize);
    pageStatus.value = "ready";
    void readOwnerPaymentStates(owned.list, revision);
  } catch (error) {
    if (isSessionUserRevisionCurrent(revision)) {
      records.value = [];

      if (error instanceof MiniappApiError && error.statusCode === 401) {
        pageStatus.value = "unauthenticated";
      } else {
        pageStatus.value = "error";
        errorMessage.value = "订单读取失败，请重试。";
      }
    }
  } finally {
    loading.value = false;
  }
}

async function loadMore(): Promise<void> {
  if (loadingMore.value || !hasMore.value || !session.user) {
    return;
  }

  loadingMore.value = true;
  errorMessage.value = "";
  const revision = captureSessionUserRevision();
  const nextOwnerPage = ownerPage.value < ownerTotalPages.value ? ownerPage.value + 1 : null;
  const nextIntentPage = intentPage.value < intentTotalPages.value ? intentPage.value + 1 : null;

  try {
    const [owned, intents] = await Promise.all([
      nextOwnerPage
        ? getMyBounties({ page: nextOwnerPage, pageSize: PAGE_SIZE })
        : Promise.resolve(null),
      nextIntentPage
        ? getMyBountyIntents({ page: nextIntentPage, pageSize: PAGE_SIZE })
        : Promise.resolve(null),
    ]);

    if (!isSessionUserRevisionCurrent(revision)) {
      return;
    }

    const confirmedIntents =
      intents?.list.filter((intent) => intent.status === BOUNTY_INTENT_STATUS.CONFIRMED) ?? [];
    const moreRecords = [
      ...(owned ? ownerRecords(owned.list) : []),
      ...providerRecords(
        confirmedIntents.map((intent) => intent.bounty),
        new Map(confirmedIntents.map((intent) => [intent.bounty.id, intent.createdAt])),
      ),
    ];
    const existingKeys = new Set(
      records.value.map((record) => `${record.role}:${record.bounty.id}`),
    );

    records.value = [
      ...records.value,
      ...moreRecords.filter((record) => !existingKeys.has(`${record.role}:${record.bounty.id}`)),
    ];

    if (owned && nextOwnerPage) {
      ownerPage.value = nextOwnerPage;
      void readOwnerPaymentStates(owned.list, revision);
    }

    if (intents && nextIntentPage) {
      intentPage.value = nextIntentPage;
    }
  } catch {
    if (isSessionUserRevisionCurrent(revision)) {
      errorMessage.value = "更多订单加载失败，请重试。";
    }
  } finally {
    loadingMore.value = false;
  }
}

function selectFilter(filter: OrderFilter): void {
  activeFilter.value = filter;
}

function openLogin(): void {
  uni.navigateTo({ url: "/pages/auth/index" });
}

onShow(() => void loadFirstPage());
watch(
  () => session.bootstrapped,
  (bootstrapped) => {
    if (bootstrapped) {
      void loadFirstPage();
    }
  },
);
onPullDownRefresh(() => {
  void loadFirstPage().finally(() => uni.stopPullDownRefresh());
});
</script>

<template>
  <SubPageLayout title="我的订单">
    <view class="orders-index flex flex-col gap-copy px-action pb-section pt-copy">
      <PcStatePanel
        v-if="pageStatus === 'unavailable'"
        status="unavailable"
        title="订单服务未开放"
        description="当前构建未启用商业服务，订单入口暂不可用。"
      />
      <PcStatePanel
        v-else-if="pageStatus === 'unauthenticated'"
        status="unauthenticated"
        title="登录后查看订单"
        description="订单与服务记录仅对参与者本人开放。"
        primary-label="微信登录"
        @primary="openLogin"
      />
      <PcStatePanel v-else-if="pageStatus === 'loading'" status="loading" title="订单加载中…" />
      <PcStatePanel
        v-else-if="pageStatus === 'error'"
        status="error"
        title="订单读取失败"
        :description="errorMessage"
        primary-label="重试"
        @primary="loadFirstPage"
      />

      <template v-else>
        <scroll-view
          class="orders-filter-scroll"
          scroll-x
          :show-scrollbar="false"
          aria-label="订单状态筛选"
        >
          <view class="orders-filter-row" role="tablist">
            <button
              v-for="filter in filters"
              :key="filter.value"
              class="orders-filter"
              :class="{ 'orders-filter--active': activeFilter === filter.value }"
              role="tab"
              :aria-selected="activeFilter === filter.value"
              @click="selectFilter(filter.value)"
            >
              {{ filter.label }}
            </button>
          </view>
        </scroll-view>

        <view v-if="errorMessage" class="orders-inline-error" role="alert">
          <text>{{ errorMessage }}</text>
          <PcButton size="control" variant="ghost" @click="loadMore">重试</PcButton>
        </view>

        <PcStatePanel
          v-if="records.length === 0"
          status="empty"
          title="暂无订单"
          description="发布悬赏或被确认接单后，相关记录会显示在这里。"
        />
        <PcStatePanel
          v-else-if="visibleRecords.length === 0"
          status="empty"
          title="这个分类下还没有订单"
          description="可以切换其他状态查看记录。"
        />

        <view v-else class="flex flex-col gap-copy">
          <view
            v-for="record in visibleRecords"
            :key="`${record.role}:${record.bounty.id}`"
            class="order-card"
          >
            <view class="flex items-start justify-between gap-copy">
              <text class="quiet-text">{{ formatDate(record.createdAt) }}</text>
              <text class="order-status" :class="paymentTone(record)">
                {{ paymentStateLabel(record) }}
              </text>
            </view>

            <view class="order-pet-row">
              <image
                class="order-pet-image"
                :src="servicePet(record).coverImage || '/static/main/petcare-placeholder-light.svg'"
                mode="aspectFill"
                :aria-label="`${servicePet(record).name}的资料照片`"
                @click="openDetail(record)"
              />
              <view class="min-w-0 flex-1" role="button" @click="openDetail(record)">
                <text class="order-pet-name">{{ serviceName(record) }}</text>
                <text class="order-service-summary">{{ serviceSummary(record) }}</text>
              </view>
              <text class="order-role">{{ record.role === "owner" ? "发布者" : "服务者" }}</text>
            </view>

            <view class="order-service-time">
              <image
                class="h-icon-sm w-icon-sm"
                src="/static/main/clock.svg"
                mode="aspectFit"
                aria-hidden="true"
              />
              <text>{{ formatServiceTime(record.bounty.serviceTime) }}</text>
            </view>

            <view class="order-divider" />

            <view class="order-total-row">
              <text class="meta-text">订单金额</text>
              <text class="order-amount">{{ formatAmount(record.bounty.amountCents) }}</text>
            </view>

            <view class="order-actions">
              <PcButton
                v-if="record.role === 'owner' && record.bounty.status === BOUNTY_STATUS.OPEN"
                variant="secondary"
                @click="openBountyIntents"
              >
                管理接单意向
              </PcButton>
              <PcButton
                v-if="record.bounty.status === BOUNTY_STATUS.IN_PROGRESS"
                variant="primary"
                @click="openMonitor(record)"
              >
                查看履约记录
              </PcButton>
              <PcButton v-else variant="secondary" @click="openDetail(record)">查看订单</PcButton>
            </view>
          </view>

          <view v-if="hasMore" class="orders-more">
            <PcButton
              block
              variant="ghost"
              :disabled="loadingMore"
              :loading="loadingMore"
              @click="loadMore"
            >
              {{ loadingMore ? "加载中…" : "加载更多" }}
            </PcButton>
          </view>
        </view>
      </template>
    </view>
  </SubPageLayout>
</template>

<style scoped lang="scss">
.orders-index {
  min-height: 100%;
  background: #f7f9fc;
}

.orders-filter-scroll {
  width: 100%;
  margin: 0 -16px;
  padding: 0 16px;
  box-sizing: content-box;
  border-bottom: 1px solid #e8edf5;
  background: #ffffff;
}

.orders-filter-row {
  display: inline-flex;
  min-width: 100%;
  justify-content: space-between;
  gap: 22px;
}

.orders-filter {
  position: relative;
  flex-shrink: 0;
  height: 44px;
  padding: 0 2px;
  border: 0;
  background: transparent;
  color: #667085;
  font-size: 14px;
  line-height: 20px;
}

.orders-filter--active {
  color: #4a6cf7;
  font-weight: 600;
}

.orders-filter--active::after {
  position: absolute;
  right: 0;
  bottom: 0;
  left: 0;
  height: 2px;
  border-radius: 2px 2px 0 0;
  background: #4a6cf7;
  content: "";
}

.order-card {
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 16px;
  border: 1px solid #edf0f5;
  border-radius: 18px;
  background: #ffffff;
  box-shadow: 0 3px 14px rgb(31 41 55 / 3%);
}

.order-status {
  flex-shrink: 0;
  padding: 4px 10px;
  border-radius: 999px;
  background: #eef2ff;
  color: #4a6cf7;
  font-size: 12px;
  line-height: 18px;
}

.order-status--waiting {
  background: #eef2ff;
  color: #4a6cf7;
}

.order-status--active {
  background: #e9f9f4;
  color: #14836c;
}

.order-status--complete {
  background: #e6f7f2;
  color: #087e68;
}

.order-status--muted,
.order-status--neutral {
  background: #f2f4f7;
  color: #667085;
}

.order-pet-row {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
}

.order-pet-image {
  width: 54px;
  height: 54px;
  flex-shrink: 0;
  border-radius: 999px;
  background: #eef2f7;
}

.order-pet-name,
.order-service-summary {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.order-pet-name {
  color: #1d2939;
  font-size: 16px;
  font-weight: 600;
  line-height: 24px;
}

.order-service-summary {
  margin-top: 2px;
  color: #667085;
  font-size: 14px;
  line-height: 20px;
}

.order-role {
  flex-shrink: 0;
  padding: 4px 8px;
  border-radius: 999px;
  background: #f2f4f7;
  color: #667085;
  font-size: 11px;
  line-height: 16px;
}

.order-service-time {
  display: flex;
  align-items: center;
  gap: 8px;
  color: #667085;
  font-size: 13px;
  line-height: 20px;
}

.order-divider {
  height: 1px;
  background: #edf0f5;
}

.order-total-row,
.order-actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.order-amount {
  color: #1d2939;
  font-size: 18px;
  font-weight: 600;
  line-height: 26px;
}

.order-actions {
  justify-content: flex-end;
  flex-wrap: wrap;
}

.orders-inline-error {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 10px 12px;
  border: 1px solid #fecdca;
  border-radius: 12px;
  background: #fef3f2;
  color: #b42318;
  font-size: 13px;
}

.orders-more {
  padding: 4px 0 16px;
}
</style>
