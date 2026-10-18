<script setup lang="ts">
import { onLoad, onShow } from "@dcloudio/uni-app";
import { BOUNTY_ERROR_CODE, BOUNTY_LIMITS } from "@petcare/shared-types";
import type { MyPetListItem } from "@petcare/shared-types";
import { computed, reactive, ref, watch } from "vue";
import { createBounty, getPublicBounties } from "@/api/bounties";
import { getMyPets } from "@/api/pets";
import { getSafeRequestErrorMessage, MiniappApiError } from "@/api/request";
import PcButton from "@/components/PcButton.vue";
import PcStatePanel from "@/components/PcStatePanel.vue";
import SubPageLayout from "@/components/SubPageLayout.vue";
import { commercialServicesEnabled } from "@/config/features";
import {
  BOUNTY_SERVICE_OPTIONS,
  createEmptyBountyForm,
  formatBountyAmount,
  validateBountyForm,
} from "@/domain/bounty-form";
import type { BountyFormField } from "@/domain/bounty-form";
import { captureSessionUserRevision, isSessionUserRevisionCurrent, session } from "@/state/session";

interface PickerChangeEvent {
  detail?: { value?: string | number };
}

type FormStatus = "loading" | "ready" | "error" | "unavailable" | "unauthenticated";

const form = reactive(createEmptyBountyForm());
const step = ref(1);
const pets = ref<MyPetListItem[]>([]);
const status = ref<FormStatus>(commercialServicesEnabled ? "loading" : "unavailable");
const busy = ref<"load" | "save" | null>(null);
const loadError = ref("");
const saveError = ref("");
const createdBountyId = ref<string | null>(null);
const featureUnavailable = ref(!commercialServicesEnabled);
const validationField = ref<BountyFormField | null>(null);
const validationMessage = ref("");
const today = new Date();
const minimumDate = [
  today.getFullYear().toString().padStart(4, "0"),
  (today.getMonth() + 1).toString().padStart(2, "0"),
  today.getDate().toString().padStart(2, "0"),
].join("-");
const controlsDisabled = computed(
  () => busy.value !== null || status.value !== "ready" || createdBountyId.value !== null,
);
const selectedPetLabel = computed(
  () => pets.value.find((pet) => pet.id === form.petId)?.name ?? "请选择宠物",
);
const selectedServiceLabel = computed(
  () =>
    BOUNTY_SERVICE_OPTIONS.find((option) => option.value === form.serviceType)?.label ??
    "请选择服务类型",
);

function clearValidation(field?: BountyFormField): void {
  if (!field || validationField.value === field) {
    validationField.value = null;
    validationMessage.value = "";
  }
}

function goNextStep(): void {
  clearValidation();

  if (step.value === 1 && !form.serviceType) {
    validationField.value = "serviceType";
    validationMessage.value = "请选择服务类型";

    return;
  }

  if (step.value === 2) {
    const validation = validateBountyForm(form);

    if (!validation.ok) {
      validationField.value = validation.field;
      validationMessage.value = validation.message;

      return;
    }
  }

  step.value = Math.min(step.value + 1, 3);
}

function goPreviousStep(): void {
  clearValidation();
  step.value = Math.max(step.value - 1, 1);
}

function openLogin(): void {
  uni.navigateTo({ url: "/pages/auth/index" });
}

function openProfile(): void {
  uni.navigateTo({
    url: `/pages-account/profile/edit?returnUrl=${encodeURIComponent("/pages-bounty/form")}`,
  });
}

function addPet(): void {
  uni.navigateTo({ url: "/pages-account/pets/form" });
}

function returnToBounties(): void {
  uni.redirectTo({ url: "/pages-bounty/index?tab=mine" });
}

async function openCreatedBounty(): Promise<void> {
  if (!createdBountyId.value) {
    return;
  }

  await uni.redirectTo({
    url: `/pages-bounty/success?bountyId=${encodeURIComponent(createdBountyId.value)}`,
  });
}

function handlePetChange(event: PickerChangeEvent): void {
  const pet = pets.value[Number(event.detail?.value)];

  if (pet) {
    form.petId = pet.id;
    clearValidation("petId");
  }
}

function handleDateChange(event: PickerChangeEvent): void {
  if (typeof event.detail?.value === "string") {
    form.serviceDate = event.detail.value;
    clearValidation("serviceDate");
  }
}

