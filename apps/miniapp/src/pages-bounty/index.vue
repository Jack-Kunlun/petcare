<script setup lang="ts">
import { onLoad, onShow } from "@dcloudio/uni-app";
import { BOUNTY_ERROR_CODE, BOUNTY_SERVICE_TYPE_LABELS } from "@petcare/shared-types";
import type { MyBounty, PublicBounty } from "@petcare/shared-types";
import { computed, ref, watch } from "vue";
import { getMyBounties, getPublicBounties } from "@/api/bounties";
import { MiniappApiError } from "@/api/request";
import PcButton from "@/components/PcButton.vue";
import PcStatePanel from "@/components/PcStatePanel.vue";
import SubPageLayout from "@/components/SubPageLayout.vue";
import { commercialServicesEnabled } from "@/config/features";
import { formatBountyAmount } from "@/domain/bounty-form";
import {
  captureSessionUserRevision,
  isSessionUserRevisionCurrent,
  requireProfile,
  session,
} from "@/state/session";

type BountyView = "public" | "mine";
type PageStatus = "loading" | "ready" | "error" | "unauthenticated";

function padDatePart(part: number): string {
  return part.toString().padStart(2, "0");
}

const activeView = ref<BountyView>("public");
const publicBounties = ref<PublicBounty[]>([]);
const myBounties = ref<MyBounty[]>([]);
const publicStatus = ref<PageStatus>("loading");
const mineStatus = ref<PageStatus>("loading");
const loading = ref(false);
const openingForm = ref(false);
const serverUnavailable = ref(false);
const featureAvailable = computed(() => commercialServicesEnabled && !serverUnavailable.value);
const activeStatus = computed(() =>
  activeView.value === "public" ? publicStatus.value : mineStatus.value,
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

async function loadPublic(): Promise<void> {
  publicStatus.value = "loading";

  try {
    const response = await getPublicBounties({ page: 1, pageSize: 20 });

    publicBounties.value = response.list;
    publicStatus.value = "ready";
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

  try {
    if (activeView.value === "public") {
      await loadPublic();
    } else {
      await loadMine();
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

onLoad((query = {}) => {
  if (query.tab === "mine") {
    activeView.value = "mine";
  }
});

onShow(() => void loadActive());

watch(
  () => session.bootstrapped,
  (bootstrapped) => {
    if (bootstrapped && activeView.value === "mine") {
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
        <view class="grid grid-cols-2 rounded-control bg-divider p-caption" role="tablist">
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
        </view>

        <PcStatePanel v-if="activeStatus === 'loading'" status="loading" title="悬赏加载中…" />

        <PcStatePanel
          v-else-if="activeStatus === 'unauthenticated'"
          status="unauthenticated"
          title="登录后查看我的悬赏"
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
                  <text class="quiet-text">发布者 {{ bounty.owner.nickname }} · 待接单</text>
                </view>
              </view>
            </view>
          </view>
        </template>

        <template v-else>
          <PcStatePanel
            v-if="myBounties.length === 0"
            status="empty"
            title="还没有发布悬赏"
            description="发布后可在这里查看私有地址、备注和当前状态。"
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
              <text class="quiet-text">当前状态：待接单</text>
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
