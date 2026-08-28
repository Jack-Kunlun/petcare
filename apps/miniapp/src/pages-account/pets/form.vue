<script setup lang="ts">
import { onLoad } from "@dcloudio/uni-app";
import { PET_PROFILE_LIMITS, PET_SPECIES } from "@petcare/shared-types";
import type { MyPetDetail, PetPhotoAsset } from "@petcare/shared-types";
import { computed, reactive, ref, watch } from "vue";
import { getPetFormMode } from "./pet-form-mode";
import {
  createEmptyPetForm,
  createPetForm,
  PET_GENDER_OPTIONS,
  PET_SPECIES_OPTIONS,
  serializePetForm,
  validatePetForm,
} from "./pet-profile";
import type { PetProfileField } from "./pet-profile";
import { createPet, deletePetPhoto, getMyPet, updatePet, uploadPetPhoto } from "@/api/pets";
import { getSafeRequestErrorMessage, MiniappApiError } from "@/api/request";
import PcButton from "@/components/PcButton.vue";
import PcStatePanel from "@/components/PcStatePanel.vue";
import SubPageLayout from "@/components/SubPageLayout.vue";
import { miniappDesignTokens } from "@/config/design-tokens";
import { petCoverImage } from "@/domain/pet-display";
import type { SessionUserRevision } from "@/state/session";
import { captureSessionUserRevision, isSessionUserRevisionCurrent, session } from "@/state/session";

interface PickerChangeEvent {
  detail?: { value?: string | number };
}

interface SwitchChangeEvent {
  detail?: { value?: boolean };
}

interface DraftPhoto {
  key: string;
  filePath: string;
  progress: number;
  status: "waiting" | "uploading" | "error";
  error: string;
}

let photoSequence = 0;
const careFields = [
  { key: "habits", label: "生活习惯" },
  { key: "allergies", label: "过敏信息" },
  { key: "tabooFoods", label: "忌口信息" },
] as const;
const formMode = ref<"add" | "edit">("add");
const petId = ref("");
const pet = ref<MyPetDetail | null>(null);
const form = reactive(createEmptyPetForm());
const persistedSnapshot = ref("");
const status = ref<"loading" | "ready" | "error" | "unavailable" | "unauthenticated">("ready");
const busy = ref<"load" | "choose" | "save" | null>(null);
const deletingAssetId = ref("");
const draftPhotos = ref<DraftPhoto[]>([]);
const loadError = ref("");
const saveError = ref("");
const photoError = ref("");
const validationField = ref<PetProfileField | null>(null);
const validationMessage = ref("");
const title = computed(() => (formMode.value === "edit" ? "编辑宠物" : "添加宠物"));
const today = new Date();
const maximumDate = [
  today.getFullYear().toString().padStart(4, "0"),
  (today.getMonth() + 1).toString().padStart(2, "0"),
  today.getDate().toString().padStart(2, "0"),
].join("-");
const controlsDisabled = computed(() => busy.value !== null || Boolean(deletingAssetId.value));
const photoCount = computed(() => (pet.value?.photoUrls.length ?? 0) + draftPhotos.value.length);
const canChoosePhotos = computed(
  () =>
    status.value === "ready" &&
    !controlsDisabled.value &&
    photoCount.value < PET_PROFILE_LIMITS.MAX_PHOTOS_PER_PET,
);
const hasChanges = computed(
  () =>
    formMode.value === "add" ||
    serializePetForm(form) !== persistedSnapshot.value ||
    draftPhotos.value.length > 0,
);
const saveDisabled = computed(
  () => status.value !== "ready" || controlsDisabled.value || !hasChanges.value,
);
const speciesLabel = computed(
  () => PET_SPECIES_OPTIONS.find((option) => option.value === form.species)?.label ?? "请选择",
);
const genderLabel = computed(
  () => PET_GENDER_OPTIONS.find((option) => option.value === form.gender)?.label ?? "请选择",
);
const coverImage = computed(() => {
  const draft = draftPhotos.value[0];

  if (draft) {
    return draft.filePath;
  }

  return petCoverImage({
    coverImage: pet.value?.coverImage ?? null,
    species: form.species || PET_SPECIES.OTHER,
  });
});
const existingPhotos = computed(() =>
  (pet.value?.photoUrls ?? []).map((url) => ({
    url,
    asset: pet.value?.photoAssets.find((candidate) => candidate.url === url) ?? null,
  })),
);