function handleTimeChange(event: PickerChangeEvent): void {
  if (typeof event.detail?.value === "string") {
    form.serviceClock = event.detail.value;
    clearValidation("serviceDate");
  }
}

function formatAmountForReview(): string {
  const validation = validateBountyForm(form);

  return validation.ok ? formatBountyAmount(validation.request.amountCents) : "金额待完善";
}

async function loadPets(): Promise<void> {
  if (!commercialServicesEnabled) {
    status.value = "unavailable";

    return;
  }

  if (!session.user) {
    status.value = session.bootstrapped ? "unauthenticated" : "loading";

    return;
  }

  if (!session.user.profileComplete) {
    status.value = "unavailable";

    return;
  }

  if (busy.value !== null) {
    return;
  }

  busy.value = "load";
  status.value = "loading";
  loadError.value = "";
  const startedAt = captureSessionUserRevision();

  try {
    const [response] = await Promise.all([
      getMyPets(),
      getPublicBounties({ page: 1, pageSize: 1 }),
    ]);

    if (!isSessionUserRevisionCurrent(startedAt)) {
      pets.value = [];
      status.value = "unauthenticated";

      return;
    }

    pets.value = response;

    if (form.petId && !response.some((pet) => pet.id === form.petId)) {
      form.petId = "";
    }

    status.value = "ready";
  } catch (error) {
    pets.value = [];

    if (
      !isSessionUserRevisionCurrent(startedAt) ||
      (error instanceof MiniappApiError && error.statusCode === 401)
    ) {
      status.value = "unauthenticated";
    } else if (error instanceof MiniappApiError && [403, 404].includes(error.statusCode)) {
      featureUnavailable.value = error.code === BOUNTY_ERROR_CODE.FEATURE_DISABLED;
      status.value = "unavailable";
    } else {
      loadError.value = getSafeRequestErrorMessage(error, "宠物档案加载失败，请稍后重试");
      status.value = "error";
    }
  } finally {
    busy.value = null;
  }
}

async function save(): Promise<void> {
  if (controlsDisabled.value || pets.value.length === 0 || step.value !== 3) {
    return;
  }

  const validation = validateBountyForm(form);

  if (!validation.ok) {
    validationField.value = validation.field;
    validationMessage.value = validation.message;

    return;
  }

  clearValidation();
  busy.value = "save";
  saveError.value = "";
  const startedAt = captureSessionUserRevision();
  let completed = false;

  try {
    const created = await createBounty(validation.request);

    if (!isSessionUserRevisionCurrent(startedAt)) {
      status.value = "unavailable";

      return;
    }

    createdBountyId.value = created.id;
    completed = true;
  } catch (error) {
    if (isSessionUserRevisionCurrent(startedAt)) {
      if (error instanceof MiniappApiError && error.code === BOUNTY_ERROR_CODE.FEATURE_DISABLED) {
        featureUnavailable.value = true;
        status.value = "unavailable";
      } else if (error instanceof MiniappApiError && error.statusCode === 401) {
        status.value = "unauthenticated";
      } else if (error instanceof MiniappApiError && error.statusCode === 403) {
        status.value = "unavailable";
      } else {
        saveError.value = getSafeRequestErrorMessage(error, "悬赏发布失败，当前输入仍已保留");
      }
    } else {
      status.value = "unavailable";
    }
  } finally {
    busy.value = null;
  }

  if (!completed) {
    return;
  }

  await uni.showToast({ title: "悬赏已发布", icon: "success" }).catch(() => undefined);

  try {
    await openCreatedBounty();
  } catch {
    saveError.value = "悬赏已发布，请在我的悬赏中查看";
  }
}

onLoad((query = {}) => {
  form.petId = typeof query.petId === "string" ? query.petId : "";
});

onShow(() => void loadPets());

watch(
  () => session.bootstrapped,
  (bootstrapped) => {
    if (bootstrapped && status.value !== "ready") {
      void loadPets();
    }
  },
);
</script>

