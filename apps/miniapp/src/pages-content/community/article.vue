<script setup lang="ts">
import { onLoad } from "@dcloudio/uni-app";
import { ref } from "vue";
import SubPageLayout from "@/components/SubPageLayout.vue";

const postId = ref("post-1");
const comments = [
  { name: "栗子妈妈", text: "旺财看起来玩得特别开心！" },
  { name: "阿哲和团子", text: "这个市集对小型犬也友好吗？" },
  { name: "郑先生", text: "照片拍得真有活力，下次也想去看看。" },
] as const;
const related = [
  { id: "post-2", title: "换季梳毛第三天，栗子终于主动趴好了" },
  { id: "post-3", title: "清晨散步路线收藏：树荫多、人也少" },
] as const;

onLoad((query = {}) => {
  if (typeof query.id === "string" && query.id) {
    postId.value = query.id;
  }
});

function openPost(id: string) {
  uni.navigateTo({ url: `/pages-content/community/article?id=${encodeURIComponent(id)}` });
}
</script>

<template>
  <SubPageLayout title="社区动态">
    <view class="flex flex-col gap-copy px-action py-card">
      <view class="main-card p-action">
        <view class="flex items-center gap-copy">
          <image
            class="h-avatar w-avatar rounded-full"
            src="/static/main/owner-1.jpg"
            mode="aspectFill"
          />
          <view class="min-w-0 flex flex-1 flex-col">
            <text class="text-body text-ink font-semibold leading-label">小林与旺财</text>
            <text class="quiet-text">静安区 · 12分钟前 · {{ postId }}</text>
          </view>
          <view
            class="h-control flex items-center justify-center border border-brand rounded-pill px-copy opacity-50"
            aria-disabled="true"
          >
            <text class="text-caption text-brand font-medium leading-caption">关注</text>
          </view>
        </view>

        <text class="mt-action block card-heading">第一次参加宠物友好市集</text>
        <text class="mt-copy block text-body text-ink leading-body">
          旺财见到好多新朋友，回家路上还一直回头看。现场饮水点和休息区都很充足，带宠物出门轻松了很多。
        </text>
        <image
          class="mt-action h-hero w-full rounded-control"
          src="/static/main/community-pet-2.jpg"
          mode="aspectFill"
        />
        <view class="mt-copy flex gap-sm">
          <view
            v-for="tag in ['城市养宠日记', '宠物友好市集']"
            :key="tag"
            class="rounded-pill bg-soft px-copy py-caption"
          >
            <text class="text-caption text-brand leading-caption">#{{ tag }}</text>
          </view>
        </view>

        <view class="mt-action flex border-t border-divider pt-copy opacity-50">
          <view
            v-for="action in ['286 赞', '42 评论', '分享']"
            :key="action"
            class="h-control flex flex-1 items-center justify-center"
            aria-disabled="true"
          >
            <text class="text-caption text-muted leading-caption">{{ action }}</text>
          </view>
        </view>
      </view>

      <view class="main-card p-action">
        <text class="card-heading">评论</text>
        <view class="mt-copy flex flex-col gap-copy">
          <view
            v-for="comment in comments"
            :key="comment.name"
            class="border-b border-divider pb-copy last:border-0"
          >
            <text class="text-body text-ink font-medium leading-label">{{ comment.name }}</text>
            <text class="mt-caption block meta-text">{{ comment.text }}</text>
          </view>
        </view>
      </view>

      <view>
        <text class="section-heading">相关动态</text>
        <view class="mt-copy flex flex-col gap-sm">
          <view
            v-for="item in related"
            :key="item.id"
            class="flex items-center justify-between gap-copy main-card p-action"
            hover-class="opacity-80"
            @click="openPost(item.id)"
          >
            <text class="min-w-0 flex-1 text-body text-ink font-medium leading-body">
              {{ item.title }}
            </text>
            <image class="h-icon-xs w-icon-xs" src="/static/main/chevron.svg" mode="aspectFit" />
          </view>
        </view>
      </view>
    </view>
  </SubPageLayout>
</template>
