<script setup lang="ts">
import { onLoad, onShow } from "@dcloudio/uni-app";
import {
  BOUNTY_ERROR_CODE,
  BOUNTY_INTENT_STATUS,
  BOUNTY_INTENT_STATUS_LABELS,
  BOUNTY_SERVICE_TYPE_LABELS,
  BOUNTY_STATUS,
  BOUNTY_STATUS_LABELS,
} from "@petcare/shared-types";
import type {
  BountyProviderEligibility,
  BountyServiceType,
  BountySop,
  BountySopEvidenceKind,
  MyBounty,
  MyBountyIntent,
  OwnerBountyIntent,
  PublicBounty,
} from "@petcare/shared-types";
import { computed, ref, watch } from "vue";
import {
  completeBountySopStep,
  confirmBountyIntent,
  getBountyIntents,
  getBountyProviderEligibility,
  getBountySop,
  getMyBounties,
  getMyBountyIntents,
  getPublicBounties,
  submitBountyIntent,
  uploadBountySopEvidence,
} from "@/api/bounties";
import { getSafeRequestErrorMessage, MiniappApiError } from "@/api/request";
import BountyPaymentPanel from "@/components/bounty/BountyPaymentPanel.vue";
import BountySopPanel from "@/components/bounty/BountySopPanel.vue";
import MainTabLayout from "@/components/MainTabLayout.vue";
import PcButton from "@/components/PcButton.vue";
import PcStatePanel from "@/components/PcStatePanel.vue";
import {
  commercialServicesEnabled,
  paymentSimulationEnabled,
  qualificationWorkflowEnabled,
} from "@/config/features";
import { formatBountyAmount } from "@/domain/bounty-form";
import { getDefaultAvatar } from "@/state/default-avatar";
import {
  captureSessionUserRevision,
  isSessionUserRevisionCurrent,
  requireProfile,
  session,
} from "@/state/session";

type BountyView = "public" | "mine" | "intents";
type PageStatus = "loading" | "ready" | "error" | "unauthenticated";
type CandidateStatus = "idle" | "loading" | "ready" | "error";
type SopStatus = "idle" | "loading" | "ready" | "error";
type PublicBountyFilter = "all" | BountyServiceType;
type PublicBountySort = "recommended" | "time" | "price";

function padDatePart(part: number): string {
  return part.toString().padStart(2, "0");
}

const activeView = ref<BountyView>("public");
const searchKeyword = ref("");
const serviceFilter = ref<PublicBountyFilter>("all");
const sortBy = ref<PublicBountySort>("recommended");
const publicBounties = ref<PublicBounty[]>([]);
const myBounties = ref<MyBounty[]>([]);
const myIntents = ref<MyBountyIntent[]>([]);
const ownerIntents = ref<Record<string, OwnerBountyIntent[]>>({});
const candidateStatuses = ref<Record<string, CandidateStatus>>({});
const bountySops = ref<Record<string, BountySop>>({});
const sopStatuses = ref<Record<string, SopStatus>>({});
const eligibility = ref<BountyProviderEligibility | null>(null);
const publicStatus = ref<PageStatus>("loading");
const mineStatus = ref<PageStatus>("loading");
const intentStatus = ref<PageStatus>("loading");
const providerContextStatus = ref<PageStatus>("loading");
const loading = ref(false);
const openingForm = ref(false);
const applyingBountyId = ref<string | null>(null);
const confirmingIntentId = ref<string | null>(null);
const sopBusy = ref<{ bountyId: string; key: string } | null>(null);
const sopUploadProgress = ref<number | null>(null);
const serverUnavailable = ref(false);
const actionMessage = ref("");
const actionFailed = ref(false);
const featureAvailable = computed(() => commercialServicesEnabled && !serverUnavailable.value);
const activeStatus = computed(() => {
  if (activeView.value === "mine") {
    return mineStatus.value;
  }

  if (activeView.value === "intents") {
    return intentStatus.value;
  }

  return publicStatus.value;
});
const intentByBountyId = computed(
  () => new Map(myIntents.value.map((intent) => [intent.bounty.id, intent])),
);
const serviceFilters: Array<{ value: PublicBountyFilter; label: string }> = [
  { value: "all", label: "全部" },
  { value: "feeding", label: "上门喂养" },
  { value: "walking", label: "遛狗" },
  { value: "playing", label: "陪玩" },
];
const publicSorts: Array<{ value: PublicBountySort; label: string }> = [
  { value: "recommended", label: "综合排序" },
  { value: "time", label: "时间最近" },
  { value: "price", label: "价格最低" },
];
const visiblePublicBounties = computed(() => {
  const keyword = searchKeyword.value.trim().toLocaleLowerCase();
  const filtered = publicBounties.value.filter((bounty) => {
    const matchesType = serviceFilter.value === "all" || bounty.serviceType === serviceFilter.value;
    const searchable = [
      bounty.pet.name,
      bounty.pet.breed,
      bounty.owner.nickname,
      BOUNTY_SERVICE_TYPE_LABELS[bounty.serviceType],
    ]
      .join(" ")
      .toLocaleLowerCase();

    return matchesType && (!keyword || searchable.includes(keyword));
  });

  if (sortBy.value === "time") {
    return [...filtered].sort(
      (left, right) => Date.parse(left.serviceTime) - Date.parse(right.serviceTime),
    );
  }

  if (sortBy.value === "price") {
    return [...filtered].sort((left, right) => left.amountCents - right.amountCents);
  }

  return filtered;
});

