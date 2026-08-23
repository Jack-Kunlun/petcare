<script setup lang="ts">
import MainTabLayout from "@/components/MainTabLayout.vue";

definePage({
  style: {
    navigationBarTextStyle: "black",
    navigationStyle: "custom",
  },
});

const profileStats: { value: string; label: string; route?: string }[] = [
  { value: "12笔", label: "我的订单", route: "/pages-care/orders/index" },
  { value: "2只", label: "我的宠物", route: "/pages-account/pets/index" },
  { value: "3张", label: "优惠券" },
  { value: "856元", label: "余额收入" },
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
  { icon: "/static/main/help.svg", label: "帮助中心", detail: "常见问题与使用指南" },
  { icon: "/static/main/customer.svg", label: "联系客服", detail: "工作日 09:00–20:00" },
] as const;

function openStat(route?: string) {
  if (route) {
    uni.navigateTo({ url: route });
  }
}

function openPage(route: string) {
  uni.navigateTo({ url: route });
}
</script>

<template>
  <MainTabLayout active="profile">
    <view class="box-border flex flex-col pb-screen">
      <view class="h-header flex items-center justify-between px-action">
        <text class="page-heading">我的</text>
        <text class="text-amount text-muted leading-card">···</text>
      </view>

      <view class="mx-action overflow-hidden main-card p-action">
        <view
          class="flex items-center gap-copy"
          hover-class="opacity-80"
          @click="openPage('/pages-account/profile/info')"
        >
          <view
            class="h-avatar-lg w-avatar-lg flex shrink-0 items-center justify-center rounded-full bg-brand text-card text-surface font-semibold"
          >
            郑
          </view>
          <view class="min-w-0 flex flex-1 flex-col">
            <view class="flex items-center gap-sm">
              <text class="text-section text-ink font-semibold leading-section">郑先生</text>
              <view class="rounded-pill bg-warning-soft px-sm py-caption">
                <text class="text-micro text-warning font-medium leading-micro">普通会员</text>
              </view>
            </view>
            <text class="mt-caption meta-text">上海市 · 静安区</text>
          </view>
          <image class="h-icon-sm w-icon-sm" src="/static/main/chevron.svg" mode="aspectFit" />
        </view>

        <view class="mt-action rounded-control bg-soft p-copy">
          <view class="flex items-center justify-between">
            <view class="flex items-baseline gap-sm">
              <text class="text-caption text-muted leading-caption">PetCare 信用</text>
              <text class="text-amount text-brand font-semibold leading-card">720</text>
            </view>
            <text class="text-caption text-success font-medium leading-caption">信用良好</text>
          </view>
          <view class="mt-sm h-progress overflow-hidden rounded-pill bg-surface">
            <view class="h-full rounded-pill bg-brand" style="width: 72%" />
          </view>
        </view>
      </view>

      <view class="mx-action mt-copy flex main-card py-action">
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

      <view class="mt-card flex items-center justify-between px-action">
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

      <view class="mt-copy flex items-stretch gap-sm px-action pb-sm">
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

      <view class="mt-card px-action">
        <text class="section-heading">我的内容</text>
      </view>
      <view class="mx-action mt-copy overflow-hidden main-card">
        <view
          v-for="(item, index) in contentItems"
          :key="item.label"
          class="flex items-center gap-copy px-action py-action"
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

      <view class="mt-card px-action">
        <text class="section-heading">服务与帮助</text>
      </view>
      <view class="mx-action mt-copy overflow-hidden main-card">
        <view
          v-for="(item, index) in supportItems"
          :key="item.label"
          class="flex items-center gap-copy px-action py-action"
          :class="index < supportItems.length - 1 ? 'border-b border-divider' : ''"
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
        </view>
      </view>

      <view
        class="mx-action mt-card h-control flex items-center justify-center rounded-control bg-danger-soft opacity-50"
        aria-disabled="true"
      >
        <text class="text-body text-danger font-medium leading-label">退出登录</text>
      </view>
    </view>
  </MainTabLayout>
</template>
