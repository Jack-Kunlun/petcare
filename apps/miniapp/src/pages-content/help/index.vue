<script setup lang="ts">
import SubPageLayout from "@/components/SubPageLayout.vue";

const categories = ["账号与认证", "悬赏与订单", "服务记录", "费用与优惠"] as const;
const faqs = [
  {
    question: "如何发布悬赏？",
    answer: "进入悬赏大厅，点击右下角发布按钮，按三步填写并确认即可。",
  },
  {
    question: "怎样查看服务进度？",
    answer: "从首页服务卡或订单列表进入详情，可查看时间线和静态照护记录。",
  },
  {
    question: "照护者如何认证？",
    answer: "正式版本会在个人中心提供认证入口，当前静态页面暂不开放提交。",
  },
  { question: "如何修改宠物档案？", answer: "进入我的宠物，选择宠物后点击底部编辑档案。" },
  {
    question: "优惠券在哪里查看？",
    answer: "在我的页面点击优惠券统计，即可查看可用、已用和过期状态。",
  },
  {
    question: "遇到服务问题怎么办？",
    answer: "先保留订单与照护记录，再通过联系客服页面了解处理渠道。",
  },
] as const;
</script>

<template>
  <SubPageLayout title="帮助中心">
    <view class="flex flex-col gap-card px-action py-card">
      <view
        class="h-control flex items-center gap-sm rounded-control bg-surface px-copy shadow-card"
      >
        <image class="h-icon-sm w-icon-sm" src="/static/main/search.svg" mode="aspectFit" />
        <text class="text-body text-subtle leading-label">搜索常见问题</text>
      </view>

      <view>
        <text class="section-heading">问题分类</text>
        <view class="grid grid-cols-2 mt-copy gap-copy">
          <view
            v-for="category in categories"
            :key="category"
            class="h-actions flex items-center justify-center rounded-card bg-soft p-copy"
          >
            <text class="text-body text-brand font-medium leading-label">{{ category }}</text>
          </view>
        </view>
      </view>

      <view>
        <text class="section-heading">常见问题</text>
        <view class="mt-copy flex flex-col gap-copy">
          <view v-for="faq in faqs" :key="faq.question" class="main-card p-action">
            <text class="text-body text-ink font-semibold leading-label">{{ faq.question }}</text>
            <text class="mt-sm block meta-text">{{ faq.answer }}</text>
          </view>
        </view>
      </view>
    </view>
  </SubPageLayout>
</template>