function formatServiceTime(value: string): string {
  const date = new Date(value);

  if (!Number.isFinite(date.getTime())) {
    return "时间待确认";
  }

  return `${date.getFullYear()}-${padDatePart(date.getMonth() + 1)}-${padDatePart(date.getDate())} ${padDatePart(date.getHours())}:${padDatePart(date.getMinutes())}`;
}

function isFeatureDisabled(error: unknown): boolean {
  return error instanceof MiniappApiError && error.code === BOUNTY_ERROR_CODE.FEATURE_DISABLED;
}

function showActionMessage(message: string, failed = false): void {
  actionMessage.value = message;
  actionFailed.value = failed;
}

function clearProviderContext(): void {
  eligibility.value = null;
  myIntents.value = [];
  providerContextStatus.value = session.bootstrapped ? "unauthenticated" : "loading";
  intentStatus.value = providerContextStatus.value;
  bountySops.value = {};
  sopStatuses.value = {};
  sopBusy.value = null;
  sopUploadProgress.value = null;
}

async function loadProviderContext(): Promise<void> {
  if (!session.user) {
    clearProviderContext();

    return;
  }

  providerContextStatus.value = "loading";
  intentStatus.value = "loading";
  const startedAt = captureSessionUserRevision();

  try {
    const [gate, intents] = await Promise.all([
      getBountyProviderEligibility(),
      getMyBountyIntents({ page: 1, pageSize: 20 }),
    ]);

    if (!isSessionUserRevisionCurrent(startedAt)) {
      clearProviderContext();

      return;
    }

    eligibility.value = gate;
    myIntents.value = intents.list;
    providerContextStatus.value = "ready";
    intentStatus.value = "ready";
  } catch (error) {
    eligibility.value = null;
    myIntents.value = [];

    if (!isSessionUserRevisionCurrent(startedAt)) {
      clearProviderContext();
    } else if (isFeatureDisabled(error)) {
      serverUnavailable.value = true;
    } else if (error instanceof MiniappApiError && error.statusCode === 401) {
      providerContextStatus.value = "unauthenticated";
      intentStatus.value = "unauthenticated";
    } else {
      providerContextStatus.value = "error";
      intentStatus.value = "error";
    }
  }
}

async function loadPublic(): Promise<void> {
  publicStatus.value = "loading";

  try {
    const response = await getPublicBounties({ page: 1, pageSize: 20 });

    publicBounties.value = response.list;
    publicStatus.value = "ready";

    if (session.user) {
      await loadProviderContext();
    } else {
      clearProviderContext();
    }
  } catch (error) {
    publicBounties.value = [];

    if (isFeatureDisabled(error)) {
      serverUnavailable.value = true;
    } else {
      publicStatus.value = "error";
    }
  }
}

async function loadMine(): Promise<void> {
  if (!session.user) {
    myBounties.value = [];
    mineStatus.value = session.bootstrapped ? "unauthenticated" : "loading";

    return;
  }

  mineStatus.value = "loading";
  const startedAt = captureSessionUserRevision();

  try {
    const response = await getMyBounties({ page: 1, pageSize: 20 });

    if (!isSessionUserRevisionCurrent(startedAt)) {
      myBounties.value = [];
      mineStatus.value = "unauthenticated";

      return;
    }

    myBounties.value = response.list;
    ownerIntents.value = {};
    candidateStatuses.value = {};
    mineStatus.value = "ready";
  } catch (error) {
    myBounties.value = [];

    if (!isSessionUserRevisionCurrent(startedAt)) {
      mineStatus.value = "unauthenticated";
    } else if (isFeatureDisabled(error)) {
      serverUnavailable.value = true;
    } else if (error instanceof MiniappApiError && error.statusCode === 401) {
      mineStatus.value = "unauthenticated";
    } else {
      mineStatus.value = "error";
    }
  }
}

async function loadActive(): Promise<void> {
  if (!featureAvailable.value || loading.value) {
    return;
  }

  loading.value = true;
  actionMessage.value = "";

  try {
    if (activeView.value === "mine") {
      await loadMine();
    } else if (activeView.value === "intents") {
      await loadProviderContext();
    } else {
      await loadPublic();
    }
  } finally {
    loading.value = false;
  }
}

function selectView(view: BountyView): void {
  if (!loading.value && activeView.value !== view) {
    activeView.value = view;
    void loadActive();
  }
}

function openLogin(): void {
  uni.navigateTo({ url: "/pages/auth/index" });
}

function openMap(): void {
  uni.navigateTo({ url: "/pages-bounty/map" });
}

function openBountyDetail(bountyId: string): void {
  uni.navigateTo({ url: `/pages-bounty/detail?bountyId=${encodeURIComponent(bountyId)}` });
}

function openOrderDetail(bountyId: string, role: "owner" | "provider"): void {
  uni.navigateTo({
    url: `/pages-orders/detail?bountyId=${encodeURIComponent(bountyId)}&role=${role}`,
  });
}

function openQualification(): void {
  if (qualificationWorkflowEnabled) {
    uni.navigateTo({ url: "/pages-qualification/index" });
  }
}

