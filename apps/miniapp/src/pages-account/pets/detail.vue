<script setup lang="ts">
import { onLoad, onShow } from "@dcloudio/uni-app";
import { PET_GENDER_LABELS, PET_SPECIES_LABELS } from "@petcare/shared-types";
import type { MyPetDetail } from "@petcare/shared-types";
import { computed, ref } from "vue";
import { formatPetAge, formatPetBirthDate, petCoverImage } from "./pet-profile";
import { deletePet, getMyPet } from "@/api/pets";
import { MiniappApiError } from "@/api/request";
import SubPageLayout from "@/components/SubPageLayout.vue";
import { captureSessionUserRevision, isSessionUserRevisionCurrent } from "@/state/session";

const petId = ref("");
const pet = ref<MyPetDetail | null>(null);
const status = ref<"loading" | "ready" | "error" | "unavailable">("loading");
const loading = ref(false);
const deleting = ref(false);
const deleteError = ref("");
let skipInitialShow = true;

const facts = computed(() => {
  const value = pet.value;

  return value
    ? [
        { label: "种类", value: PET_SPECIES_LABELS[value.species] },
        { label: "性别", value: PET_GENDER_LABELS[value.gender] },
        { label: "生日", value: formatPetBirthDate(value.birthDate) },
        { label: "年龄", value: formatPetAge(value.birthDate) },
        { label: "体重", value: value.weightKg === null ? "未填写" : `${value.weightKg} kg` },
        { label: "绝育", value: value.sterilized ? "已绝育" : "未绝育" },
      ]
    : [];
});

const careNotes = computed(() => {
  const value = pet.value;

  return value
    ? [
        { label: "生活习惯", value: value.habits },
        { label: "过敏信息", value: value.allergies },
        { label: "忌口信息", value: value.tabooFoods },
      ]
    : [];
});

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof MiniappApiError ? error.message : fallback;
}

async function loadPet(): Promise<void> {
  if (!petId.value || loading.value || deleting.value) {
    return;
  }

  loading.value = true;
  status.value = "loading";
  deleteError.value = "";
  const startedAt = captureSessionUserRevision();

  try {
    const response = await getMyPet(petId.value);

    if (!isSessionUserRevisionCurrent(startedAt)) {
      pet.value = null;
      status.value = "unavailable";

      return;
    }

    pet.value = response;
    status.value = "ready";
  } catch (error) {
    pet.value = null;
    status.value =
      !isSessionUserRevisionCurrent(startedAt) ||
      (error instanceof MiniappApiError && [401, 403, 404].includes(error.statusCode))
        ? "unavailable"
        : "error";
  } finally {
    loading.value = false;
  }
}

function editPet(): void {
  if (pet.value && !deleting.value) {
    uni.navigateTo({
      url: `/pages-account/pets/form?mode=edit&id=${encodeURIComponent(pet.value.id)}`,
    });
  }
}

async function removePet(): Promise<void> {
  const value = pet.value;

  if (!value || deleting.value) {
    return;
  }

  const confirmation = await uni
    .showModal({
      title: `删除${value.name}`,
      content: "删除后宠物档案和受管理图片将不再显示；被订单引用时系统会拒绝删除。",
      confirmText: "删除",
      confirmColor: "#f04438",
    })
    .catch(() => null);

  if (!confirmation?.confirm) {
    return;
  }

  deleting.value = true;
  deleteError.value = "";
  const startedAt = captureSessionUserRevision();

  try {
    await deletePet(value.id);

    if (!isSessionUserRevisionCurrent(startedAt)) {
      pet.value = null;
      status.value = "unavailable";

      return;
    }

    await uni.showToast({ title: "宠物档案已删除", icon: "success" }).catch(() => undefined);

    try {
      await uni.navigateBack();
    } catch {
      deleteError.value = "档案已删除，请手动返回";
    }
  } catch (error) {
    if (isSessionUserRevisionCurrent(startedAt)) {
      deleteError.value = errorMessage(error, "删除失败，宠物档案仍保留，请重试");
    }
  } finally {
    deleting.value = false;
  }
}

onLoad((query = {}) => {
  if (typeof query.id !== "string" || !query.id) {
    status.value = "unavailable";

    return;
  }

  petId.value = query.id;
  void loadPet();
});

