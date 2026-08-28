<script setup lang="ts">
import { onShow } from "@dcloudio/uni-app";
import { PET_PROFILE_LIMITS } from "@petcare/shared-types";
import type { MyPetListItem } from "@petcare/shared-types";
import { computed, ref, watch } from "vue";
import { getMyPets } from "@/api/pets";
import { MiniappApiError } from "@/api/request";
import PcButton from "@/components/PcButton.vue";
import PcStatePanel from "@/components/PcStatePanel.vue";
import SubPageLayout from "@/components/SubPageLayout.vue";
import { formatPetSummary, petCoverImage } from "@/domain/pet-display";
import { captureSessionUserRevision, isSessionUserRevisionCurrent, session } from "@/state/session";

const pets = ref<MyPetListItem[]>([]);
const status = ref<"loading" | "ready" | "error" | "unavailable" | "unauthenticated">("loading");
const loading = ref(false);
const canAdd = computed(
  () => status.value === "ready" && pets.value.length < PET_PROFILE_LIMITS.MAX_PETS_PER_OWNER,
);

async function loadPets(): Promise<void> {
  if (!session.user) {
    pets.value = [];
    status.value = session.bootstrapped ? "unauthenticated" : "loading";

    return;
  }

  if (loading.value) {
    return;
  }

  loading.value = true;
  status.value = "loading";
  const startedAt = captureSessionUserRevision();

  try {
    const response = await getMyPets();

    if (!isSessionUserRevisionCurrent(startedAt)) {
      pets.value = [];
      status.value = "unauthenticated";

      return;
    }

    pets.value = response;
    status.value = "ready";
  } catch (error) {
    pets.value = [];

    if (
      !isSessionUserRevisionCurrent(startedAt) ||
      (error instanceof MiniappApiError && error.statusCode === 401)
    ) {
      status.value = "unauthenticated";
    } else if (error instanceof MiniappApiError && error.statusCode === 403) {
      status.value = "unavailable";
    } else {
      status.value = "error";
    }
  } finally {
    loading.value = false;
  }
}

function openPet(id: string): void {
  uni.navigateTo({ url: `/pages-account/pets/detail?id=${encodeURIComponent(id)}` });
}

function addPet(): void {
  if (canAdd.value) {
    uni.navigateTo({ url: "/pages-account/pets/form" });
  }
}

function returnToProfile(): void {
  uni.redirectTo({ url: "/pages/profile/index" });
}

function openLogin(): void {
  uni.navigateTo({ url: "/pages/auth/index" });
}

onShow(() => void loadPets());

watch(
  () => session.bootstrapped,
  (bootstrapped) => {
    if (bootstrapped) {
      void loadPets();
    }
  },
);
</script>

<template>
  <SubPageLayout title="我的宠物">
    <view class="flex flex-col gap-copy px-action py-card">
      <PcStatePanel v-if="status === 'loading'" status="loading" title="宠物档案加载中…" />

      <PcStatePanel
        v-else-if="status === 'unauthenticated'"
        status="unauthenticated"
        title="登录后管理宠物档案"
        description="登录后可创建、查看和维护自己的宠物资料。"
        primary-label="微信登录"
        @primary="openLogin"
      />

      <PcStatePanel
        v-else-if="status === 'unavailable'"
        status="unavailable"
        title="当前无法使用宠物档案"
        description="请返回我的页面后重试。"
        primary-label="返回我的"
        @primary="returnToProfile"
      />

      <PcStatePanel
        v-else-if="status === 'error'"
        status="error"
        title="宠物档案加载失败"
        description="请检查网络后重试。"
        primary-label="重新加载"
        :primary-disabled="loading"
        @primary="loadPets"
      />

      <template v-else>
        <view class="flex items-center justify-between">
          <text class="section-heading">宠物档案</text>
          <text class="quiet-text">
            {{ pets.length }}/{{ PET_PROFILE_LIMITS.MAX_PETS_PER_OWNER }} 只
          </text>
        </view>

        <PcStatePanel
          v-if="pets.length === 0"
          status="empty"
          title="还没有宠物档案"
          description="点击下方添加宠物，创建第一份档案。"
        />

        <view v-else class="grid grid-cols-2 gap-copy">
          <view
            v-for="pet in pets"
            :key="pet.id"
            class="min-w-0 flex flex-col main-card p-copy"
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
          </view>
        </view>
      </template>
    </view>

    <template v-if="status === 'ready'" #actions>
      <PcButton block size="action" :disabled="!canAdd" @click="addPet">
        <template #prefix>
          <image class="h-icon-sm w-icon-sm" src="/static/main/plus.svg" mode="aspectFit" />
        </template>
        {{ pets.length >= PET_PROFILE_LIMITS.MAX_PETS_PER_OWNER ? "已达到 5 只上限" : "添加宠物" }}
      </PcButton>
    </template>
  </SubPageLayout>
</template>