async function openForm(): Promise<void> {
  if (!featureAvailable.value || openingForm.value) {
    return;
  }

  openingForm.value = true;

  try {
    if (await requireProfile("/pages-bounty/form")) {
      await uni.navigateTo({ url: "/pages-bounty/form" });
    }
  } finally {
    openingForm.value = false;
  }
}

function intentButtonLabel(bountyId: string): string {
  const intent = intentByBountyId.value.get(bountyId);

  if (!session.user) {
    return "登录后接单";
  }

  if (providerContextStatus.value === "loading") {
    return "资格核验中";
  }

  if (providerContextStatus.value === "error") {
    return "资格读取失败";
  }

  if (!eligibility.value?.eligible) {
    return qualificationWorkflowEnabled ? "补充服务者资格" : "暂无接单资格";
  }

  if (intent) {
    return BOUNTY_INTENT_STATUS_LABELS[intent.status];
  }

  return "提交接单意向";
}

function intentButtonDisabled(bountyId: string): boolean {
  if (!session.user) {
    return false;
  }

  return (
    applyingBountyId.value !== null ||
    providerContextStatus.value !== "ready" ||
    (!eligibility.value?.eligible && !qualificationWorkflowEnabled) ||
    intentByBountyId.value.has(bountyId)
  );
}

async function submitIntent(bountyId: string): Promise<void> {
  if (!session.user) {
    openLogin();

    return;
  }

  if (intentButtonDisabled(bountyId)) {
    return;
  }

  if (!eligibility.value?.eligible) {
    openQualification();

    return;
  }

  applyingBountyId.value = bountyId;
  actionMessage.value = "";
  const startedAt = captureSessionUserRevision();

  try {
    const intent = await submitBountyIntent(bountyId);

    if (!isSessionUserRevisionCurrent(startedAt)) {
      return;
    }

    const existingIndex = myIntents.value.findIndex((item) => item.id === intent.id);

    if (existingIndex >= 0) {
      myIntents.value[existingIndex] = intent;
    } else {
      myIntents.value.unshift(intent);
    }

    showActionMessage("接单意向已提交，等待主人确认。", false);
  } catch (error) {
    if (!isSessionUserRevisionCurrent(startedAt)) {
      return;
    }

    if (
      error instanceof MiniappApiError &&
      error.code === BOUNTY_ERROR_CODE.PROVIDER_NOT_ELIGIBLE
    ) {
      eligibility.value = { eligible: false };
    }

    if (error instanceof MiniappApiError && error.code === BOUNTY_ERROR_CODE.NOT_OPEN) {
      publicBounties.value = publicBounties.value.filter((bounty) => bounty.id !== bountyId);
    }

    showActionMessage(getSafeRequestErrorMessage(error, "接单意向提交失败，请重试。"), true);
  } finally {
    applyingBountyId.value = null;
  }
}

function candidateStatus(bountyId: string): CandidateStatus {
  return candidateStatuses.value[bountyId] ?? "idle";
}

async function loadOwnerIntents(bountyId: string): Promise<void> {
  if (!session.user || candidateStatus(bountyId) === "loading") {
    return;
  }

  candidateStatuses.value[bountyId] = "loading";
  const startedAt = captureSessionUserRevision();

  try {
    const response = await getBountyIntents(bountyId, { page: 1, pageSize: 50 });

    if (!isSessionUserRevisionCurrent(startedAt)) {
      return;
    }

    ownerIntents.value[bountyId] = response.list;
    candidateStatuses.value[bountyId] = "ready";
  } catch (error) {
    if (!isSessionUserRevisionCurrent(startedAt)) {
      return;
    }

    candidateStatuses.value[bountyId] = "error";
    showActionMessage(getSafeRequestErrorMessage(error, "接单意向加载失败，请重试。"), true);
  }
}

async function confirmIntent(bounty: MyBounty, intent: OwnerBountyIntent): Promise<void> {
  if (
    bounty.status !== BOUNTY_STATUS.OPEN ||
    intent.status !== BOUNTY_INTENT_STATUS.PENDING ||
    confirmingIntentId.value
  ) {
    return;
  }

  const confirmation = await uni.showModal({
    title: "确认服务者",
    content: `确认由${intent.provider.nickname}接单？确认后其他意向将自动结束。`,
    confirmText: "确认接单",
  });

  if (!confirmation.confirm) {
    return;
  }

  confirmingIntentId.value = intent.id;
  actionMessage.value = "";
  const startedAt = captureSessionUserRevision();

  try {
    const confirmed = await confirmBountyIntent(bounty.id, intent.id);

    if (!isSessionUserRevisionCurrent(startedAt)) {
      return;
    }

    const bountyIndex = myBounties.value.findIndex((item) => item.id === confirmed.id);

    if (bountyIndex >= 0) {
      myBounties.value[bountyIndex] = confirmed;
    }

    publicBounties.value = publicBounties.value.filter((item) => item.id !== confirmed.id);
    await loadOwnerIntents(confirmed.id);
    await loadSop(confirmed.id);
    showActionMessage(`已确认${confirmed.provider?.nickname ?? "服务者"}接单。`, false);
  } catch (error) {
    if (!isSessionUserRevisionCurrent(startedAt)) {
      return;
    }

    if (
      error instanceof MiniappApiError &&
      (error.code === BOUNTY_ERROR_CODE.CONFIRMATION_CONFLICT ||
        error.code === BOUNTY_ERROR_CODE.NOT_OPEN)
    ) {
      await loadMine();
    }

    showActionMessage(getSafeRequestErrorMessage(error, "服务者确认失败，请重试。"), true);
  } finally {
    confirmingIntentId.value = null;
  }
}