onShow(() => {
  if (skipInitialShow) {
    skipInitialShow = false;

    return;
  }

  void loadPet();
});
</script>

<template>
  <SubPageLayout title="宠物档案">
    <view class="flex flex-col gap-card px-action py-card">
      <view v-if="status === 'loading'" class="main-card p-action" aria-live="polite">
        <text class="text-body text-muted leading-body">宠物档案加载中…</text>
      </view>

      <view
        v-else-if="status === 'unavailable'"
        class="flex flex-col items-center gap-copy rounded-card bg-warning-soft p-card"
        role="alert"
      >
        <text class="text-body text-ink leading-body">宠物档案不存在或当前不可用</text>
      </view>

      <view
        v-else-if="status === 'error'"
        class="flex flex-col items-center gap-copy rounded-card bg-danger-soft p-card"
        role="alert"
      >
        <text class="text-body text-ink leading-body">宠物档案加载失败，请稍后重试</text>
        <button
          class="h-control rounded-control bg-brand px-action text-body text-surface"
          :class="loading ? 'opacity-50' : ''"
          :disabled="loading"
          :aria-disabled="loading"
          :loading="loading"
          @click="loadPet"
        >
          重新加载
        </button>
      </view>

      <template v-else-if="pet">
        <view class="flex flex-col items-center main-card p-card">
          <image
            class="h-card-cover w-card-cover rounded-full bg-divider"
            :src="petCoverImage(pet)"
            mode="aspectFill"
          />
          <text class="mt-copy page-heading">{{ pet.name }}</text>
          <text class="mt-caption meta-text">{{ pet.breed }}</text>
        </view>

        <view class="main-card p-action">
          <text class="card-heading">基本信息</text>
          <view class="grid grid-cols-2 mt-copy gap-copy">
            <view v-for="fact in facts" :key="fact.label" class="rounded-control bg-divider p-copy">
              <text class="quiet-text">{{ fact.label }}</text>
              <text class="mt-caption block text-body text-ink font-medium leading-label">
                {{ fact.value }}
              </text>
            </view>
          </view>
        </view>

        <view class="main-card p-action">
          <text class="card-heading">照护信息</text>
          <view class="mt-copy flex flex-col gap-copy">
            <view
              v-for="note in careNotes"
              :key="note.label"
              class="rounded-control bg-divider p-copy"
            >
              <text class="quiet-text">{{ note.label }}</text>
              <text class="mt-caption block text-body text-ink leading-body">
                {{ note.value || "未填写" }}
              </text>
            </view>
          </view>
        </view>

        <view class="main-card p-action">
          <view class="flex items-center justify-between">
            <text class="card-heading">宠物照片</text>
            <text class="quiet-text">{{ pet.photoUrls.length }} 张</text>
          </view>
          <scroll-view
            v-if="pet.photoUrls.length > 0"
            class="mt-copy w-full whitespace-nowrap"
            scroll-x
            :show-scrollbar="false"
          >
            <image
              v-for="url in pet.photoUrls"
              :key="url"
              class="mr-copy h-card-cover w-card-cover rounded-control bg-divider"
              :src="url"
              mode="aspectFill"
            />
          </scroll-view>
          <text v-else class="mt-copy block meta-text">暂未上传宠物照片</text>
        </view>

        <text v-if="deleteError" class="text-caption text-danger leading-caption" role="alert">
          {{ deleteError }}
        </text>
      </template>
    </view>

    <template v-if="status === 'ready' && pet" #actions>
      <view class="flex gap-copy">
        <button
          class="h-button flex flex-1 items-center justify-center rounded-control bg-danger-soft text-button text-danger font-semibold"
          :class="deleting ? 'opacity-50' : ''"
          :disabled="deleting"
          :aria-disabled="deleting"
          :loading="deleting"
          @click="removePet"
        >
          {{ deleting ? "删除中…" : "删除档案" }}
        </button>
        <button
          class="h-button flex flex-1 items-center justify-center rounded-control bg-brand text-button text-surface font-semibold"
          :class="deleting ? 'opacity-50' : ''"
          :disabled="deleting"
          :aria-disabled="deleting"
          @click="editPet"
        >
          编辑档案
        </button>
      </view>
    </template>
  </SubPageLayout>
</template>