<template>
  <SubPageLayout title="发布悬赏">
    <view class="flex flex-col gap-card px-action py-card">
      <PcStatePanel
        v-if="!commercialServicesEnabled"
        status="unavailable"
        title="悬赏服务未开放"
        description="当前构建未启用悬赏入口。"
      />

      <PcStatePanel v-else-if="status === 'loading'" status="loading" title="发布信息加载中…" />

      <PcStatePanel
        v-else-if="status === 'unauthenticated'"
        status="unauthenticated"
        title="登录后发布悬赏"
        description="登录并完善手机号后，才能为自己的宠物发布悬赏。"
        primary-label="微信登录"
        @primary="openLogin"
      />

      <PcStatePanel
        v-else-if="status === 'unavailable'"
        status="unavailable"
        :title="featureUnavailable ? '悬赏服务未开放' : '当前无法发布悬赏'"
        :description="featureUnavailable ? 'Server 当前未启用悬赏能力。' : '请先完成手机号资料。'"
        :primary-label="featureUnavailable ? undefined : '完善个人资料'"
        secondary-label="返回悬赏"
        @primary="openProfile"
        @secondary="returnToBounties"
      />

      <PcStatePanel
        v-else-if="status === 'error'"
        status="error"
        title="发布信息加载失败"
        :description="loadError || '请检查网络后重试。'"
        primary-label="重新加载"
        :primary-disabled="busy === 'load'"
        @primary="loadPets"
      />

      <template v-else-if="pets.length === 0">
        <PcStatePanel
          status="empty"
          title="请先创建宠物档案"
          description="悬赏只能关联当前账号拥有的宠物。"
          primary-label="添加宠物"
          secondary-label="返回悬赏"
          @primary="addPet"
          @secondary="returnToBounties"
        />
      </template>

      <template v-else>
        <view class="publish-stepper" aria-label="发布流程">
          <view
            v-for="number in 3"
            :key="number"
            class="publish-stepper__item"
            :class="step === number ? 'is-current' : step > number ? 'is-done' : ''"
          >
            <view class="publish-stepper__number">{{ step > number ? "✓" : `0${number}` }}</view>
            <text>{{ ["服务类型", "服务详情", "确认发布"][number - 1] }}</text>
            <view v-if="number < 3" class="publish-stepper__line" />
          </view>
        </view>

        <view
          v-if="saveError"
          class="rounded-control bg-danger-soft px-action py-copy text-body text-danger leading-body"
          role="alert"
        >
          {{ saveError }}
        </view>

        <view v-if="step === 1" class="publish-section main-card">
          <text class="publish-section__title">需要什么服务？</text>
          <text class="meta-text">选择适合你和宠物的服务类型</text>
          <view class="publish-service-grid">
            <button
              v-for="option in BOUNTY_SERVICE_OPTIONS"
              :key="option.value"
              class="publish-service-option"
              :class="form.serviceType === option.value ? 'is-selected' : ''"
              :disabled="controlsDisabled"
              :aria-pressed="form.serviceType === option.value"
              @click="
                form.serviceType = option.value;
                clearValidation('serviceType');
              "
            >
              <image
                :src="
                  option.value === 'feeding'
                    ? '/static/main/heart.svg'
                    : '/static/main/profile-location.svg'
                "
                mode="aspectFit"
                aria-hidden="true"
              />
              <text>{{ option.label }}</text>
            </button>
          </view>
          <text
            v-if="validationField === 'serviceType'"
            class="text-caption text-danger"
            role="alert"
          >
            {{ validationMessage }}
          </text>
          <view class="publish-note" role="status">
            当前仅支持上门喂养、遛狗和陪玩。紧急程度设置暂未开放。
          </view>
        </view>

        <view v-else-if="step === 2" class="publish-section main-card">
          <text class="publish-section__title">填写服务详情</text>
          <text class="meta-text">补充必要信息，让照护者更了解你的需求</text>

          <view class="publish-field">
            <text class="text-body text-ink font-medium leading-label">照护宠物（必填）</text>
            <picker
              :range="pets"
              range-key="name"
              :disabled="controlsDisabled"
              aria-label="选择照护宠物"
              @change="handlePetChange"
            >
              <view class="publish-picker" :class="controlsDisabled ? 'opacity-50' : ''">
                <text :class="form.petId ? 'text-ink' : 'text-subtle'">{{ selectedPetLabel }}</text>
                <image src="/static/main/chevron.svg" mode="aspectFit" aria-hidden="true" />
              </view>
            </picker>
            <text v-if="validationField === 'petId'" class="text-caption text-danger" role="alert">
              {{ validationMessage }}
            </text>
          </view>

          <view class="publish-field">
            <text class="text-body text-ink font-medium leading-label">服务时间（必填）</text>
            <view class="grid grid-cols-2 gap-sm">
              <picker
                mode="date"
                :start="minimumDate"
                :value="form.serviceDate"
                :disabled="controlsDisabled"
                aria-label="选择服务日期"
                @change="handleDateChange"
              >
                <view class="publish-picker" :class="controlsDisabled ? 'opacity-50' : ''">
                  {{ form.serviceDate || "选择日期" }}
                </view>
              </picker>
              <picker
                mode="time"
                :value="form.serviceClock"
                :disabled="controlsDisabled"
                aria-label="选择服务时间"
                @change="handleTimeChange"
              >
                <view class="publish-picker" :class="controlsDisabled ? 'opacity-50' : ''">
                  {{ form.serviceClock || "选择时间" }}
                </view>
              </picker>
            </view>
            <text
              v-if="validationField === 'serviceDate'"
              class="text-caption text-danger"
              role="alert"
            >
              {{ validationMessage }}
            </text>
          </view>

          <view class="publish-field">
            <text class="text-body text-ink font-medium leading-label">悬赏金额（元，必填）</text>
            <input
              v-model="form.amountYuan"
              class="publish-input"
              type="digit"
              :disabled="controlsDisabled"
              :maxlength="8"
              placeholder="1–1000，最多两位小数"
              aria-label="悬赏金额"
              @input="clearValidation('amountYuan')"
            />
            <text class="quiet-text">填写本次服务的固定金额，发布后不会发起扣款。</text>
            <text
              v-if="validationField === 'amountYuan'"
              class="text-caption text-danger"
              role="alert"
            >
              {{ validationMessage }}
            </text>
          </view>

          <view class="publish-field">
            <text class="text-body text-ink font-medium leading-label">服务地址（必填）</text>
            <textarea
              v-model="form.address"
              class="publish-textarea"
              :disabled="controlsDisabled"
              :maxlength="BOUNTY_LIMITS.ADDRESS_MAX_LENGTH"
              placeholder="仅对订单主人和确认后的服务者开放"
              aria-label="服务地址"
              @input="clearValidation('address')"
            />
            <text
              v-if="validationField === 'address'"
              class="text-caption text-danger"
              role="alert"
            >
              {{ validationMessage }}
            </text>
          </view>

          <view class="publish-field">
            <text class="text-body text-ink font-medium leading-label">备注（选填）</text>
            <textarea
              v-model="form.remark"
              class="publish-textarea"
              :disabled="controlsDisabled"
              :maxlength="BOUNTY_LIMITS.REMARK_MAX_LENGTH"
              placeholder="填写照护要求；不会公开展示"
              aria-label="悬赏备注"
              @input="clearValidation('remark')"
            />
            <text v-if="validationField === 'remark'" class="text-caption text-danger" role="alert">
              {{ validationMessage }}
            </text>
          </view>
        </view>

        <view v-else class="publish-section main-card">
          <text class="publish-section__title">确认发布信息</text>
          <text class="meta-text">确认无误后即可发布悬赏</text>
          <view class="publish-summary">
            <view class="publish-summary__row">
              <text class="quiet-text">宠物</text>
              <text class="text-body text-ink">{{ selectedPetLabel }}</text>
            </view>
            <view class="publish-summary__row">
              <text class="quiet-text">服务类型</text>
              <text class="text-body text-ink">{{ selectedServiceLabel }}</text>
            </view>
            <view class="publish-summary__row">
              <text class="quiet-text">服务时间</text>
              <text class="text-body text-ink">{{ form.serviceDate }} {{ form.serviceClock }}</text>
            </view>
            <view class="publish-summary__row">
              <text class="quiet-text">服务地址</text>
              <text class="text-body text-ink">{{ form.address }}</text>
            </view>
            <view v-if="form.remark" class="publish-summary__row">
              <text class="quiet-text">照护备注</text>
              <text class="text-body text-ink">{{ form.remark }}</text>
            </view>
            <view class="publish-summary__amount">
              <text class="quiet-text">悬赏金额</text>
              <text>{{ formatAmountForReview() }}</text>
            </view>
          </view>
          <view class="publish-note" role="status">
            当前仅支持固定金额发布；保险、议价和实时定位选项暂未开放。本步骤只创建悬赏，不会触发收款。
          </view>
        </view>
      </template>
    </view>

    <template v-if="status === 'ready' && pets.length > 0" #actions>
      <view class="publish-actions">
        <PcButton
          v-if="createdBountyId"
          class="flex-1"
          block
          size="action"
          @click="openCreatedBounty"
        >
          查看发布结果
        </PcButton>
        <template v-else>
          <PcButton v-if="step > 1" variant="secondary" @click="goPreviousStep">上一步</PcButton>
          <PcButton
            v-if="step < 3"
            class="flex-1"
            block
            size="action"
            :disabled="controlsDisabled"
            @click="goNextStep"
          >
            下一步
          </PcButton>
          <PcButton
            v-else
            class="flex-1"
            block
            size="action"
            :disabled="controlsDisabled"
            :loading="busy === 'save'"
            @click="save"
          >
            {{ busy === "save" ? "发布中…" : "确认发布" }}
          </PcButton>
        </template>
      </view>
    </template>
  </SubPageLayout>
