<script setup lang="ts">
import { onLoad, onShow } from "@dcloudio/uni-app";
import {
  BOUNTY_ERROR_CODE,
  BOUNTY_INTENT_STATUS_LABELS,
  BOUNTY_SERVICE_TYPE_LABELS,
  BOUNTY_STATUS,
  BOUNTY_STATUS_LABELS,
} from "@petcare/shared-types";
import type { MyBountyIntent, PublicBounty } from "@petcare/shared-types";
import { computed, ref, watch } from "vue";
import {
  getBountyProviderEligibility,
  getMyBountyIntents,
  getPublicBounty,
  submitBountyIntent,
} from "@/api/bounties";
import { getSafeRequestErrorMessage, MiniappApiError } from "@/api/request";
import PcButton from "@/components/PcButton.vue";
import PcStatePanel from "@/components/PcStatePanel.vue";
import SubPageLayout from "@/components/SubPageLayout.vue";
import { commercialServicesEnabled, qualificationWorkflowEnabled } from "@/config/features";
import { formatBountyAmount } from "@/domain/bounty-form";
import { captureSessionUserRevision, isSessionUserRevisionCurrent, session } from "@/state/session";

type PageStatus = "loading" | "ready" | "error" | "unavailable";
type ProviderStatus = "idle" | "loading" | "ready" | "error";

const bountyId = ref("");
const bounty = ref<PublicBounty | null>(null);
const status = ref<PageStatus>(commercialServicesEnabled ? "loading" : "unavailable");
const providerStatus = ref<ProviderStatus>("idle");
const providerEligible = ref(false);
const providerIntent = ref<MyBountyIntent | null>(null);
const applying = ref(false);
const actionMessage = ref("");
const actionFailed = ref(false);
const serviceTime = computed(() => {
  if (!bounty.value) {
    return "";
  }

  const date = new Date(bounty.value.serviceTime);

  return Number.isFinite(date.getTime())
    ? new Intl.DateTimeFormat("zh-CN", {
        month: "long",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }).format(date)
    : "时间待确认";
});

function setMessage(message: string, failed = false): void {
  actionMessage.value = message;
  actionFailed.value = failed;
}

function openLogin(): void {
  uni.navigateTo({ url: "/pages/auth/index" });
}

function openQualification(): void {
  if (qualificationWorkflowEnabled) {
    uni.navigateTo({ url: "/pages-qualification/index" });
  } else {
    setMessage("当前账号暂无接单资格。", true);
  }
}

async function loadProviderContext(): Promise<void> {
  if (!session.user) {
    providerStatus.value = "idle";
    providerEligible.value = false;
    providerIntent.value = null;

    return;
  }

  providerStatus.value = "loading";
  const startedAt = captureSessionUserRevision();

  try {
    const [eligibility, intents] = await Promise.all([
      getBountyProviderEligibility(),
      getMyBountyIntents({ page: 1, pageSize: 50 }),
    ]);

    if (!isSessionUserRevisionCurrent(startedAt)) {
      return;
    }

    providerEligible.value = eligibility.eligible;
    providerIntent.value =
      intents.list.find((intent) => intent.bounty.id === bountyId.value) ?? null;
    providerStatus.value = "ready";
  } catch {
    if (isSessionUserRevisionCurrent(startedAt)) {
      providerStatus.value = "error";
      providerEligible.value = false;
      providerIntent.value = null;
    }
  }
}

async function load(): Promise<void> {
  if (!commercialServicesEnabled) {
    status.value = "unavailable";

    return;
  }

  if (!bountyId.value) {
    status.value = "error";
    actionMessage.value = "悬赏编号无效，请从悬赏大厅重新打开。";

    return;
  }

  status.value = "loading";
  actionMessage.value = "";

  try {
    bounty.value = await getPublicBounty(bountyId.value);
    status.value = "ready";
    await loadProviderContext();
  } catch (error) {
    bounty.value = null;

    if (error instanceof MiniappApiError && error.code === BOUNTY_ERROR_CODE.FEATURE_DISABLED) {
      status.value = "unavailable";
    } else {
      status.value = "error";
      actionMessage.value = getSafeRequestErrorMessage(error, "悬赏详情加载失败，请重试。");
    }
  }
}

