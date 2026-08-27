<script setup lang="ts">
import { onShow } from "@dcloudio/uni-app";
import { PET_PROFILE_LIMITS } from "@petcare/shared-types";
import type { MyPetListItem } from "@petcare/shared-types";
import { computed, ref } from "vue";
import { formatPetSummary, petCoverImage } from "./pet-profile";
import { deletePet, getMyPets } from "@/api/pets";
import { MiniappApiError } from "@/api/request";
import SubPageLayout from "@/components/SubPageLayout.vue";
import { captureSessionUserRevision, isSessionUserRevisionCurrent } from "@/state/session";

const pets = ref<MyPetListItem[]>([]);
const status = ref<"loading" | "ready" | "error" | "unavailable">("loading");
const loading = ref(false);
const deletingId = ref("");
const deleteError = ref("");
const canAdd = computed(
  () => status.value === "ready" && pets.value.length < PET_PROFILE_LIMITS.MAX_PETS_PER_OWNER,
);

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof MiniappApiError ? error.message : fallback;
}

function isAccountUnavailable(error: unknown): boolean {
  return error instanceof MiniappApiError && [401, 403].includes(error.statusCode);
}

async function loadPets(): Promise<void> {
  if (loading.value || deletingId.value) {
    return;
  }

  loading.value = true;
  status.value = "loading";
  deleteError.value = "";
  const startedAt = captureSessionUserRevision();

  try {
    const response = await getMyPets();

    if (!isSessionUserRevisionCurrent(startedAt)) {
      pets.value = [];
      status.value = "unavailable";

      return;
    }

    pets.value = response;
    status.value = "ready";
  } catch (error) {
    pets.value = [];
    status.value =
      !isSessionUserRevisionCurrent(startedAt) || isAccountUnavailable(error)
        ? "unavailable"
        : "error";
  } finally {
    loading.value = false;
  }
}

function openPet(id: string): void {
  if (!deletingId.value) {
    uni.navigateTo({ url: `/pages-account/pets/detail?id=${encodeURIComponent(id)}` });
  }
}

function addPet(): void {
  if (canAdd.value) {
    uni.navigateTo({ url: "/pages-account/pets/form" });
  }
}

function returnToProfile(): void {
  uni.navigateBack();
}

async function removePet(pet: MyPetListItem): Promise<void> {
  if (deletingId.value) {
    return;
  }

  const confirmation = await uni
    .showModal({
      title: `删除${pet.name}`,
      content: "删除后宠物档案和受管理图片将不再显示；被订单引用时系统会拒绝删除。",
      confirmText: "删除",
      confirmColor: "#f04438",
    })
    .catch(() => null);

  if (!confirmation?.confirm) {
    return;
  }

  deletingId.value = pet.id;
  deleteError.value = "";
  const startedAt = captureSessionUserRevision();

  try {
    await deletePet(pet.id);

    if (!isSessionUserRevisionCurrent(startedAt)) {
      pets.value = [];
      status.value = "unavailable";

      return;
    }

    pets.value = pets.value.filter((item) => item.id !== pet.id);
    await uni.showToast({ title: "宠物档案已删除", icon: "success" }).catch(() => undefined);
  } catch (error) {
    if (isSessionUserRevisionCurrent(startedAt)) {
      deleteError.value = errorMessage(error, "删除失败，宠物档案仍保留，请重试");
    }
  } finally {
    deletingId.value = "";
  }
}

onShow(() => void loadPets());
</script>

<template>
  <SubPageLayout title="我的宠物">
    <template #header-right>
      <button
        class="h-control w-control flex items-center justify-center bg-transparent p-0"
        style="margin: 0; border: none; background: transparent"
        :class="canAdd ? '' : 'opacity-50'"
        :disabled="!canAdd"
        :aria-disabled="!canAdd"
        aria-label="添加宠物"
        @click="addPet"
      >
        <image class="h-icon-sm w-icon-sm" src="/static/main/plus.svg" mode="aspectFit" />
      </button>
    </template>

    <view class="flex flex-col gap-copy px-action py-card">
      <view v-if="status === 'loading'" class="main-card p-action" aria-live="polite">
        <text class="text-body text-muted leading-body">宠物档案加载中…</text>
      </view>

      <view
        v-else-if="status === 'unavailable'"
        class="flex flex-col items-center gap-copy rounded-card bg-warning-soft p-card"
        role="alert"
      >
        <text class="text-body text-ink leading-body">当前账户暂时无法使用宠物档案</text>
        <button
          class="h-control rounded-control bg-brand px-action text-body text-surface"
          @click="returnToProfile"
        >
          返回我的
        </button>
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
          @click="loadPets"
        >
          重新加载
        </button>
      </view>

      <template v-else>
        <view class="flex items-center justify-between">
          <text class="section-heading">宠物档案</text>
          <text class="quiet-text">
            {{ pets.length }}/{{ PET_PROFILE_LIMITS.MAX_PETS_PER_OWNER }} 只
          </text>
        </view>

        <view
          v-if="pets.length === 0"
          class="flex flex-col items-center gap-copy main-card p-section"
          aria-live="polite"
        >
          <image
            class="h-avatar-xl w-avatar-xl"
            src="/static/main/petcare-placeholder-light.svg"
            mode="aspectFit"
          />
          <text class="card-heading">还没有宠物档案</text>
          <text class="text-center meta-text">添加真实档案后，可在后续服务中直接选择宠物。</text>
        </view>

        <view v-else class="grid grid-cols-2 gap-copy">
          <view
            v-for="pet in pets"
            :key="pet.id"
            class="min-w-0 flex flex-col main-card p-copy"
            :class="deletingId ? 'opacity-60' : ''"
            hover-class="opacity-80"
            :aria-label="`查看${pet.name}的宠物档案`"
            @click="openPet(pet.id)"
          >
            <image
              class="h-card-cover w-full rounded-control bg-divider"
              :src="petCoverImage(pet)"
              mode="aspectFill"
            />
            <text class="mt-copy truncate card-heading">{{ pet.name }}</text>
            <text class="mt-caption truncate meta-text">{{ pet.breed }}</text>
            <text class="mt-caption quiet-text">{{ formatPetSummary(pet) }}</text>
            <button
              class="mt-copy h-control w-full rounded-control bg-danger-soft px-copy text-caption text-danger"
              :class="deletingId ? 'opacity-50' : ''"
              :disabled="Boolean(deletingId)"
              :aria-disabled="Boolean(deletingId)"
              :loading="deletingId === pet.id"
              :aria-label="`删除${pet.name}`"
              @click.stop="removePet(pet)"
            >
              {{ deletingId === pet.id ? "删除中…" : "删除" }}
            </button>
          </view>
        </view>

        <text v-if="deleteError" class="text-caption text-danger leading-caption" role="alert">
          {{ deleteError }}
        </text>
      </template>
    </view>

    <template #actions>
      <button
        class="h-button w-full flex items-center justify-center gap-sm rounded-control"
        :class="canAdd ? 'bg-brand' : 'bg-brand-disabled'"
        :disabled="!canAdd"
        :aria-disabled="!canAdd"
        @click="addPet"
      >
        <image class="h-icon-sm w-icon-sm" src="/static/main/plus.svg" mode="aspectFit" />
        <text
          class="text-button font-semibold leading-button"
          :class="canAdd ? 'text-surface' : 'text-disabled'"
        >
          {{
            pets.length >= PET_PROFILE_LIMITS.MAX_PETS_PER_OWNER ? "已达到 5 只上限" : "添加宠物"
          }}
        </text>
      </button>
    </template>
  </SubPageLayout>
</template>