</template>

<style scoped lang="scss">
.publish-stepper {
  display: flex;
  align-items: flex-start;
  margin: 0 4px 16px;

  &__item {
    position: relative;
    display: flex;
    width: 33.333%;
    flex-direction: column;
    align-items: center;
    gap: 6px;
    color: #667085;
    font-size: 12px;
    line-height: 18px;

    &.is-current,
    &.is-done {
      color: #4a6cf7;
    }
  }

  &__number {
    display: flex;
    width: 28px;
    height: 28px;
    align-items: center;
    justify-content: center;
    border-radius: 50%;
    background: #f2f4f7;
    color: #667085;
    font-size: 12px;
  }

  .is-current &__number,
  .is-done &__number {
    background: #4a6cf7;
    color: #fff;
  }

  &__line {
    position: absolute;
    top: 13px;
    left: calc(50% + 22px);
    width: calc(100% - 44px);
    height: 2px;
    background: #e7ebf3;
  }

  .is-done &__line {
    background: #4a6cf7;
  }
}

.publish-section {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 18px 16px;
}

.publish-section__title {
  color: #1f2937;
  font-size: 20px;
  font-weight: 600;
  line-height: 28px;
}

.publish-service-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.publish-service-option {
  display: flex;
  min-height: 92px;
  flex-direction: column;
  align-items: flex-start;
  justify-content: center;
  gap: 8px;
  padding: 14px;
  border: 1px solid #e3e8f2;
  border-radius: 16px;
  background: #fff;
  color: #1f2937;
  font-size: 14px;
  text-align: left;

  image {
    width: 24px;
    height: 24px;
  }

  &.is-selected {
    border-color: #4a6cf7;
    background: #eef2ff;
  }
}

