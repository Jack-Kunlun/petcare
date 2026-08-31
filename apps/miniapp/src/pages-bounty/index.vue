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
  MyBounty,
  MyBountyIntent,
  OwnerBountyIntent,
  PublicBounty,
} from "@petcare/shared-types";
import { computed, ref, watch } from "vue";
import {
  confirmBountyIntent,
  getBountyIntents,
  getBountyProviderEligibility,
  getMyBounties,
  getMyBountyIntents,
  getPublicBounties,
  submitBountyIntent,
} from "@/api/bounties";
import { getSafeRequestErrorMessage, MiniappApiError } from "@/api/request";
import PcButton from "@/components/PcButton.vue";
import PcStatePanel from "@/components/PcStatePanel.vue";
import SubPageLayout from "@/components/SubPageLayout.vue";
import { commercialServicesEnabled } from "@/config/features";
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

function padDatePart(part: number): string {
  return part.toString().padStart(2, "0");
}

const activeView = ref<BountyView>("public");
const publicBounties = ref<PublicBounty[]>([]);
const myBounties = ref<MyBounty[]>([]);
const myIntents = ref<MyBountyIntent[]>([]);
const ownerIntents = ref<Record<string, OwnerBountyIntent[]>>({});
const candidateStatuses = ref<Record<string, CandidateStatus>>({});
const eligibility = ref<BountyProviderEligibility | null>(null);
const publicStatus = ref<PageStatus>("loading");
const mineStatus = ref<PageStatus>("loading");
const intentStatus = ref<PageStatus>("loading");
const providerContextStatus = ref<PageStatus>("loading");
const loading = ref(false);
const openingForm = ref(false);
const applyingBountyId = ref<string | null>(null);
const confirmingIntentId = ref<string | null>(null);
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
    return "暂无接单资格";
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
    !eligibility.value?.eligible ||
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
  <SubPageLayout title="悬赏服务">
    <view class="flex flex-col gap-copy px-action py-card">
      <PcStatePanel
        v-if="!featureAvailable"
        status="unavailable"
        title="悬赏服务未开放"
        description="当前构建未启用悬赏入口，已完成的个人版功能不受影响。"
      />

      <template v-else>
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
              接单要求服务者账号、有效手机号及完整身份、培训和服务者认证记录；资质外部接入尚未开放。
            </text>
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
            v-if="publicBounties.length === 0"
            status="empty"
            title="暂无公开悬赏"
            description="有新的有效悬赏时会在这里展示。"
          />

          <view v-else class="flex flex-col gap-copy">
            <view
              v-for="bounty in publicBounties"
              :key="bounty.id"
              class="flex flex-col gap-copy main-card p-card-padding"
            >
              <view class="flex items-start justify-between gap-copy">
                <view class="min-w-0 flex flex-col gap-caption">
                  <text class="card-heading">
                    {{ BOUNTY_SERVICE_TYPE_LABELS[bounty.serviceType] }} · {{ bounty.pet.name }}
                  </text>
                  <text class="meta-text">{{ bounty.pet.breed }}</text>
                </view>
                <text class="shrink-0 text-amount text-brand font-semibold leading-section">
                  {{ formatBountyAmount(bounty.amountCents) }}
                </text>
              </view>
              <view class="flex items-center gap-sm">
                <image
                  class="h-avatar-sm w-avatar-sm rounded-full bg-divider"
                  :src="bounty.pet.coverImage || '/static/main/petcare-placeholder-light.svg'"
                  mode="aspectFill"
                  :aria-label="`${bounty.pet.name}的照片`"
                />
                <view class="min-w-0 flex flex-1 flex-col gap-caption">
                  <text class="meta-text"
                    >服务时间 {{ formatServiceTime(bounty.serviceTime) }}</text
                  >
                  <text class="quiet-text">发布者 {{ bounty.owner.nickname }} · 待确认服务者</text>
                </view>
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
            </view>
          </view>
        </template>
      </template>
    </view>

    <template v-if="featureAvailable" #actions>
      <PcButton
        block
        size="action"
        :disabled="openingForm"
        :loading="openingForm"
        @click="openForm"
      >
        发布悬赏
      </PcButton>
    </template>
  </SubPageLayout>
</template>