async function apply(): Promise<void> {
  if (!session.user) {
    openLogin();

    return;
  }

  if (applying.value || !bounty.value || bounty.value.status !== BOUNTY_STATUS.OPEN) {
    return;
  }

  if (providerStatus.value === "error") {
    await loadProviderContext();

    return;
  }

  if (providerStatus.value !== "ready") {
    return;
  }

  if (!providerEligible.value) {
    openQualification();

    return;
  }

  if (providerIntent.value) {
    return;
  }

  applying.value = true;
  actionMessage.value = "";
  const startedAt = captureSessionUserRevision();

  try {
    const intent = await submitBountyIntent(bountyId.value);

    if (isSessionUserRevisionCurrent(startedAt)) {
      providerIntent.value = intent;
      setMessage("接单意向已提交，等待主人确认。", false);
    }
  } catch (error) {
    if (isSessionUserRevisionCurrent(startedAt)) {
      if (error instanceof MiniappApiError && error.code === BOUNTY_ERROR_CODE.NOT_OPEN) {
        await load();
        setMessage("该悬赏已停止接受新意向，请查看最新状态。", true);
      } else {
        setMessage(getSafeRequestErrorMessage(error, "接单意向提交失败，请重试。"), true);
      }
    }
  } finally {
    applying.value = false;
  }
}

function applyButtonLabel(): string {
  if (!session.user) {
    return "登录后报名";
  }

  if (providerStatus.value === "loading") {
    return "正在核验资格";
  }

  if (providerStatus.value === "error") {
    return "重试资格核验";
  }

  if (providerIntent.value) {
    return BOUNTY_INTENT_STATUS_LABELS[providerIntent.value.status];
  }

  if (!providerEligible.value) {
    return qualificationWorkflowEnabled ? "补充服务者资格" : "暂无接单资格";
  }

  return "立即报名";
}

function applyButtonDisabled(): boolean {
  const providerContextBlocksAction =
    Boolean(session.user) &&
    (providerStatus.value === "loading" ||
      (providerStatus.value === "ready" &&
        (Boolean(providerIntent.value) ||
          (!providerEligible.value && !qualificationWorkflowEnabled))));

  return (
    applying.value ||
    !bounty.value ||
    bounty.value.status !== BOUNTY_STATUS.OPEN ||
    providerContextBlocksAction
  );
}

onLoad((query = {}) => {
  bountyId.value = typeof query.bountyId === "string" ? query.bountyId : "";
});

onShow(() => void load());

watch(
  () => session.bootstrapped,
  (bootstrapped) => {
    if (bootstrapped && status.value === "ready") {
      void loadProviderContext();
    }
  },
);
</script>

