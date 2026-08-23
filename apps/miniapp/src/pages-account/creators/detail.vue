<script setup lang="ts">
import { onLoad } from "@dcloudio/uni-app";
import { ref } from "vue";
import SubPageLayout from "@/components/SubPageLayout.vue";

const creatorId = ref("creator-1");
const articles = [
  "换季梳毛的四个关键动作",
  "猫咪第一次寄养前要准备什么",
  "如何观察宠物的饮水变化",
] as const;

onLoad((query = {}) => {
  if (typeof query.id === "string" && query.id) {
    creatorId.value = query.id;
  }
});
</script>

<template>
  <SubPageLayout title="创作者主页">
    <view class="flex flex-col gap-copy px-action py-card">
      <view class="flex flex-col items-center main-card p-card">
        <image
          class="h-card-cover w-card-cover rounded-full"
          src="/static/main/owner-5.jpg"
          mode="aspectFill"
        />
        <text class="mt-copy page-heading">栗子妈妈</text>
        <text class="mt-caption meta-text">{{ creatorId }} · 猫咪护理创作者</text>
        <view class="mt-action w-full flex">
          <view class="flex flex-1 flex-col items-center border-r border-divider">
            <text class="card-heading">128</text>
            <text class="quiet-text">内容</text>
          </view>
          <view class="flex flex-1 flex-col items-center border-r border-divider">
            <text class="card-heading">1.8万</text>
            <text class="quiet-text">粉丝</text>
          </view>
          <view class="flex flex-1 flex-col items-center">
            <text class="card-heading">6.2万</text>
            <text class="quiet-text">获赞</text>
          </view>
        </view>
        <view
          class="mt-action h-control w-full flex items-center justify-center rounded-control bg-brand opacity-50"
          aria-disabled="true"
        >
          <text class="text-body text-surface font-medium leading-label">已关注</text>
        </view>
      </view>

      <view class="main-card p-action">
        <text class="card-heading">关于我</text>
        <text class="mt-copy block meta-text">记录科学、可执行的猫咪日常护理方法。</text>
        <view class="mt-copy flex gap-sm">
          <view
            v-for="tag in ['猫咪护理', '科学喂养', '行为观察']"
            :key="tag"
            class="rounded-pill bg-soft px-copy py-caption"
          >
            <text class="text-caption text-brand leading-caption">{{ tag }}</text>
          </view>
        </view>
      </view>

      <view class="main-card p-action">
        <text class="card-heading">近期内容</text>
        <view class="mt-copy flex flex-col gap-sm">
          <view
            v-for="article in articles"
            :key="article"
            class="flex items-center gap-copy rounded-control bg-divider p-copy opacity-50"
            aria-disabled="true"
          >
            <image
              class="h-mini-cover w-mini-cover rounded-control"
              src="/static/main/community-pet-4.jpg"
              mode="aspectFill"
            />
            <view class="min-w-0 flex flex-1 flex-col">
              <text class="text-body text-ink font-medium leading-label">{{ article }}</text>
              <text class="mt-caption quiet-text">文章详情将在内容页完成后开放</text>
            </view>
          </view>
        </view>
      </view>
    </view>
  </SubPageLayout>
</template>
