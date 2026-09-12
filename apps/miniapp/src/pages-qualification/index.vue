<script setup lang="ts">
import { onShow } from "@dcloudio/uni-app";
import {
  PROVIDER_QUALIFICATION_MATERIAL_KIND,
  PROVIDER_QUALIFICATION_STATUS,
} from "@petcare/shared-types";
import type {
  ProviderQualificationMaterialKind,
  ProviderQualificationSummary,
} from "@petcare/shared-types";
import { computed, ref } from "vue";
import {
  createQualificationDraft,
  getMyQualifications,
  submitQualification,
  uploadQualificationMaterial,
} from "@/api/provider-qualifications";
import { getSafeRequestErrorMessage } from "@/api/request";
import PcButton from "@/components/PcButton.vue";
import PcStatePanel from "@/components/PcStatePanel.vue";
import SubPageLayout from "@/components/SubPageLayout.vue";
import { qualificationWorkflowEnabled } from "@/config/features";
import {
  captureSessionUserRevision,
  isSessionUserRevisionCurrent,
  requireProfile,
  session,
} from "@/state/session";

const route = "/pages-qualification/index";
const kinds = [
  { kind: PROVIDER_QUALIFICATION_MATERIAL_KIND.ID_FRONT, label: "身份证人像面" },
  { kind: PROVIDER_QUALIFICATION_MATERIAL_KIND.ID_BACK, label: "身份证国徽面" },
  { kind: PROVIDER_QUALIFICATION_MATERIAL_KIND.TRAINING, label: "培训证明" },
] as const;
const applications = ref<ProviderQualificationSummary[]>([]);
const state = ref<"loading" | "ready" | "error" | "unauthenticated" | "closed">("loading");
const busy = ref(false);
const busyKind = ref<ProviderQualificationMaterialKind | null>(null);
const error = ref("");
const consent = ref(false);
const draftRequestKey = ref<string | null>(null);
const draft = computed(() =>
  applications.value.find((item) => item.status === PROVIDER_QUALIFICATION_STATUS.DRAFT),
);
const current = computed(
  () =>
    applications.value.find(
      (item) =>
        item.status === PROVIDER_QUALIFICATION_STATUS.PENDING ||
        item.status === PROVIDER_QUALIFICATION_STATUS.APPROVED,
    ) ?? draft.value,
);
const allMaterials = computed(
  () => draft.value && kinds.every(({ kind }) => draft.value?.materialKinds.includes(kind)),
);
const canSubmit = computed(() => Boolean(allMaterials.value && consent.value && !busy.value));

function updateApplication(application: ProviderQualificationSummary) {
  applications.value = [
    application,
    ...applications.value.filter((item) => item.id !== application.id),
  ];
}

async function load(): Promise<void> {
  if (!qualificationWorkflowEnabled) {
    state.value = "closed";

    return;
  }

  if (!session.user) {
    applications.value = [];
    draftRequestKey.value = null;
    state.value = "unauthenticated";

    return;
  }

  state.value = "loading";
  error.value = "";
  const startedAt = captureSessionUserRevision();

  try {
    const result = await getMyQualifications();

    if (!isSessionUserRevisionCurrent(startedAt)) {
      applications.value = [];
      state.value = "unauthenticated";

      return;
    }

    applications.value = result;
    state.value = "ready";
  } catch (cause) {
    if (!isSessionUserRevisionCurrent(startedAt)) {
      applications.value = [];
      state.value = "unauthenticated";

      return;
    }

    error.value = getSafeRequestErrorMessage(cause, "资格申请加载失败，请稍后重试");
    state.value = "error";
  }
}

function newIdempotencyKey(): string {
  if (globalThis.crypto?.randomUUID) {
    return globalThis.crypto.randomUUID();
  }

  // This is a retry key, not a credential; the server still authorizes every operation.
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (part) => {
    const value = Math.floor(Math.random() * 16);

    return (part === "x" ? value : (value & 3) | 8).toString(16);
  });
}

async function upload(kind: ProviderQualificationMaterialKind, filePath: string): Promise<void> {
  if (busy.value) {
    return;
  }

  busy.value = true;
  busyKind.value = kind;
  error.value = "";
  const startedAt = captureSessionUserRevision();

  try {
    if (!(await requireProfile(route)) || !isSessionUserRevisionCurrent(startedAt)) {
      return;
    }

    draftRequestKey.value ??= newIdempotencyKey();
    const application = draft.value ?? (await createQualificationDraft(draftRequestKey.value));

    if (!isSessionUserRevisionCurrent(startedAt)) {
      return;
    }

    updateApplication(application);
    draftRequestKey.value = null;
    const updated = await uploadQualificationMaterial(application.id, kind, filePath);

    if (isSessionUserRevisionCurrent(startedAt)) {
      updateApplication(updated);
    }
  } catch (cause) {
    if (isSessionUserRevisionCurrent(startedAt)) {
      error.value = getSafeRequestErrorMessage(cause, "材料上传失败，请重试");
    }
  } finally {
    busy.value = false;
    busyKind.value = null;
  }
}

