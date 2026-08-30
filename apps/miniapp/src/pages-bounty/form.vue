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
  validateBountyForm,
} from "@/domain/bounty-form";
import type { BountyFormField } from "@/domain/bounty-form";
import { captureSessionUserRevision, isSessionUserRevisionCurrent, session } from "@/state/session";

interface PickerChangeEvent {
  detail?: { value?: string | number };
}

type FormStatus = "loading" | "ready" | "error" | "unavailable" | "unauthenticated";

const form = reactive(createEmptyBountyForm());
const pets = ref<MyPetListItem[]>([]);
const status = ref<FormStatus>(commercialServicesEnabled ? "loading" : "unavailable");
const busy = ref<"load" | "save" | null>(null);
const loadError = ref("");
const saveError = ref("");
const featureUnavailable = ref(!commercialServicesEnabled);
const validationField = ref<BountyFormField | null>(null);
const validationMessage = ref("");
const today = new Date();
const minimumDate = [
  today.getFullYear().toString().padStart(4, "0"),
  (today.getMonth() + 1).toString().padStart(2, "0"),
  today.getDate().toString().padStart(2, "0"),
].join("-");
const controlsDisabled = computed(() => busy.value !== null || status.value !== "ready");
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

function handlePetChange(event: PickerChangeEvent): void {
  const pet = pets.value[Number(event.detail?.value)];

  if (pet) {
    form.petId = pet.id;
    clearValidation("petId");
  }
}

function handleServiceChange(event: PickerChangeEvent): void {
  const option = BOUNTY_SERVICE_OPTIONS[Number(event.detail?.value)];

  if (option) {
    form.serviceType = option.value;
    clearValidation("serviceType");
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
  if (controlsDisabled.value || pets.value.length === 0) {
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
    await createBounty(validation.request);

    if (!isSessionUserRevisionCurrent(startedAt)) {
      status.value = "unavailable";

      return;
    }

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
    await uni.redirectTo({ url: "/pages-bounty/index?tab=mine" });
  } catch {
    saveError.value = "悬赏已发布，请手动返回我的悬赏";
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
        <view
          v-if="saveError"
          class="rounded-control bg-danger-soft px-action py-copy text-body text-danger leading-body"
          role="alert"
        >
          {{ saveError }}
        </view>

        <view class="flex flex-col gap-card main-card p-card-padding">
          <view class="flex flex-col gap-sm">
            <text class="text-body text-ink font-medium leading-label">照护宠物（必填）</text>
            <picker
              :range="pets"
              range-key="name"
              :disabled="controlsDisabled"
              aria-label="选择照护宠物"
              @change="handlePetChange"
            >
              <view
                class="h-control flex items-center justify-between border border-border rounded-control px-action"
                :class="controlsDisabled ? 'opacity-50' : ''"
              >
                <text :class="form.petId ? 'text-ink' : 'text-subtle'">
                  {{ selectedPetLabel }}
                </text>
                <image
                  class="h-icon-xs w-icon-xs"
                  src="/static/main/chevron.svg"
                  mode="aspectFit"
                  aria-hidden="true"
                />
              </view>
            </picker>
            <text v-if="validationField === 'petId'" class="text-caption text-danger" role="alert">
              {{ validationMessage }}
            </text>
          </view>

          <view class="flex flex-col gap-sm">
            <text class="text-body text-ink font-medium leading-label">服务类型（必填）</text>
            <picker
              :range="BOUNTY_SERVICE_OPTIONS"
              range-key="label"
              :disabled="controlsDisabled"
              aria-label="选择服务类型"
              @change="handleServiceChange"
            >
              <view
                class="h-control flex items-center justify-between border border-border rounded-control px-action"
                :class="controlsDisabled ? 'opacity-50' : ''"
              >
                <text :class="form.serviceType ? 'text-ink' : 'text-subtle'">
                  {{ selectedServiceLabel }}
                </text>
                <image
                  class="h-icon-xs w-icon-xs"
                  src="/static/main/chevron.svg"
                  mode="aspectFit"
                  aria-hidden="true"
                />
              </view>
            </picker>
            <text
              v-if="validationField === 'serviceType'"
              class="text-caption text-danger"
              role="alert"
            >
              {{ validationMessage }}
            </text>
          </view>

          <view class="flex flex-col gap-sm">
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
                <view
                  class="h-control flex items-center border border-border rounded-control px-action"
                  :class="controlsDisabled ? 'opacity-50' : ''"
                >
                  <text :class="form.serviceDate ? 'text-ink' : 'text-subtle'">
                    {{ form.serviceDate || "选择日期" }}
                  </text>
                </view>
              </picker>
              <picker
                mode="time"
                :value="form.serviceClock"
                :disabled="controlsDisabled"
                aria-label="选择服务时间"
                @change="handleTimeChange"
              >
                <view
                  class="h-control flex items-center border border-border rounded-control px-action"
                  :class="controlsDisabled ? 'opacity-50' : ''"
                >
                  <text :class="form.serviceClock ? 'text-ink' : 'text-subtle'">
                    {{ form.serviceClock || "选择时间" }}
                  </text>
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

          <view class="flex flex-col gap-sm">
            <text class="text-body text-ink font-medium leading-label">悬赏金额（元，必填）</text>
            <input
              v-model="form.amountYuan"
              class="box-border h-control border border-border rounded-control px-action text-body text-ink"
              type="digit"
              :disabled="controlsDisabled"
              :maxlength="8"
              placeholder="1–1000，最多两位小数"
              aria-label="悬赏金额"
              @input="clearValidation('amountYuan')"
            />
            <text class="quiet-text">金额按整数分保存，本阶段不发起真实支付。</text>
            <text
              v-if="validationField === 'amountYuan'"
              class="text-caption text-danger"
              role="alert"
            >
              {{ validationMessage }}
            </text>
          </view>

          <view class="flex flex-col gap-sm">
            <text class="text-body text-ink font-medium leading-label">服务地址（必填）</text>
            <textarea
              v-model="form.address"
              class="min-h-actions box-border w-full border border-border rounded-control px-action py-copy text-body text-ink leading-body"
              :disabled="controlsDisabled"
              :maxlength="BOUNTY_LIMITS.ADDRESS_MAX_LENGTH"
              placeholder="仅在我的悬赏中显示，不进入公开列表"
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

          <view class="flex flex-col gap-sm">
            <text class="text-body text-ink font-medium leading-label">备注（选填）</text>
            <textarea
              v-model="form.remark"
              class="min-h-actions box-border w-full border border-border rounded-control px-action py-copy text-body text-ink leading-body"
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
      </template>
    </view>

    <template v-if="status === 'ready' && pets.length > 0" #actions>
      <PcButton
        block
        size="action"
        :disabled="controlsDisabled"
        :loading="busy === 'save'"
        @click="save"
      >
        {{ busy === "save" ? "发布中…" : "确认发布" }}
      </PcButton>
    </template>
  </SubPageLayout>
</template>