.publish-note {
  padding: 12px;
  border-radius: 12px;
  background: #eef2ff;
  color: #53638a;
  font-size: 12px;
  line-height: 18px;
}

.publish-field {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.publish-picker,
.publish-input {
  box-sizing: border-box;
  display: flex;
  width: 100%;
  min-height: 48px;
  align-items: center;
  justify-content: space-between;
  padding: 0 12px;
  border: 1px solid #e3e8f2;
  border-radius: 12px;
  background: #fff;
  color: #1f2937;
  font-size: 14px;

  image {
    width: 16px;
    height: 16px;
  }
}

.publish-textarea {
  box-sizing: border-box;
  width: 100%;
  min-height: 88px;
  padding: 12px;
  border: 1px solid #e3e8f2;
  border-radius: 12px;
  background: #fff;
  color: #1f2937;
  font-size: 14px;
  line-height: 22px;
}

.publish-summary {
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 16px;
  border: 1px solid #eaecf0;
  border-radius: 16px;
  background: #fff;

  &__row,
  &__amount {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 16px;
  }

  &__row > .text-body {
    max-width: 72%;
    text-align: right;
    overflow-wrap: anywhere;
  }

  &__row > .quiet-text {
    flex-shrink: 0;
  }

  &__amount {
    padding-top: 12px;
    border-top: 1px solid #f2f4f7;
    color: #b54708;
    font-size: 20px;
    font-weight: 600;
  }
}

.publish-actions {
  display: flex;
  align-items: center;
  gap: 12px;
}
</style>