function errorMessage(error: unknown, fallback: string): string {
  return getSafeRequestErrorMessage(error, fallback);
}

function openLogin(): void {
  uni.navigateTo({ url: "/pages/auth/index" });
}

function returnToPets(): void {
  uni.redirectTo({ url: "/pages-account/pets/index" });
}

function clearValidation(field?: PetProfileField): void {
  if (!field || validationField.value === field) {
    validationField.value = null;
    validationMessage.value = "";
  }
}

function applyDetail(detail: MyPetDetail): void {
  pet.value = detail;
  petId.value = detail.id;
  Object.assign(form, createPetForm(detail));
  persistedSnapshot.value = serializePetForm(form);
}

async function loadPet(): Promise<void> {
  if (!petId.value || busy.value !== null) {
    return;
  }

  busy.value = "load";
  status.value = "loading";
  loadError.value = "";
  const startedAt = captureSessionUserRevision();

  try {
    const detail = await getMyPet(petId.value);

    if (!isSessionUserRevisionCurrent(startedAt)) {
      pet.value = null;
      status.value = "unavailable";

      return;
    }

    applyDetail(detail);
    status.value = "ready";
  } catch (error) {
    if (isSessionUserRevisionCurrent(startedAt)) {
      loadError.value = errorMessage(error, "宠物档案加载失败，请稍后重试");
    }

    if (
      !isSessionUserRevisionCurrent(startedAt) ||
      (error instanceof MiniappApiError && error.statusCode === 401)
    ) {
      status.value = "unauthenticated";
    } else if (error instanceof MiniappApiError && [403, 404].includes(error.statusCode)) {
      status.value = "unavailable";
    } else {
      status.value = "error";
    }
  } finally {
    busy.value = null;
  }
}

function handleSpeciesChange(event: PickerChangeEvent): void {
  const index = Number(event.detail?.value);
  const option = PET_SPECIES_OPTIONS[index];

  if (option) {
    form.species = option.value;
  }
}

function handleGenderChange(event: PickerChangeEvent): void {
  const index = Number(event.detail?.value);
  const option = PET_GENDER_OPTIONS[index];

  if (option) {
    form.gender = option.value;
  }
}

function handleBirthDateChange(event: PickerChangeEvent): void {
  if (typeof event.detail?.value === "string") {
    form.birthDate = event.detail.value;
  }
}

function handleSterilizedChange(event: SwitchChangeEvent): void {
  if (typeof event.detail?.value === "boolean") {
    form.sterilized = event.detail.value;
  }
}

function clearBirthDate(): void {
  if (!controlsDisabled.value) {
    form.birthDate = "";
  }
}

function choosePhotos(): void {
  if (!canChoosePhotos.value) {
    return;
  }

  busy.value = "choose";
  photoError.value = "";
  const remaining = PET_PROFILE_LIMITS.MAX_PHOTOS_PER_PET - photoCount.value;

  uni.chooseImage({
    count: remaining,
    sizeType: ["compressed"],
    success(result) {
      const paths = Array.isArray(result.tempFilePaths)
        ? result.tempFilePaths
        : [result.tempFilePaths];

      draftPhotos.value.push(
        ...paths.slice(0, remaining).map((filePath) => ({
          key: `pet-photo-${(photoSequence += 1)}`,
          filePath,
          progress: 0,
          status: "waiting" as const,
          error: "",
        })),
      );
    },
    fail(error) {
      if (!error.errMsg.includes("cancel")) {
        photoError.value = "图片选择失败，请重试";
      }
    },
    complete() {
      busy.value = null;
    },
  });
}

function removeDraftPhoto(item: DraftPhoto): void {
  if (!controlsDisabled.value) {
    draftPhotos.value = draftPhotos.value.filter((candidate) => candidate.key !== item.key);
  }
}

