<script setup lang="ts">
import { onShow } from "@dcloudio/uni-app";
import { PET_PROFILE_LIMITS } from "@petcare/shared-types";
import type { MyPetListItem } from "@petcare/shared-types";
import { computed, ref } from "vue";
import { getMyPets } from "@/api/pets";
import { getProfile } from "@/api/user";
import MainTabLayout from "@/components/MainTabLayout.vue";
import { runLogoutFlow } from "@/pages/profile/logout";
import { formatPetSummary, petCoverImage } from "@/pages-account/pets/pet-profile";
import { getDefaultAvatar } from "@/state/default-avatar";
import {
  captureSessionUserRevision,
  isSessionUserRevisionCurrent,
  logout,
  session,
  updateSessionUser,
} from "@/state/session";

definePage({
  style: {
    navigationBarTextStyle: "black",
    navigationStyle: "custom",
  },
});

const supportItems = [
  {
    icon: "/static/main/help.svg",
    label: "帮助中心",
    detail: "常见问题与使用指南",
    route: "/pages-content/help/index",
  },
  {
    icon: "/static/main/customer.svg",
    label: "联系客服",
    detail: "查看已发布联系方式",
    route: "/pages-content/contact/index",
  },
  {
    icon: "/static/main/help.svg",
    label: "隐私协议",
    detail: "查看已发布隐私内容",
    route: "/pages-content/legal/index?key=privacy",
  },
] as const;

const loadingProfile = ref(false);
const loadingPets = ref(false);
const logoutPending = ref(false);
const profileError = ref("");
const petError = ref("");
const pets = ref<MyPetListItem[]>([]);
const petStatus = ref<"idle" | "loading" | "ready" | "error">("idle");
const profile = computed(() => session.user);
const featuredPets = computed(() => pets.value.slice(0, 2));
const avatarUrl = computed(() => {
  const user = profile.value;

  return user ? (user.avatar ?? getDefaultAvatar(user.id)) : "/static/main/profile-cat.png";
});

async function refreshProfile() {
  if (!session.user || loadingProfile.value) {
    return;
  }

  loadingProfile.value = true;
  profileError.value = "";
  const startedAt = captureSessionUserRevision();

  try {
    updateSessionUser(await getProfile(), startedAt);
  } catch {
    profileError.value = "个人资料加载失败";
  } finally {
    loadingProfile.value = false;
  }
}

async function refreshPets(): Promise<void> {
  if (!session.user) {
    pets.value = [];
    petStatus.value = "idle";

    return;
  }

  if (loadingPets.value) {
    return;
  }

  loadingPets.value = true;
  petStatus.value = "loading";
  petError.value = "";
  const startedAt = captureSessionUserRevision();

  try {
    const response = await getMyPets();

    if (!isSessionUserRevisionCurrent(startedAt)) {
      pets.value = [];
      petStatus.value = "idle";

      return;
    }

    pets.value = response;
    petStatus.value = "ready";
  } catch {
    if (isSessionUserRevisionCurrent(startedAt)) {
      pets.value = [];
      petStatus.value = "error";
      petError.value = "宠物档案加载失败";
    }
  } finally {
    loadingPets.value = false;
  }
}

onShow(() => {
  void refreshProfile();
  void refreshPets();
});

function openPage(route: string) {
  uni.navigateTo({ url: route });
}

function openPet(id: string): void {
  openPage(`/pages-account/pets/detail?id=${encodeURIComponent(id)}`);
}

function addPet(): void {
  if (
    profile.value &&
    petStatus.value === "ready" &&
    pets.value.length < PET_PROFILE_LIMITS.MAX_PETS_PER_OWNER
  ) {
    openPage("/pages-account/pets/form");
  }
}

function openCancellation() {
  if (logoutPending.value) {
    return;
  }

  uni.navigateTo({ url: "/pages-account/account/cancel" });
}

async function logoutCurrentDevice(): Promise<void> {
  await runLogoutFlow(logoutPending, {
    logout,
    reLaunch: (options) => uni.reLaunch(options),
    showToast: (options) => uni.showToast(options),
  });
}
</script>