<template>
  <SubPageLayout title="悬赏详情">
    <view class="bounty-detail">
      <PcStatePanel
        v-if="status === 'unavailable'"
        status="unavailable"
        title="悬赏服务未开放"
        description="当前环境暂未开放悬赏服务。"
      />
      <PcStatePanel v-else-if="status === 'loading'" status="loading" title="悬赏详情加载中…" />
      <PcStatePanel
        v-else-if="status === 'error'"
        status="error"
        title="悬赏详情暂不可用"
        :description="actionMessage || '请从悬赏大厅重新打开，或稍后重试。'"
        primary-label="重新加载"
        @primary="load"
      />

      <template v-else-if="bounty">
        <view class="bounty-detail__hero">
          <image
            class="bounty-detail__image"
            :src="bounty.pet.coverImage || '/static/main/petcare-placeholder-light.svg'"
            mode="aspectFill"
            :aria-label="`${bounty.pet.name}的照片`"
          />
          <view class="bounty-detail__image-caption">
            {{ bounty.pet.name
            }}<template v-if="bounty.pet.breed"> · {{ bounty.pet.breed }}</template>
          </view>
        </view>

        <view class="bounty-detail__summary">
          <text class="bounty-detail__title">
            {{ BOUNTY_SERVICE_TYPE_LABELS[bounty.serviceType] }}
          </text>
          <text class="meta-text">{{ serviceTime }} · {{ bounty.owner.nickname }} 发布</text>
          <view class="bounty-detail__price-row">
            <view>
              <text class="quiet-text">悬赏金额</text>
              <text class="bounty-detail__price">{{ formatBountyAmount(bounty.amountCents) }}</text>
            </view>
            <text class="bounty-detail__status">{{ BOUNTY_STATUS_LABELS[bounty.status] }}</text>
          </view>
        </view>

        <view class="bounty-detail__section">
          <text class="card-heading">服务说明</text>
          <view class="bounty-detail__info main-card">
            <view class="bounty-detail__info-row">
              <text class="quiet-text">服务时间</text>
              <text class="bounty-detail__info-value">{{ serviceTime }}</text>
            </view>
            <view class="bounty-detail__info-row">
              <text class="quiet-text">服务内容</text>
              <text class="bounty-detail__info-value">{{
                BOUNTY_SERVICE_TYPE_LABELS[bounty.serviceType]
              }}</text>
            </view>
            <view class="bounty-detail__info-row">
              <text class="quiet-text">服务地址</text>
              <text class="bounty-detail__info-value">主人确认服务者后向其开放</text>
            </view>
            <view class="bounty-detail__info-row">
              <text class="quiet-text">宠物</text>
              <text class="bounty-detail__info-value"
                >{{ bounty.pet.name
                }}<template v-if="bounty.pet.breed"> · {{ bounty.pet.breed }}</template></text
              >
            </view>
          </view>
        </view>

        <view class="bounty-detail__notice" role="status">
          公开详情不包含服务地址和主人备注。位置、距离及报名人数暂未提供。
        </view>

        <view
          v-if="actionMessage"
          class="bounty-detail__message"
          :class="actionFailed ? 'is-error' : ''"
          :role="actionFailed ? 'alert' : 'status'"
          aria-live="polite"
        >
          {{ actionMessage }}
        </view>
      </template>
    </view>

    <template v-if="status === 'ready' && bounty" #actions>
      <view class="bounty-detail__actions">
        <PcButton variant="secondary" disabled aria-label="站内消息功能暂未开放">发消息</PcButton>
        <PcButton
          class="flex-1"
          block
          size="action"
          :disabled="applyButtonDisabled()"
          :loading="applying"
          @click="apply"
        >
          {{ applyButtonLabel() }}
        </PcButton>
      </view>
    </template>
  </SubPageLayout>
</template>

<style scoped lang="scss">
.bounty-detail {
  display: flex;
  flex-direction: column;
  gap: 18px;
  padding: 0 16px 24px;

  &__hero {
    position: relative;
    overflow: hidden;
    height: 232px;
    border-radius: 16px;
    background: #eef2f6;
  }

  &__image {
    width: 100%;
    height: 100%;
  }

  &__image-caption {
    position: absolute;
    right: 0;
    bottom: 0;
    left: 0;
    padding: 36px 16px 14px;
    background: linear-gradient(transparent, rgba(17, 24, 39, 0.72));
    color: #fff;
    font-size: 14px;
    line-height: 20px;
    overflow-wrap: anywhere;
  }

  &__summary,
  &__section {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  &__title {
    color: #1f2937;
    font-size: 22px;
    font-weight: 600;
    line-height: 30px;
  }

  &__price-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-top: 4px;
    padding: 12px 16px;
    border-radius: 14px;
    background: #fff5df;
  }

  &__price-row > view {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  &__price {
    color: #b54708;
    font-size: 22px;
    font-weight: 600;
    line-height: 30px;
  }

  &__status {
    padding: 5px 10px;
    border-radius: 999px;
    background: #eef2ff;
    color: #4a6cf7;
    font-size: 12px;
  }

  &__info {
    display: flex;
    flex-direction: column;
    gap: 16px;
    padding: 16px;
  }

  &__info-row {
    display: flex;
    justify-content: space-between;
    gap: 12px;
    color: #1f2937;
    font-size: 14px;
    line-height: 22px;
  }

  &__info-value {
    max-width: 70%;
    text-align: right;
    overflow-wrap: anywhere;
  }

  &__notice {
    padding: 12px;
    border-radius: 12px;
    background: #eef2ff;
    color: #53638a;
    font-size: 12px;
    line-height: 18px;
  }

  &__message {
    padding: 12px;
    border: 1px solid #d5dcfa;
    border-radius: 12px;
    background: #eef2ff;
    color: #344054;
    font-size: 13px;
    line-height: 20px;

    &.is-error {
      border-color: #fecdca;
      background: #fef3f2;
      color: #b42318;
    }
  }

  &__actions {
    display: flex;
    gap: 12px;
  }
}
</style>