function appendUploadedPhoto(asset: PetPhotoAsset): void {
  const detail = pet.value;

  if (!detail) {
    return;
  }

  pet.value = {
    ...detail,
    coverImage: detail.coverImage ?? asset.url,
    photoUrls: [...detail.photoUrls, asset.url],
    photoAssets: [...detail.photoAssets, asset],
  };
}

async function uploadDraftPhotos(
  targetPetId: string,
  startedAt: SessionUserRevision,
): Promise<number | null> {
  let failed = 0;

  for (const item of [...draftPhotos.value]) {
    if (!isSessionUserRevisionCurrent(startedAt)) {
      return null;
    }

    item.status = "uploading";
    item.progress = 0;
    item.error = "";

    try {
      // eslint-disable-next-line no-await-in-loop -- each upload owns visible progress and retry state.
      const asset = await uploadPetPhoto(targetPetId, item.filePath, (progress) => {
        item.progress = progress;
      });

      if (!isSessionUserRevisionCurrent(startedAt)) {
        return null;
      }

      appendUploadedPhoto(asset);
      draftPhotos.value = draftPhotos.value.filter((candidate) => candidate.key !== item.key);
    } catch (error) {
      if (!isSessionUserRevisionCurrent(startedAt)) {
        return null;
      }

      failed += 1;
      item.status = "error";
      item.error = errorMessage(error, "图片上传失败，请重试");
    }
  }

  return failed;
}

async function removeExistingPhoto(asset: PetPhotoAsset): Promise<void> {
  const detail = pet.value;

  if (!detail || controlsDisabled.value) {
    return;
  }

  const confirmation = await uni
    .showModal({
      title: "删除宠物图片",
      content: "删除后该图片将不再显示，确定继续吗？",
      confirmText: "删除",
      confirmColor: miniappDesignTokens.colors.danger,
    })
    .catch(() => null);

  if (!confirmation?.confirm) {
    return;
  }

  deletingAssetId.value = asset.id;
  photoError.value = "";
  const startedAt = captureSessionUserRevision();

  try {
    await deletePetPhoto(detail.id, asset.id);

    if (!isSessionUserRevisionCurrent(startedAt)) {
      pet.value = null;
      status.value = "unavailable";

      return;
    }

    const photoUrls = detail.photoUrls.filter((url) => url !== asset.url);

    pet.value = {
      ...detail,
      coverImage: photoUrls[0] ?? null,
      photoUrls,
      photoAssets: detail.photoAssets.filter((candidate) => candidate.id !== asset.id),
    };
  } catch (error) {
    if (isSessionUserRevisionCurrent(startedAt)) {
      photoError.value = errorMessage(error, "图片删除失败，原图片仍保留，请重试");
    }
  } finally {
    deletingAssetId.value = "";
  }
}

async function save(): Promise<void> {
  if (saveDisabled.value) {
    return;
  }

  const validation = validatePetForm(form);

  if (!validation.ok) {
    validationField.value = validation.field;
    validationMessage.value = validation.message;

    return;
  }

  clearValidation();

  busy.value = "save";
  saveError.value = "";
  photoError.value = "";
  let completed = false;
  const startedAt = captureSessionUserRevision();

  try {
    const detail = petId.value
      ? await updatePet(petId.value, validation.request)
      : await createPet(validation.request);

    if (!isSessionUserRevisionCurrent(startedAt)) {
      pet.value = null;
      status.value = "unavailable";

      return;
    }

    formMode.value = "edit";
    applyDetail(detail);
    const failedUploads = await uploadDraftPhotos(detail.id, startedAt);

    if (failedUploads === null || !isSessionUserRevisionCurrent(startedAt)) {
      pet.value = null;
      status.value = "unavailable";

      return;
    }

    if (failedUploads > 0) {
      saveError.value = `档案已保存，${failedUploads} 张图片上传失败；请保留本页并重试保存。`;
    } else {
      completed = true;
    }
  } catch (error) {
    if (isSessionUserRevisionCurrent(startedAt)) {
      saveError.value = errorMessage(error, "保存失败，当前输入仍已保留，请重试");
    } else {
      pet.value = null;
      status.value = "unavailable";
    }
  } finally {
    busy.value = null;
  }

  if (!completed) {
    return;
  }

  await uni.showToast({ title: "宠物档案已保存", icon: "success" }).catch(() => undefined);

  try {
    await uni.navigateBack();
  } catch {
    saveError.value = "档案已保存，请手动返回";
  }
}