<template>
  <MainTabLayout active="profile">
    <template #header>
      <view class="flex items-center justify-between">
        <text class="page-heading">我的</text>
        <text class="text-amount text-muted leading-card">···</text>
      </view>
    </template>

    <view class="box-border flex flex-col pb-screen">
      <view class="mx-page-horizontal overflow-hidden main-card p-card-padding">
        <view
          v-if="profile"
          class="flex items-center gap-copy"
          hover-class="opacity-80"
          @click="openPage('/pages-account/profile/info')"
        >
          <image
            class="h-avatar-lg w-avatar-lg shrink-0 rounded-full"
            :src="avatarUrl"
            mode="aspectFill"
          />
          <view class="min-w-0 flex flex-1 flex-col">
            <view class="flex items-center gap-sm">
              <text class="text-section text-ink font-semibold leading-section">
                {{ profile.nickname }}
              </text>
            </view>
            <text class="mt-caption meta-text">{{ profile.region || "未填写所在地区" }}</text>
            <text
              class="mt-caption text-caption leading-caption"
              :class="profile.profileComplete ? 'text-success' : 'text-muted'"
            >
              {{ profile.profileComplete ? profile.phoneMasked : "请完善手机号以维护账户资料" }}
            </text>
          </view>
          <image class="h-icon-sm w-icon-sm" src="/static/main/chevron.svg" mode="aspectFit" />
        </view>

        <view v-else class="flex flex-col items-center gap-sm py-action">
          <text class="text-body text-muted leading-body">
            {{
              !session.bootstrapped || loadingProfile ? "正在加载个人资料…" : "登录后查看个人资料"
            }}
          </text>
          <button
            v-if="session.bootstrapped"
            class="m-0 h-control flex items-center justify-center border-0 rounded-control bg-brand px-action"
            aria-label="微信登录"
            hover-class="opacity-80"
            @click="openPage('/pages/auth/index')"
          >
            <text class="text-body text-white font-medium leading-label">微信登录</text>
          </button>
        </view>

        <view
          v-if="profileError"
          class="mt-copy flex items-center justify-between bg-danger-soft p-sm"
        >
          <text class="text-caption text-danger leading-caption">{{ profileError }}</text>
          <button
            class="text-caption text-brand leading-caption"
            :class="loadingProfile ? 'opacity-50' : ''"
            :disabled="loadingProfile"
            @click.stop="refreshProfile"
          >
            重试
          </button>
        </view>
      </view>

      <view class="mt-card flex items-center justify-between px-page-horizontal">
        <text class="section-heading">我的宠物</text>
        <view
          class="flex items-center gap-caption"
          hover-class="opacity-80"
          @click="openPage('/pages-account/pets/index')"
        >
          <text class="text-caption text-brand leading-caption">宠物档案</text>
          <image
            class="h-icon-xs w-icon-xs"
            src="/static/main/chevron-brand.svg"
            mode="aspectFit"
          />
        </view>
      </view>

      <view class="mt-copy px-page-horizontal pb-sm">
        <view v-if="petStatus === 'loading'" class="main-card p-action" aria-live="polite">
          <text class="text-body text-muted leading-body">宠物档案加载中…</text>
        </view>

        <view
          v-else-if="petStatus === 'error'"
          class="flex items-center justify-between gap-copy rounded-card bg-danger-soft p-copy"
          role="alert"
        >
          <text class="text-caption text-danger leading-caption">{{ petError }}</text>
          <button
            class="h-control bg-transparent px-copy text-caption text-brand"
            :class="loadingPets ? 'opacity-50' : ''"
            :disabled="loadingPets"
            :aria-disabled="loadingPets"
            @click="refreshPets"
          >
            重试
          </button>
        </view>

        <view
          v-else-if="petStatus === 'idle'"
          class="flex items-center justify-center main-card p-action"
        >
          <text class="text-body text-muted leading-body">登录后管理宠物档案</text>
        </view>

        <view v-else class="flex items-stretch gap-sm">
          <view
            v-for="pet in featuredPets"
            :key="pet.id"
            class="min-w-0 flex flex-1 flex-col items-center gap-caption main-card p-sm"
            hover-class="opacity-80"
            :aria-label="`查看${pet.name}的宠物档案`"
            @click="openPet(pet.id)"
          >
            <image
              class="h-avatar-lg w-avatar-lg shrink-0 rounded-control bg-divider"
              :src="petCoverImage(pet)"
              mode="aspectFill"
            />
            <view class="min-w-0 w-full flex flex-col items-center gap-caption">
              <text class="w-full truncate text-center card-heading">{{ pet.name }}</text>
              <text class="w-full truncate text-center meta-text">
                {{ pet.breed }} · {{ formatPetSummary(pet) }}
              </text>
            </view>
          </view>

          <view
            v-if="pets.length < PET_PROFILE_LIMITS.MAX_PETS_PER_OWNER"
            class="w-pet flex shrink-0 flex-col items-center justify-center gap-caption border border-border rounded-card border-dashed bg-surface"
            hover-class="opacity-80"
            aria-label="添加宠物"
            @click="addPet"
          >
            <text class="text-page text-brand font-medium leading-page">+</text>
            <text class="text-caption text-muted leading-caption">
              {{ pets.length === 0 ? "添加宠物" : "添加" }}
            </text>
          </view>
        </view>
      </view>

      <view class="mt-card px-page-horizontal">
        <text class="section-heading">帮助与协议</text>
      </view>
      <view class="mx-page-horizontal mt-copy overflow-hidden main-card">
        <navigator
          v-for="(item, index) in supportItems"
          :key="item.label"
          :url="item.route"
          class="flex items-center gap-copy px-card-padding py-action"
          :class="index < supportItems.length - 1 ? 'border-b border-divider' : ''"
          hover-class="opacity-80"
        >
          <view
            class="h-icon w-icon flex shrink-0 items-center justify-center rounded-control bg-divider"
          >
            <image class="h-glyph w-glyph" :src="item.icon" mode="aspectFit" />
          </view>
          <view class="min-w-0 flex flex-1 flex-col">
            <text class="text-body text-ink font-medium leading-label">{{ item.label }}</text>
            <text class="mt-caption quiet-text">{{ item.detail }}</text>
          </view>
          <image class="h-icon-xs w-icon-xs" src="/static/main/chevron.svg" mode="aspectFit" />
        </navigator>
      </view>

      <button
        v-if="profile"
        class="mx-page-horizontal mt-card h-control flex items-center justify-center rounded-control bg-danger-soft"
        :class="logoutPending ? 'opacity-50' : ''"
        :aria-disabled="logoutPending"
        :disabled="logoutPending"
        :loading="logoutPending"
        hover-class="opacity-80"
        @click="logoutCurrentDevice"
      >
        <text class="text-body text-danger font-medium leading-label">
          {{ logoutPending ? "退出中…" : "退出登录" }}
        </text>
      </button>
      <button
        v-if="profile"
        class="mx-page-horizontal mt-copy h-control flex items-center justify-center bg-transparent"
        :class="logoutPending ? 'opacity-50' : ''"
        :aria-disabled="logoutPending"
        :disabled="logoutPending"
        hover-class="opacity-80"
        @click="openCancellation"
      >
        <text class="text-caption text-danger leading-caption">注销账户</text>
      </button>
    </view>
  </MainTabLayout>
</template>