function hasSop(status: MyBounty["status"]): boolean {
  return (
    status === BOUNTY_STATUS.CONFIRMED ||
    status === BOUNTY_STATUS.IN_PROGRESS ||
    status === BOUNTY_STATUS.COMPLETED
  );
}

function sopStatus(bountyId: string): SopStatus {
  return sopStatuses.value[bountyId] ?? "idle";
}

function sopBusyKey(bountyId: string): string | null {
  return sopBusy.value?.bountyId === bountyId ? sopBusy.value.key : null;
}

function applySopSnapshot(sop: BountySop): void {
  bountySops.value[sop.orderId] = sop;
  sopStatuses.value[sop.orderId] = "ready";
  myBounties.value = myBounties.value.map((bounty) =>
    bounty.id === sop.orderId ? { ...bounty, status: sop.orderStatus } : bounty,
  );
  myIntents.value = myIntents.value.map((intent) =>
    intent.bounty.id === sop.orderId
      ? { ...intent, bounty: { ...intent.bounty, status: sop.orderStatus } }
      : intent,
  );
}

async function loadSop(bountyId: string): Promise<void> {
  if (!session.user || sopStatus(bountyId) === "loading") {
    return;
  }

  sopStatuses.value[bountyId] = "loading";
  const startedAt = captureSessionUserRevision();

  try {
    const sop = await getBountySop(bountyId);

    if (isSessionUserRevisionCurrent(startedAt)) {
      applySopSnapshot(sop);
    }
  } catch (error) {
    if (isSessionUserRevisionCurrent(startedAt)) {
      sopStatuses.value[bountyId] = "error";
      showActionMessage(getSafeRequestErrorMessage(error, "履约记录加载失败，请重试。"), true);
    }
  }
}

async function uploadSopEvidence(
  bountyId: string,
  stepNumber: number,
  kind: BountySopEvidenceKind,
  filePath: string,
): Promise<void> {
  if (sopBusy.value) {
    return;
  }

  const busy = { bountyId, key: `${stepNumber}:upload-${kind}` };

  sopBusy.value = busy;
  sopUploadProgress.value = 0;
  const startedAt = captureSessionUserRevision();

  try {
    const sop = await uploadBountySopEvidence(bountyId, stepNumber, kind, filePath, (progress) => {
      if (isSessionUserRevisionCurrent(startedAt)) {
        sopUploadProgress.value = progress;
      }
    });

    if (isSessionUserRevisionCurrent(startedAt)) {
      applySopSnapshot(sop);
      showActionMessage(kind === "photo" ? "履约照片已上传。" : "履约视频已上传。", false);
    }
  } catch (error) {
    if (isSessionUserRevisionCurrent(startedAt)) {
      showActionMessage(getSafeRequestErrorMessage(error, "履约证据上传失败，请重试。"), true);
    }
  } finally {
    if (sopBusy.value === busy) {
      sopBusy.value = null;
      sopUploadProgress.value = null;
    }
  }
}

function chooseSopPhoto(bountyId: string, stepNumber: number): void {
  if (sopBusy.value) {
    return;
  }

  const busy = { bountyId, key: `${stepNumber}:choose-photo` };
  const startedAt = captureSessionUserRevision();

  sopBusy.value = busy;
  uni.chooseImage({
    count: 1,
    sizeType: ["compressed"],
    success(result) {
      const filePath = result.tempFilePaths[0];

      if (sopBusy.value === busy) {
        sopBusy.value = null;
      }

      if (filePath && isSessionUserRevisionCurrent(startedAt)) {
        void uploadSopEvidence(bountyId, stepNumber, "photo", filePath);
      }
    },
    fail() {
      if (sopBusy.value === busy) {
        sopBusy.value = null;
      }
    },
  });
}

function chooseSopVideo(bountyId: string, stepNumber: number): void {
  if (sopBusy.value) {
    return;
  }

  const busy = { bountyId, key: `${stepNumber}:choose-video` };
  const startedAt = captureSessionUserRevision();

  sopBusy.value = busy;
  uni.chooseVideo({
    sourceType: ["camera", "album"],
    compressed: true,
    maxDuration: 60,
    success(result) {
      if (sopBusy.value === busy) {
        sopBusy.value = null;
      }

      if (result.tempFilePath && isSessionUserRevisionCurrent(startedAt)) {
        void uploadSopEvidence(bountyId, stepNumber, "video", result.tempFilePath);
      }
    },
    fail() {
      if (sopBusy.value === busy) {
        sopBusy.value = null;
      }
    },
  });
}