function chooseMaterial(kind: ProviderQualificationMaterialKind): void {
  if (
    busy.value ||
    current.value?.status === PROVIDER_QUALIFICATION_STATUS.PENDING ||
    current.value?.status === PROVIDER_QUALIFICATION_STATUS.APPROVED
  ) {
    return;
  }

  const startedAt = captureSessionUserRevision();

  uni.chooseImage({
    count: 1,
    sizeType: ["original"],
    success(result) {
      const filePath = result.tempFilePaths[0];

      if (filePath && isSessionUserRevisionCurrent(startedAt)) {
        void upload(kind, filePath);
      }
    },
    fail(result) {
      if (isSessionUserRevisionCurrent(startedAt) && !result.errMsg.includes("cancel")) {
        error.value = "图片选择失败，请重试";
      }
    },
  });
}

function onConsentChange(event: { detail: { value: string[] } }): void {
  consent.value = event.detail.value.includes("accepted");
}

async function submit(): Promise<void> {
  if (!canSubmit.value || !draft.value) {
    return;
  }

  busy.value = true;
  error.value = "";
  const startedAt = captureSessionUserRevision();

  try {
    const result = await submitQualification(draft.value.id);

    if (!isSessionUserRevisionCurrent(startedAt)) {
      return;
    }

    updateApplication(result);
    consent.value = false;
  } catch (cause) {
    if (isSessionUserRevisionCurrent(startedAt)) {
      error.value = getSafeRequestErrorMessage(cause, "提交失败，请重试");
    }
  } finally {
    busy.value = false;
  }
}

onShow(() => {
  void load();
});
</script>

<template>
  <SubPageLayout title="服务者资格申请">
    <view class="flex flex-col gap-card px-action py-card">
      <PcStatePanel v-if="state === 'loading'" status="loading" title="正在加载资格状态…" />
      <PcStatePanel
        v-else-if="state === 'closed'"
        status="empty"
        title="资格申请暂未开放"
        description="请等待服务者资格审核能力完成验收。"
      />
      <PcStatePanel
        v-else-if="state === 'unauthenticated'"
        status="unauthenticated"
        title="请先登录"
        primary-label="前往登录"
        @primary="requireProfile(route)"
      />
      <PcStatePanel
        v-else-if="state === 'error'"
        status="error"
        title="资格状态加载失败"
        :description="error"
        primary-label="重新加载"
        @primary="load"
      />
      <template v-else>
        <view
          v-if="current && current.status !== 'draft'"
          class="main-card p-action"
          aria-live="polite"
        >
          <text class="section-heading"
            >当前申请：{{ current.status === "pending" ? "审核中" : "已通过" }}</text
          >
          <text class="mt-copy block text-body text-muted leading-body"
            >审核结果由管理员核验写入；通过后仍须等待服务入口开放。</text
          >
        </view>
        <view v-else class="main-card p-action">
          <text class="section-heading">上传资格材料</text>
          <text class="mt-copy block text-body text-muted leading-body"
            >请上传清晰的身份证正反面与培训证明。每张 JPEG、PNG 或 WebP 图片不超过 10
            MiB；材料仅在私有存储中供授权审核人员读取。</text
          >
          <view
            v-for="item in kinds"
            :key="item.kind"
            class="mt-action flex items-center justify-between gap-copy border-b border-divider pb-copy"
          >
            <view class="min-w-0 flex-1">
              <text class="block text-body text-ink font-medium leading-body">{{
                item.label
              }}</text>
              <text class="block meta-text">{{
                draft?.materialKinds.includes(item.kind) ? "已安全上传" : "待上传"
              }}</text>
            </view>
            <PcButton
              variant="secondary"
              :disabled="busy || draft?.materialKinds.includes(item.kind)"
              :loading="busyKind === item.kind"
              :aria-label="`上传${item.label}`"
              @click="chooseMaterial(item.kind)"
            >
              {{ draft?.materialKinds.includes(item.kind) ? "已上传" : "选择图片" }}
            </PcButton>
          </view>
        </view>
        <view v-if="!current || current.status === 'draft'" class="main-card p-action">
          <text class="section-heading">资格材料处理说明</text>
          <text class="mt-copy block text-body text-muted leading-body"
            >材料仅用于服务者身份及培训资格审核，只有获授独立权限的审核人员可以读取；上传草稿 7
            天未提交会清理，未通过或资格撤销后保留 30
            天供申诉后清理，通过后保留至资格撤销。如需撤回或了解材料处理，请联系客服。</text
          >
          <checkbox-group class="mt-action" @change="onConsentChange">
            <label class="min-h-control flex items-center gap-copy text-body text-ink leading-body">
              <checkbox value="accepted" :checked="consent" :disabled="busy" />
              <text>我已阅读并同意上述材料处理说明</text>
            </label>
          </checkbox-group>
          <PcButton
            class="mt-action"
            block
            :loading="busy && !busyKind"
            :disabled="!canSubmit"
            @click="submit"
            >提交审核</PcButton
          >
        </view>
        <text v-if="error" class="text-body text-danger leading-body" role="alert">{{
          error
        }}</text>
        <view
          v-if="
            applications.some((item) => item.status === 'rejected' || item.status === 'revoked')
          "
          class="main-card p-action"
        >
          <text class="section-heading">历史审核结果</text>
          <view
            v-for="item in applications.filter(
              (entry) => entry.status === 'rejected' || entry.status === 'revoked',
            )"
            :key="item.id"
            class="mt-copy"
          >
            <text class="block text-body text-ink">{{
              item.status === "rejected" ? "未通过" : "资格已撤销"
            }}</text>
            <text class="block meta-text">{{
              item.decisionReason || "请联系审核人员了解详情"
            }}</text>
          </view>
        </view>
      </template>
    </view>
  </SubPageLayout>
</template>
