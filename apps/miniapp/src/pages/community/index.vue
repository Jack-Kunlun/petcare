<script setup lang="ts">
import MainTabLayout from "@/components/MainTabLayout.vue";

definePage({
  style: {
    navigationBarTextStyle: "black",
    navigationStyle: "custom",
  },
});

const channelTabs = ["社区精选", "萌宠课堂", "附近动态"] as const;

const posts = [
  {
    id: "post-1",
    avatar: "/static/main/owner-1.jpg",
    author: "小林与旺财",
    detail: "静安区 · 12分钟前",
    text: "今天第一次带旺财去宠物友好市集，见到好多新朋友，回家路上还一直回头看。",
    image: "/static/main/community-pet-2.jpg",
    tag: "#城市养宠日记",
    likes: "286",
    comments: "42",
  },
  {
    id: "post-2",
    avatar: "/static/main/owner-5.jpg",
    author: "栗子妈妈",
    detail: "长宁区 · 35分钟前",
    text: "换季梳毛第三天，终于找到了栗子最喜欢的梳子。动作慢一点，它就会主动趴好啦。",
    image: "/static/main/community-pet-3.jpg",
    tag: "#猫咪护理",
    likes: "168",
    comments: "31",
  },
  {
    id: "post-3",
    avatar: "/static/main/owner-4.jpg",
    author: "阿哲和团子",
    detail: "普陀区 · 1小时前",
    text: "清晨散步的路线收藏好了，树荫多、人也少，特别适合怕热的小短腿。",
    image: "/static/main/community-pet-5.jpg",
    tag: "#附近遛狗路线",
    likes: "94",
    comments: "18",
  },
] as const;

function openCommunityArticle(id: string) {
  uni.navigateTo({ url: `/pages-content/community/article?id=${encodeURIComponent(id)}` });
}
</script>

<template>
  <MainTabLayout active="community">
    <template #header>
      <text class="page-heading">社区</text>
    </template>

    <view class="box-border flex flex-col pb-screen">
      <view class="mx-page-horizontal h-segment flex rounded-control bg-divider p-caption">
        <view
          v-for="(tab, index) in channelTabs"
          :key="tab"
          class="flex flex-1 items-center justify-center rounded-chip"
          :class="index === 0 ? 'bg-surface shadow-card' : ''"
        >
          <text
            class="text-caption font-medium leading-caption"
            :class="index === 0 ? 'text-brand' : 'text-muted'"
          >
            {{ tab }}
          </text>
        </view>
      </view>

      <view
        class="mx-page-horizontal mt-copy flex items-center justify-between rounded-card from-brand to-brand-active bg-gradient-to-r p-card-padding text-surface shadow-card"
      >
        <view class="flex flex-col gap-caption">
          <text class="text-card font-semibold leading-card">今日社区活力</text>
          <text class="text-caption leading-caption">分享真实养宠生活，发现身边同好</text>
        </view>
        <view class="flex gap-action">
          <view class="flex flex-col items-center">
            <text class="text-card font-semibold leading-card">328</text>
            <text class="text-micro leading-micro">今日新增</text>
          </view>
          <view class="flex flex-col items-center">
            <text class="text-card font-semibold leading-card">2.4k</text>
            <text class="text-micro leading-micro">互动</text>
          </view>
        </view>
      </view>

      <view class="mt-card flex items-center justify-between px-page-horizontal">
        <view class="flex items-end gap-sm">
          <text class="section-heading">社区精选</text>
          <text class="quiet-text">1,286 人正在这里</text>
        </view>
        <text class="text-caption text-brand leading-caption">刷新</text>
      </view>

      <view class="mx-page-horizontal mt-copy flex flex-col gap-copy">
        <view v-for="post in posts" :key="post.author" class="overflow-hidden main-card">
          <view class="flex items-center justify-between p-card-padding pb-copy">
            <view class="flex items-center gap-copy">
              <image class="h-avatar w-avatar rounded-full" :src="post.avatar" mode="aspectFill" />
              <view class="flex flex-col">
                <text class="text-body text-ink font-semibold leading-label">{{
                  post.author
                }}</text>
                <text class="quiet-text">{{ post.detail }}</text>
              </view>
            </view>
            <view
              class="border border-brand rounded-pill px-copy py-caption opacity-50"
              aria-disabled="true"
            >
              <text class="text-caption text-brand font-medium leading-caption">关注</text>
            </view>
          </view>

          <view
            class="px-card-padding pb-copy"
            hover-class="opacity-80"
            @click="openCommunityArticle(post.id)"
          >
            <text class="text-body text-ink leading-body">{{ post.text }}</text>
          </view>

          <view
            class="relative mx-card-padding h-hero-main overflow-hidden rounded-control"
            hover-class="opacity-80"
            @click="openCommunityArticle(post.id)"
          >
            <image class="h-full w-full" :src="post.image" mode="aspectFill" />
            <view class="absolute bottom-sm left-sm rounded-pill bg-ink px-sm py-caption">
              <text class="text-caption text-surface leading-caption">{{ post.tag }}</text>
            </view>
          </view>

          <view
            class="mt-copy flex items-center border-t border-divider px-card-padding py-copy opacity-50"
            aria-disabled="true"
          >
            <view class="h-control flex flex-1 items-center gap-sm">
              <image
                class="h-icon-sm w-icon-sm"
                src="/static/main/community-like.svg"
                mode="aspectFit"
              />
              <text class="text-caption text-muted leading-caption">{{ post.likes }}</text>
            </view>
            <view class="h-control flex flex-1 items-center justify-center gap-sm">
              <image
                class="h-icon-sm w-icon-sm"
                src="/static/main/community-comment.svg"
                mode="aspectFit"
              />
              <text class="text-caption text-muted leading-caption">{{ post.comments }}</text>
            </view>
            <view class="h-control flex flex-1 items-center justify-end gap-sm">
              <image
                class="h-icon-sm w-icon-sm"
                src="/static/main/community-share.svg"
                mode="aspectFit"
              />
              <text class="text-caption text-muted leading-caption">分享</text>
            </view>
          </view>
        </view>
      </view>
    </view>

    <template #floating>
      <view
        class="h-fab w-fab flex items-center justify-center rounded-full bg-brand opacity-50 shadow-float"
        aria-label="发布动态"
        aria-disabled="true"
      >
        <image class="h-glyph w-glyph" src="/static/main/plus.svg" mode="aspectFit" />
      </view>
    </template>
  </MainTabLayout>
</template>