async function completeSopStep(bountyId: string, stepNumber: number): Promise<void> {
  if (sopBusy.value) {
    return;
  }

  const confirmation = await uni.showModal({
    title: "完成当前步骤",
    content: "确认所需证据已经完整并完成当前服务步骤？",
    confirmText: "确认完成",
  });

  if (!confirmation.confirm) {
    return;
  }

  const busy = { bountyId, key: `${stepNumber}:complete` };

  sopBusy.value = busy;
  const startedAt = captureSessionUserRevision();

  try {
    const sop = await completeBountySopStep(bountyId, stepNumber);

    if (isSessionUserRevisionCurrent(startedAt)) {
      applySopSnapshot(sop);
      showActionMessage(
        sop.orderStatus === BOUNTY_STATUS.COMPLETED
          ? "全部履约步骤已完成。"
          : "当前步骤已完成，请继续下一步。",
        false,
      );
    }
  } catch (error) {
    if (isSessionUserRevisionCurrent(startedAt)) {
      showActionMessage(getSafeRequestErrorMessage(error, "履约步骤更新失败，请重试。"), true);
    }
  } finally {
    if (sopBusy.value === busy) {
      sopBusy.value = null;
    }
  }
}

onLoad((query = {}) => {
  if (query.tab === "mine" || query.tab === "intents") {
    activeView.value = query.tab;
  }
});

onShow(() => void loadActive());

watch(
  () => session.bootstrapped,
  (bootstrapped) => {
    if (bootstrapped) {
      void loadActive();
    }
  },
);
</script>

