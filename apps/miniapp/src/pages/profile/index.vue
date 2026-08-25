<script setup lang="ts">
import { onShow } from "@dcloudio/uni-app";
import { computed, ref } from "vue";
import { getProfile } from "@/api/user";
import MainTabLayout from "@/components/MainTabLayout.vue";
import { getDefaultAvatar } from "@/state/default-avatar";
import { captureSessionUserRevision, logout, session, updateSessionUser } from "@/state/session";

definePage({
  style: {
    navigationBarTextStyle: "black",
    navigationStyle: "custom",
  },
});

const profileStats: { value: string; label: string; route?: string }[] = [
  { value: "12笔", label: "我的订单", route: "/pages-care/orders/index" },
  { value: "2只", label: "我的宠物", route: "/pages-account/pets/index" },
  { value: "3张", label: "优惠券", route: "/pages-content/coupons/index" },
  { value: "856元", label: "余额收入", route: "/pages-content/wallet/index" },
];

const contentItems = [
  {
    icon: "/static/main/favorite.svg",
    label: "我的收藏",
    detail: "文章、动态与服务",
    route: "/pages-account/favorites/index",
  },
  {
    icon: "/static/main/follow.svg",
    label: "我的关注",
    detail: "8 位养宠伙伴",
    route: "/pages-account/follows/index",
  },
  {
    icon: "/static/main/review.svg",
    label: "我的评价",
    detail: "信用评价与服务反馈",
    route: "/pages-account/reviews/index",
  },
] as const;

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
    detail: "工作日 09:00–20:00",
    route: "/pages-content/contact/index",
  },
] as const;

const loadingProfile = ref(false);
const logoutPending = ref(false);
const profileError = ref("");
const profile = computed(() => session.user);
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

onShow(() => void refreshProfile());

function openStat(route?: string) {
  if (route) {
    uni.navigateTo({ url: route });
  }
}

function openPage(route: string) {
  uni.navigateTo({ url: route });
}

async function logoutCurrentDevice(): Promise<void> {
  if (logoutPending.value) {
    return;
  }

  logoutPending.value = true;

  try {
    await logout();

    try {
      await uni.reLaunch({ url: "/pages/index/index" });
    } catch {
      await uni.showToast({ title: "已退出登录，但返回首页失败", icon: "none" });
    }
  } catch {
    await uni.showToast({ title: "退出登录失败，请重试", icon: "none" });
  } finally {
    logoutPending.value = false;
  }
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
              :class="profile.profileComplete ? 'text-success' : 'text-warning'"
            >
              {{ profile.profileComplete ? profile.phoneMasked : "请完善手机号后使用发布等功能" }}
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

      <view class="mx-page-horizontal mt-copy flex main-card py-action">
        <view
          v-for="(stat, index) in profileStats"
          :key="stat.label"
          class="flex flex-1 flex-col items-center gap-caption"
          :class="index < profileStats.length - 1 ? 'border-r border-divider' : ''"
          :hover-class="stat.route ? 'opacity-80' : 'none'"
          @click="openStat(stat.route)"
        >
          <text class="text-card text-ink font-semibold leading-card">{{ stat.value }}</text>
          <text class="quiet-text">{{ stat.label }}</text>
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

      <view class="mt-copy flex items-stretch gap-sm px-page-horizontal pb-sm">
        <view
          class="min-w-0 flex flex-1 flex-col items-center gap-caption main-card p-sm"
          hover-class="opacity-80"
          @click="openPage('/pages-account/pets/detail?id=mimi')"
        >
          <image
            class="h-avatar-lg w-avatar-lg shrink-0 rounded-control"
            src="/static/main/profile-cat.png"
            mode="aspectFill"
          />
          <view class="min-w-0 w-full flex flex-col items-center gap-caption">
            <text class="card-heading">咪咪</text>
            <text class="w-full truncate text-center meta-text">英国短毛猫 · 3岁</text>
          </view>
        </view>
        <view
          class="min-w-0 flex flex-1 flex-col items-center gap-caption main-card p-sm"
          hover-class="opacity-80"
          @click="openPage('/pages-account/pets/detail?id=wangcai')"
        >
          <image
            class="h-avatar-lg w-avatar-lg shrink-0 rounded-control"
            src="/static/main/profile-dog.png"
            mode="aspectFill"
          />
          <view class="min-w-0 w-full flex flex-col items-center gap-caption">
            <text class="card-heading">旺财</text>
            <text class="w-full truncate text-center meta-text">金毛寻回犬 · 4岁</text>
          </view>
        </view>
        <view
          class="w-pet flex shrink-0 flex-col items-center justify-center gap-caption border border-border rounded-card border-dashed bg-surface"
          hover-class="opacity-80"
          @click="openPage('/pages-account/pets/form')"
        >
          <text class="text-page text-brand font-medium leading-page">+</text>
          <text class="text-caption text-muted leading-caption">添加</text>
        </view>
      </view>

      <view class="mt-card px-page-horizontal">
        <text class="section-heading">我的内容</text>
      </view>
      <view class="mx-page-horizontal mt-copy overflow-hidden main-card">
        <view
          v-for="(item, index) in contentItems"
          :key="item.label"
          class="flex items-center gap-copy px-card-padding py-action"
          :class="index < contentItems.length - 1 ? 'border-b border-divider' : ''"
          hover-class="opacity-80"
          @click="openPage(item.route)"
        >
          <view
            class="h-icon w-icon flex shrink-0 items-center justify-center rounded-control bg-soft"
          >
            <image class="h-glyph w-glyph" :src="item.icon" mode="aspectFit" />
          </view>
          <view class="min-w-0 flex flex-1 flex-col">
            <text class="text-body text-ink font-medium leading-label">{{ item.label }}</text>
            <text class="mt-caption quiet-text">{{ item.detail }}</text>
          </view>
          <image class="h-icon-xs w-icon-xs" src="/static/main/chevron.svg" mode="aspectFit" />
        </view>
      </view>

      <view class="mt-card px-page-horizontal">
        <text class="section-heading">服务与帮助</text>
      </view>
      <view class="mx-page-horizontal mt-copy overflow-hidden main-card">
        <view
          v-for="(item, index) in supportItems"
          :key="item.label"
          class="flex items-center gap-copy px-card-padding py-action"
          :class="index < supportItems.length - 1 ? 'border-b border-divider' : ''"
          hover-class="opacity-80"
          @click="openPage(item.route)"
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
        </view>
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
    </view>
  </MainTabLayout>
</template>
