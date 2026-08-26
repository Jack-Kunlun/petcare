<script setup lang="ts">
import { onLoad } from "@dcloudio/uni-app";
import { ref } from "vue";
import SubPageLayout from "@/components/SubPageLayout.vue";

const articleId = ref("article-1");
const sections = [
  {
    title: "先确认掉毛是否正常",
    body: "换季时均匀掉毛通常属于正常现象；若出现局部秃斑、红肿或频繁抓挠，应及时咨询专业人员。",
  },
  {
    title: "建立温和的梳毛节奏",
    body: "每天短时梳理比偶尔长时间拉扯更容易让宠物适应，先从背部等接受度高的位置开始。",
  },
  {
    title: "同步观察饮食与环境",
    body: "稳定饮食、补充饮水并保持居住环境清洁，有助于减少毛发和皮屑在室内积聚。",
  },
] as const;
const checklist = [
  "选择适合毛型的梳具",
  "每次控制在宠物可接受的时长",
  "记录皮肤异常并及时处理",
] as const;
const articleActions = [
  { label: "评论", icon: "/static/main/community-comment.svg" },
  { label: "收藏", icon: "/static/main/favorite.svg" },
  { label: "分享", icon: "/static/main/community-share.svg" },
] as const;
const related = [
  { id: "article-2", title: "幼犬第一次换粮，如何平稳度过适应期？" },
  { id: "article-3", title: "猫咪饮水变少时，可以先检查这三件事" },
  { id: "article-4", title: "夏季遛狗时段与补水清单" },
] as const;

onLoad((query = {}) => {
  if (typeof query.id === "string" && query.id) {
    articleId.value = query.id;
  }
});

function openArticle(id: string) {
  uni.navigateTo({ url: `/pages-content/classroom/article?id=${encodeURIComponent(id)}` });
}
</script>

<template>
  <SubPageLayout title="萌宠课堂">
    <view class="flex flex-col pb-card">
      <image class="h-hero w-full" src="/static/main/community-pet-4.jpg" mode="aspectFill" />
      <view class="flex flex-col gap-card px-action py-card">
        <view>
          <text class="text-caption text-brand font-medium leading-caption">日常护理</text>
          <text class="mt-sm block page-heading">换季掉毛别焦虑，做好这 4 件事就够了</text>
          <text class="mt-copy block quiet-text">PetCare 编辑部 · 2026-08-20 · 阅读 5 分钟</text>
          <text class="mt-action block text-body text-muted leading-body">
            {{ articleId }} · 先观察、再调整，让日常护理保持温和而稳定。
          </text>
        </view>

        <view v-for="section in sections" :key="section.title" class="main-card p-action">
          <text class="card-heading">{{ section.title }}</text>
          <text class="mt-copy block text-body text-muted leading-body">{{ section.body }}</text>
        </view>

        <view class="rounded-card bg-soft p-action">
          <text class="card-heading">护理清单</text>
          <view class="mt-copy flex flex-col gap-copy">
            <view v-for="item in checklist" :key="item" class="flex items-center gap-sm">
              <image class="h-icon-xs w-icon-xs" src="/static/main/check.svg" mode="aspectFit" />
              <text class="meta-text">{{ item }}</text>
            </view>
          </view>
        </view>

        <view>
          <text class="section-heading">相关阅读</text>
          <view class="mt-copy flex flex-col gap-sm">
            <view
              v-for="item in related"
              :key="item.id"
              class="flex items-center justify-between gap-copy main-card p-action"
              hover-class="opacity-80"
              @click="openArticle(item.id)"
            >
              <text class="min-w-0 flex-1 text-body text-ink font-medium leading-body">
                {{ item.title }}
              </text>
              <image class="h-icon-xs w-icon-xs" src="/static/main/chevron.svg" mode="aspectFit" />
            </view>
          </view>
        </view>
      </view>
    </view>

    <template #actions>
      <view class="flex opacity-50" aria-disabled="true">
        <view
          v-for="action in articleActions"
          :key="action.label"
          class="h-control flex flex-1 items-center justify-center gap-sm"
        >
          <image class="h-icon-sm w-icon-sm" :src="action.icon" mode="aspectFit" />
          <text class="text-caption text-muted leading-caption">{{ action.label }}</text>
        </view>
      </view>
    </template>
  </SubPageLayout>
</template>