<template>
  <MainTabLayout active="bounty">
    <template #header>
      <text class="page-heading">悬赏大厅</text>
    </template>

    <view class="bounty-index box-border flex flex-col gap-copy px-action pb-screen pt-card">
      <PcStatePanel
        v-if="!featureAvailable"
        status="unavailable"
        title="悬赏服务未开放"
        description="当前构建未启用悬赏入口，已完成的个人版功能不受影响。"
      />

      <template v-else>
        <view v-if="paymentSimulationEnabled" class="main-card p-card-padding" role="status">
          <text class="text-body text-ink">当前订单不会发生真实扣款，完成后仍保持未收款状态。</text>
        </view>
        <view class="grid grid-cols-3 rounded-control bg-divider p-caption" role="tablist">
          <button
            class="h-control rounded-control text-body font-medium"
            :class="[
              activeView === 'public' ? 'bg-surface text-brand' : 'text-muted',
              loading ? 'cursor-not-allowed opacity-50' : '',
            ]"
            role="tab"
            :disabled="loading"
            :aria-disabled="loading"
            :aria-selected="activeView === 'public'"
            @click="selectView('public')"
          >
            悬赏广场
          </button>
          <button
            class="h-control rounded-control text-body font-medium"
            :class="[
              activeView === 'mine' ? 'bg-surface text-brand' : 'text-muted',
              loading ? 'cursor-not-allowed opacity-50' : '',
            ]"
            role="tab"
            :disabled="loading"
            :aria-disabled="loading"
            :aria-selected="activeView === 'mine'"
            @click="selectView('mine')"
          >
            我的悬赏
          </button>
          <button
            class="h-control rounded-control text-body font-medium"
            :class="[
              activeView === 'intents' ? 'bg-surface text-brand' : 'text-muted',
              loading ? 'cursor-not-allowed opacity-50' : '',
            ]"
            role="tab"
            :disabled="loading"
            :aria-disabled="loading"
            :aria-selected="activeView === 'intents'"
            @click="selectView('intents')"
          >
            我的意向
          </button>
        </view>

        <view v-if="activeView === 'public'" class="bounty-market-tools">
          <view class="bounty-search">
            <image class="h-icon-sm w-icon-sm" src="/static/main/search.svg" mode="aspectFit" />
            <input
              v-model="searchKeyword"
              class="bounty-search__input"
              type="text"
              placeholder="搜索服务、宠物或发布者"
              aria-label="搜索公开悬赏"
            />
          </view>

          <view class="bounty-mode-switch" role="tablist" aria-label="悬赏展示模式">
            <button class="bounty-mode-switch__item is-active" role="tab" aria-selected="true">
              列表模式
            </button>
            <button
              class="bounty-mode-switch__item"
              role="tab"
              aria-selected="false"
              @click="openMap"
            >
              地图模式
            </button>
          </view>

          <scroll-view class="bounty-chip-row" scroll-x :show-scrollbar="false" role="tablist">
            <button
              v-for="filter in serviceFilters"
              :key="filter.value"
              class="bounty-chip"
              :class="serviceFilter === filter.value ? 'is-active' : ''"
              role="tab"
              :aria-selected="serviceFilter === filter.value"
              @click="serviceFilter = filter.value"
            >
              {{ filter.label }}
            </button>
          </scroll-view>

          <scroll-view class="bounty-sort-row" scroll-x :show-scrollbar="false" role="tablist">
            <button
              v-for="sort in publicSorts"
              :key="sort.value"
              class="bounty-sort"
              :class="sortBy === sort.value ? 'is-active' : ''"
              role="tab"
              :aria-selected="sortBy === sort.value"
              @click="sortBy = sort.value"
            >
              {{ sort.label }}
            </button>
          </scroll-view>
        </view>

        <view
          v-if="actionMessage"
          class="border rounded-control p-copy text-body leading-body"
          :class="
            actionFailed
              ? 'border-danger bg-danger-soft text-danger'
              : 'border-border bg-soft text-ink'
          "
          :role="actionFailed ? 'alert' : 'status'"
          aria-live="polite"
        >
          <text>{{ actionMessage }}</text>
        </view>

        <PcStatePanel v-if="activeStatus === 'loading'" status="loading" title="悬赏加载中…" />

        <PcStatePanel
          v-else-if="activeStatus === 'unauthenticated'"
          status="unauthenticated"
          :title="activeView === 'intents' ? '登录后查看接单意向' : '登录后查看我的悬赏'"
          description="公开悬赏仍可在悬赏广场浏览。"
          primary-label="微信登录"
          @primary="openLogin"
        />

        <PcStatePanel
          v-else-if="activeStatus === 'error'"
          status="error"
          title="悬赏加载失败"
          description="请检查网络后重试。"
          primary-label="重新加载"
          :primary-disabled="loading"
          @primary="loadActive"
        />

        <template v-else-if="activeView === 'public'">
          <view
            v-if="session.user && providerContextStatus === 'ready' && !eligibility?.eligible"
            class="flex flex-col gap-caption border border-border rounded-card bg-soft p-card-padding"
            role="status"
          >
            <text class="card-heading">当前账号暂无接单资格</text>
            <text class="meta-text">
              请先补充并提交身份、培训和服务者认证材料；审核通过后即可继续接单。
            </text>
            <PcButton
              v-if="qualificationWorkflowEnabled"
              block
              variant="secondary"
              @click="openQualification"
            >
              补充服务者资格
            </PcButton>
          </view>

          <view
            v-else-if="session.user && providerContextStatus === 'error'"
            class="flex flex-col gap-copy border border-danger rounded-card bg-danger-soft p-card-padding"
            role="alert"
          >
            <text class="text-body text-danger leading-body">接单资格读取失败，请重试。</text>
            <PcButton
              block
              variant="secondary"
              :disabled="loading"
              :loading="loading"
              @click="loadProviderContext"
            >
              重新核验资格
            </PcButton>
          </view>

          <PcStatePanel
            v-if="publicBounties.length === 0 || visiblePublicBounties.length === 0"
            status="empty"
            :title="publicBounties.length === 0 ? '暂无公开悬赏' : '没有匹配的悬赏'"
            :description="
              publicBounties.length === 0
                ? '有新的有效悬赏时会在这里展示。'
                : '调整搜索词或服务类型，查看其他公开需求。'
            "
          />

          <view v-else class="flex flex-col gap-copy">
            <view
              v-for="bounty in visiblePublicBounties"
              :key="bounty.id"
              class="bounty-card main-card"
            >
              <view class="bounty-card__cover">
                <image
                  class="bounty-card__image"
                  :src="bounty.pet.coverImage || '/static/main/petcare-placeholder-light.svg'"
                  mode="aspectFill"
                  :aria-label="`${bounty.pet.name}的照片`"
                />
                <view class="bounty-card__cover-caption">
                  <text>{{ bounty.pet.name }} · {{ bounty.pet.breed || "宠物" }}</text>
                </view>
              </view>
              <view class="bounty-card__body">
                <view class="bounty-card__heading">
                  <text class="card-heading">
                    {{ BOUNTY_SERVICE_TYPE_LABELS[bounty.serviceType] }}
                  </text>
                  <view>
                    <text class="bounty-card__price">{{
                      formatBountyAmount(bounty.amountCents)
                    }}</text>
                    <text class="quiet-text"> / 单</text>
                  </view>
                </view>
                <view class="bounty-card__meta">
                  <image src="/static/main/profile-location.svg" mode="aspectFit" />
                  <text>{{ formatServiceTime(bounty.serviceTime) }}</text>
                </view>
                <text class="quiet-text">服务地址将在主人确认服务者后提供</text>
                <view class="bounty-card__footer">
                  <view class="bounty-owner">
                    <view class="bounty-owner__avatar" aria-hidden="true">
                      {{ bounty.owner.nickname.slice(0, 1) || "?" }}
                    </view>
                    <view class="bounty-owner__copy">
                      <text class="text-body text-ink">{{ bounty.owner.nickname }}</text>
                      <text class="quiet-text">公开需求 · 等待确认服务者</text>
                    </view>
                  </view>
                  <PcButton variant="ghost" @click="openBountyDetail(bounty.id)">
                    查看详情
                  </PcButton>
                </view>
                <PcButton
                  block
                  variant="secondary"
                  :disabled="intentButtonDisabled(bounty.id)"
                  :loading="applyingBountyId === bounty.id"
                  @click="submitIntent(bounty.id)"
                >
                  {{ intentButtonLabel(bounty.id) }}
                </PcButton>
              </view>
            </view>
          </view>
        </template>

        <template v-else-if="activeView === 'mine'">
          <PcStatePanel
            v-if="myBounties.length === 0"
            status="empty"
            title="还没有发布悬赏"
            description="发布后可在这里查看私有信息、候选服务者和订单状态。"
          />

          <view v-else class="flex flex-col gap-copy">
            <view
              v-for="bounty in myBounties"
              :key="bounty.id"
              class="flex flex-col gap-sm main-card p-card-padding"
            >
              <view class="flex items-start justify-between gap-copy">
                <view class="min-w-0 flex flex-col gap-caption">
                  <text class="card-heading">
                    {{ BOUNTY_SERVICE_TYPE_LABELS[bounty.serviceType] }} · {{ bounty.pet.name }}
                  </text>
                  <text class="meta-text">{{ formatServiceTime(bounty.serviceTime) }}</text>
                </view>
                <text class="shrink-0 text-amount text-brand font-semibold leading-section">
                  {{ formatBountyAmount(bounty.amountCents) }}
                </text>
              </view>
              <text class="text-body text-ink leading-body">{{ bounty.address }}</text>
              <text v-if="bounty.remark" class="meta-text">备注：{{ bounty.remark }}</text>
              <text class="quiet-text">当前状态：{{ BOUNTY_STATUS_LABELS[bounty.status] }}</text>
              <text v-if="bounty.provider" class="meta-text">
                已确认服务者：{{ bounty.provider.nickname }}
              </text>
              <PcButton block variant="ghost" @click="openOrderDetail(bounty.id, 'owner')">
                查看订单详情
              </PcButton>

              <BountyPaymentPanel
                v-if="bounty.status === BOUNTY_STATUS.CONFIRMED"
                :order-id="bounty.id"
                :amount-cents="bounty.amountCents"
              />

              <view class="mt-sm border-t border-divider pt-copy">
                <PcButton
                  v-if="candidateStatus(bounty.id) === 'idle'"
                  block
                  variant="secondary"
                  :disabled="Boolean(confirmingIntentId)"
                  @click="loadOwnerIntents(bounty.id)"
                >
                  {{ bounty.provider ? "查看意向结果" : "查看接单意向" }}
                </PcButton>

                <view
                  v-else-if="candidateStatus(bounty.id) === 'loading'"
                  class="py-copy text-center"
                  role="status"
                >
                  <text class="meta-text">接单意向加载中…</text>
                </view>

                <view
                  v-else-if="candidateStatus(bounty.id) === 'error'"
                  class="flex flex-col gap-sm"
                  role="alert"
                >
                  <text class="text-center text-small text-danger">接单意向加载失败</text>
                  <PcButton block variant="secondary" @click="loadOwnerIntents(bounty.id)">
                    重试
                  </PcButton>
                </view>

                <view v-else class="flex flex-col gap-sm">
                  <text v-if="(ownerIntents[bounty.id] ?? []).length === 0" class="meta-text">
                    暂无服务者提交意向
                  </text>
                  <template v-else>
                    <view
                      v-for="intent in ownerIntents[bounty.id] ?? []"
                      :key="intent.id"
                      class="flex flex-col gap-sm border border-border rounded-control p-copy"
                    >
                      <view class="flex items-center gap-sm">
                        <image
                          class="h-avatar-sm w-avatar-sm rounded-full bg-divider"
                          :src="intent.provider.avatar || getDefaultAvatar(intent.provider.id)"
                          mode="aspectFill"
                          :aria-label="`${intent.provider.nickname}的头像`"
                        />
                        <view class="min-w-0 flex flex-1 flex-col gap-caption">
                          <text class="text-body text-ink font-medium leading-body">
                            {{ intent.provider.nickname }}
                          </text>
                          <text class="quiet-text">
                            {{ BOUNTY_INTENT_STATUS_LABELS[intent.status] }}
                          </text>
                        </view>
                      </view>
                      <PcButton
                        v-if="
                          bounty.status === BOUNTY_STATUS.OPEN &&
                          intent.status === BOUNTY_INTENT_STATUS.PENDING
                        "
                        block
                        :disabled="Boolean(confirmingIntentId)"
                        :loading="confirmingIntentId === intent.id"
                        :aria-label="`确认${intent.provider.nickname}接单`"
                        @click="confirmIntent(bounty, intent)"
                      >
                        确认该服务者
                      </PcButton>
                    </view>
                  </template>
                </view>
              </view>

              <BountySopPanel
                v-if="hasSop(bounty.status)"
                :status="sopStatus(bounty.id)"
                :sop="bountySops[bounty.id]"
                :read-only="true"
                @load="loadSop(bounty.id)"
              />
            </view>
          </view>
        </template>

        <template v-else>
          <PcStatePanel
            v-if="myIntents.length === 0"
            status="empty"
            title="还没有接单意向"
            description="满足资格后，可在悬赏广场提交接单意向。"
          />

          <view v-else class="flex flex-col gap-copy">
            <view
              v-for="intent in myIntents"
              :key="intent.id"
              class="flex flex-col gap-sm main-card p-card-padding"
            >
              <view class="flex items-start justify-between gap-copy">
                <view class="min-w-0 flex flex-col gap-caption">
                  <text class="card-heading">
                    {{ BOUNTY_SERVICE_TYPE_LABELS[intent.bounty.serviceType] }} ·
                    {{ intent.bounty.pet.name }}
                  </text>
                  <text class="meta-text">{{ formatServiceTime(intent.bounty.serviceTime) }}</text>
                </view>
                <text class="shrink-0 text-amount text-brand font-semibold leading-section">
                  {{ formatBountyAmount(intent.bounty.amountCents) }}
                </text>
              </view>
              <text class="meta-text">发布者：{{ intent.bounty.owner.nickname }}</text>
              <text class="quiet-text">
                意向状态：{{ BOUNTY_INTENT_STATUS_LABELS[intent.status] }}
              </text>
              <view
                v-if="intent.status === BOUNTY_INTENT_STATUS.CONFIRMED"
                class="flex flex-col gap-caption rounded-control bg-soft p-copy"
              >
                <text class="text-body text-ink leading-body">{{ intent.bounty.address }}</text>
                <text v-if="intent.bounty.remark" class="meta-text">
                  备注：{{ intent.bounty.remark }}
                </text>
              </view>
              <PcButton
                v-if="intent.status === BOUNTY_INTENT_STATUS.CONFIRMED"
                block
                variant="ghost"
                @click="openOrderDetail(intent.bounty.id, 'provider')"
              >
                查看服务订单
              </PcButton>
              <BountySopPanel
                v-if="
                  intent.status === BOUNTY_INTENT_STATUS.CONFIRMED && hasSop(intent.bounty.status)
                "
                :status="sopStatus(intent.bounty.id)"
                :sop="bountySops[intent.bounty.id]"
                :read-only="false"
                :busy-key="sopBusyKey(intent.bounty.id)"
                :upload-progress="sopBusy?.bountyId === intent.bounty.id ? sopUploadProgress : null"
                @load="loadSop(intent.bounty.id)"
                @photo="chooseSopPhoto(intent.bounty.id, $event)"
                @video="chooseSopVideo(intent.bounty.id, $event)"
                @complete="completeSopStep(intent.bounty.id, $event)"
              />
            </view>
          </view>
        </template>
      </template>
    </view>

    <template #floating>
      <button
        class="bounty-index__fab"
        :disabled="!featureAvailable || openingForm"
        :aria-disabled="!featureAvailable || openingForm"
        aria-label="发布悬赏"
        @click="openForm"
      >
        <image src="/static/main/plus.svg" mode="aspectFit" aria-hidden="true" />
      </button>
    </template>
  </MainTabLayout>