function initializeForm(): void {
  if (!session.user) {
    status.value = session.bootstrapped ? "unauthenticated" : "loading";

    return;
  }

  if (formMode.value === "add") {
    persistedSnapshot.value = serializePetForm(form);
    status.value = "ready";

    return;
  }

  if (!petId.value) {
    status.value = "unavailable";

    return;
  }

  void loadPet();
}

onLoad((query = {}) => {
  formMode.value = getPetFormMode(query);
  petId.value = typeof query.id === "string" ? query.id : "";
  initializeForm();
});

watch(
  () => session.bootstrapped,
  (bootstrapped) => {
    if (bootstrapped && status.value !== "ready") {
      initializeForm();
    }
  },
);
</script>

<template>
  <SubPageLayout :title="title">
    <view class="flex flex-col gap-card px-action py-card">
      <PcStatePanel v-if="status === 'loading'" status="loading" title="宠物档案加载中…" />

      <PcStatePanel
        v-else-if="status === 'unauthenticated'"
        status="unauthenticated"
        title="登录后管理宠物档案"
        description="登录后可添加或编辑自己的宠物资料。"
        primary-label="微信登录"
        @primary="openLogin"
      />

      <PcStatePanel
        v-else-if="status === 'unavailable'"
        status="unavailable"
        title="宠物档案不存在或当前不可编辑"
        description="请返回我的宠物后重新选择一个档案。"
        primary-label="返回我的宠物"
        @primary="returnToPets"
      />

      <PcStatePanel
        v-else-if="status === 'error'"
        status="error"
        title="宠物档案加载失败"
        :description="loadError || '请检查网络后重试。'"
        primary-label="重新加载"
        :primary-disabled="busy === 'load'"
        @primary="loadPet"
      />

      <template v-else>
        <view class="flex flex-col items-center gap-sm main-card p-action">
          <image
            class="h-avatar-xl w-avatar-xl rounded-full bg-divider"
            :src="coverImage"
            mode="aspectFill"
          />
          <PcButton
            variant="secondary"
            :disabled="!canChoosePhotos"
            :loading="busy === 'choose'"
            @click="choosePhotos"
          >
            {{ busy === "choose" ? "选择中…" : "选择宠物图片" }}
          </PcButton>
          <text class="text-center quiet-text">
            {{ photoCount }}/{{ PET_PROFILE_LIMITS.MAX_PHOTOS_PER_PET }} 张；支持
            JPEG、PNG、WebP，单张不超过 10 MiB
          </text>
        </view>

        <view
          v-if="existingPhotos.length > 0 || draftPhotos.length > 0 || photoError"
          class="main-card p-action"
        >
          <text class="card-heading">宠物照片</text>
          <view class="grid grid-cols-3 mt-copy gap-copy">
            <view
              v-for="(photo, index) in existingPhotos"
              :key="`${photo.url}-${index}`"
              class="min-w-0"
            >
              <image
                class="h-pet w-full rounded-control bg-divider"
                :src="photo.url"
                mode="aspectFill"
              />
              <PcButton
                v-if="photo.asset"
                class="mt-sm"
                block
                variant="danger"
                :disabled="controlsDisabled"
                :loading="deletingAssetId === photo.asset.id"
                :aria-label="`删除第 ${index + 1} 张宠物图片`"
                @click="removeExistingPhoto(photo.asset)"
              >
                {{ deletingAssetId === photo.asset.id ? "删除中…" : "删除" }}
              </PcButton>
              <text v-else class="mt-sm block text-center quiet-text">历史图片</text>
            </view>

            <view v-for="(photo, index) in draftPhotos" :key="photo.key" class="min-w-0">
              <view class="relative h-pet overflow-hidden rounded-control bg-divider">
                <image class="h-full w-full" :src="photo.filePath" mode="aspectFill" />
                <view
                  v-if="photo.status === 'uploading'"
                  class="absolute inset-0 flex items-center justify-center bg-ink opacity-80"
                  aria-live="polite"
                >
                  <text class="text-caption text-surface">{{ photo.progress }}%</text>
                </view>
                <view
                  v-else-if="photo.status === 'error'"
                  class="absolute inset-0 flex items-center justify-center bg-danger-soft p-sm"
                  role="alert"
                >
                  <text class="text-center text-micro text-danger leading-micro">
                    {{ photo.error }}
                  </text>
                </view>
              </view>
              <PcButton
                class="mt-sm"
                block
                variant="secondary"
                :disabled="controlsDisabled"
                :aria-label="`移除待上传的第 ${index + 1} 张图片`"
                @click="removeDraftPhoto(photo)"
              >
                移除
              </PcButton>
            </view>
          </view>
          <text v-if="photoError" class="mt-copy block text-caption text-danger" role="alert">
            {{ photoError }}
          </text>
        </view>

        <view class="main-card p-action">
          <text class="card-heading">基础资料</text>
          <view class="mt-copy flex flex-col gap-action">
            <label>
              <text class="mb-sm block text-body text-ink font-medium">宠物名字 *</text>
              <input
                v-model="form.name"
                class="box-border h-control w-full border border-divider rounded-control px-copy text-body text-ink"
                type="text"
                :maxlength="PET_PROFILE_LIMITS.NAME_MAX_LENGTH"
                :disabled="controlsDisabled"
                aria-label="宠物名字"
                placeholder="请输入宠物名字"
                @input="clearValidation('name')"
              />
              <text
                v-if="validationField === 'name'"
                class="mt-caption block text-caption text-danger leading-caption"
                role="alert"
              >
                {{ validationMessage }}
              </text>
            </label>

            <view>
              <text class="mb-sm block text-body text-ink font-medium">宠物种类 *</text>
              <picker
                :range="PET_SPECIES_OPTIONS"
                range-key="label"
                :disabled="controlsDisabled"
                aria-label="宠物种类"
                @change="handleSpeciesChange"
              >
                <view
                  class="h-control flex items-center justify-between border border-divider rounded-control px-copy"
                >
                  <text :class="form.species ? 'text-ink' : 'text-subtle'">{{ speciesLabel }}</text>
                  <image
                    class="h-icon-xs w-icon-xs"
                    src="/static/main/chevron.svg"
                    mode="aspectFit"
                  />
                </view>
              </picker>
              <text
                v-if="validationField === 'species'"
                class="mt-caption block text-caption text-danger leading-caption"
                role="alert"
              >
                {{ validationMessage }}
              </text>
            </view>

            <label>
              <text class="mb-sm block text-body text-ink font-medium">品种 *</text>
              <input
                v-model="form.breed"
                class="box-border h-control w-full border border-divider rounded-control px-copy text-body text-ink"
                type="text"
                :maxlength="PET_PROFILE_LIMITS.BREED_MAX_LENGTH"
                :disabled="controlsDisabled"
                aria-label="宠物品种"
                placeholder="例如：英国短毛猫"
                @input="clearValidation('breed')"
              />
              <text
                v-if="validationField === 'breed'"
                class="mt-caption block text-caption text-danger leading-caption"
                role="alert"
              >
                {{ validationMessage }}
              </text>
            </label>

            <view>
              <text class="mb-sm block text-body text-ink font-medium">性别 *</text>
              <picker
                :range="PET_GENDER_OPTIONS"
                range-key="label"
                :disabled="controlsDisabled"
                aria-label="宠物性别"
                @change="handleGenderChange"
              >
                <view
                  class="h-control flex items-center justify-between border border-divider rounded-control px-copy"
                >
                  <text :class="form.gender ? 'text-ink' : 'text-subtle'">{{ genderLabel }}</text>
                  <image
                    class="h-icon-xs w-icon-xs"
                    src="/static/main/chevron.svg"
                    mode="aspectFit"
                  />
                </view>
              </picker>
              <text
                v-if="validationField === 'gender'"
                class="mt-caption block text-caption text-danger leading-caption"
                role="alert"
              >
                {{ validationMessage }}
              </text>
            </view>

            <view>
              <text class="mb-sm block text-body text-ink font-medium">生日</text>
              <view class="flex gap-sm">
                <picker
                  class="min-w-0 flex-1"
                  mode="date"
                  :value="form.birthDate"
                  :end="maximumDate"
                  :disabled="controlsDisabled"
                  aria-label="宠物生日"
                  @change="handleBirthDateChange"
                >
                  <view
                    class="h-control flex items-center justify-between border border-divider rounded-control px-copy"
                  >
                    <text :class="form.birthDate ? 'text-ink' : 'text-subtle'">
                      {{ form.birthDate || "请选择" }}
                    </text>
                    <image
                      class="h-icon-xs w-icon-xs"
                      src="/static/main/chevron.svg"
                      mode="aspectFit"
                    />
                  </view>
                </picker>
                <PcButton
                  variant="ghost"
                  :disabled="!form.birthDate || controlsDisabled"
                  @click="clearBirthDate"
                >
                  清除
                </PcButton>
              </view>
              <text
                v-if="validationField === 'birthDate'"
                class="mt-caption block text-caption text-danger leading-caption"
                role="alert"
              >
                {{ validationMessage }}
              </text>
            </view>

            <label>
              <text class="mb-sm block text-body text-ink font-medium">体重（kg）</text>
              <input
                v-model="form.weightKg"
                class="box-border h-control w-full border border-divider rounded-control px-copy text-body text-ink"
                type="digit"
                :disabled="controlsDisabled"
                aria-label="宠物体重"
                placeholder="0.1 至 200，最多两位小数"
                @input="clearValidation('weightKg')"
              />
              <text
                v-if="validationField === 'weightKg'"
                class="mt-caption block text-caption text-danger leading-caption"
                role="alert"
              >
                {{ validationMessage }}
              </text>
            </label>

            <view class="h-control flex items-center justify-between">
              <view class="flex flex-col">
                <text class="text-body text-ink font-medium">绝育状态</text>
                <text class="quiet-text">{{ form.sterilized ? "已绝育" : "未绝育" }}</text>
              </view>
              <switch
                :color="miniappDesignTokens.colors.brand"
                :checked="form.sterilized"
                :disabled="controlsDisabled"
                aria-label="绝育状态"
                @change="handleSterilizedChange"
              />
            </view>
          </view>
        </view>

        <view class="main-card p-action">
          <text class="card-heading">照护信息</text>
          <view class="mt-copy flex flex-col gap-action">
            <label v-for="field in careFields" :key="field.key">
              <text class="mb-sm block text-body text-ink font-medium">{{ field.label }}</text>
              <textarea
                v-model="form[field.key]"
                class="min-h-control box-border w-full border border-divider rounded-control px-copy py-copy text-body text-ink leading-body"
                auto-height
                :maxlength="PET_PROFILE_LIMITS.CARE_TEXT_MAX_LENGTH"
                :disabled="controlsDisabled"
                :aria-label="field.label"
                placeholder="选填，最多 200 字"
                @input="clearValidation(field.key)"
              />
              <text
                v-if="validationField === field.key"
                class="mt-caption block text-caption text-danger leading-caption"
                role="alert"
              >
                {{ validationMessage }}
              </text>
            </label>
          </view>
        </view>

        <text v-if="saveError" class="text-caption text-danger leading-caption" role="alert">
          {{ saveError }}
        </text>
      </template>
    </view>

    <template v-if="status === 'ready'" #actions>
      <PcButton
        block
        size="action"
        :disabled="saveDisabled"
        :loading="busy === 'save'"
        @click="save"
      >
        {{ busy === "save" ? "保存中…" : formMode === "edit" ? "保存修改" : "完成添加" }}
      </PcButton>
    </template>
  </SubPageLayout>
</template>