</template>

<style scoped lang="scss">
.bounty-index {
  padding-bottom: 24px;
}

.bounty-market-tools {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 12px;
  border: 1px solid #eaecf0;
  border-radius: 18px;
  background: #fff;
}

.bounty-search {
  display: flex;
  height: 44px;
  align-items: center;
  gap: 8px;
  padding: 0 12px;
  border: 1px solid #eaecf0;
  border-radius: 12px;
  background: #fff;

  image {
    flex: none;
  }

  &__input {
    min-width: 0;
    flex: 1;
    color: #1f2937;
    font-size: 14px;
    line-height: 22px;
  }
}

.bounty-mode-switch {
  display: flex;
  height: 40px;
  align-items: center;
  gap: 4px;
  padding: 4px;
  border-radius: 999px;
  background: #f6f7fb;

  &__item {
    flex: 1;
    height: 32px;
    border: 0;
    border-radius: 999px;
    background: transparent;
    color: #667085;
    font-size: 14px;
    line-height: 32px;

    &.is-active {
      background: #fff;
      color: #4a6cf7;
    }
  }
}

.bounty-chip-row,
.bounty-sort-row {
  width: 100%;
  white-space: nowrap;
}

.bounty-chip {
  display: inline-flex;
  height: 32px;
  margin-right: 8px;
  padding: 0 12px;
  border: 1px solid #e3e8f2;
  border-radius: 999px;
  background: #fff;
  color: #667085;
  font-size: 12px;
  line-height: 30px;

  &.is-active {
    border-color: #eef2ff;
    background: #eef2ff;
    color: #4a6cf7;
  }
}

.bounty-sort {
  display: inline-flex;
  margin-right: 20px;
  padding: 4px 0;
  border: 0;
  background: transparent;
  color: #667085;
  font-size: 12px;

  &.is-active {
    color: #4a6cf7;
  }
}

.bounty-card {
  overflow: hidden;
  border: 1px solid #eaecf0;
  border-radius: 18px;
  background: #fff;

  &__cover {
    position: relative;
    height: 136px;
    background: #eef2f6;
  }

  &__image {
    width: 100%;
    height: 100%;
  }

  &__cover-caption {
    position: absolute;
    right: 0;
    bottom: 0;
    left: 0;
    padding: 20px 16px 10px;
    background: linear-gradient(transparent, rgba(17, 24, 39, 0.72));
    color: #fff;
    font-size: 12px;
    line-height: 18px;
  }

  &__body {
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding: 14px 16px 16px;
  }

  &__heading,
  &__footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
  }

  &__price {
    color: #b54708;
    font-size: 20px;
    font-weight: 600;
    line-height: 28px;
  }

  &__meta {
    display: flex;
    align-items: center;
    gap: 6px;
    color: #667085;
    font-size: 12px;
    line-height: 18px;

    image {
      width: 16px;
      height: 16px;
    }
  }
}

.bounty-owner {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 8px;

  &__avatar {
    display: flex;
    width: 34px;
    height: 34px;
    flex: none;
    align-items: center;
    justify-content: center;
    border-radius: 50%;
    background: #eefbf7;
    color: #11957a;
    font-size: 14px;
  }

  &__copy {
    display: flex;
    min-width: 0;
    flex-direction: column;
    gap: 2px;
  }
}

.bounty-index__fab {
  display: flex;
  width: 56px;
  height: 56px;
  align-items: center;
  justify-content: center;
  border: 0;
  border-radius: 50%;
  background: #4a6cf7;
  box-shadow: 0 8px 20px rgba(74, 108, 247, 0.24);

  image {
    width: 24px;
    height: 24px;
  }

  &:disabled {
    cursor: not-allowed;
    opacity: 0.5;
  }
}
</style>
