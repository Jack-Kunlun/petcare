<script setup lang="ts">
import SubPageLayout from "@/components/SubPageLayout.vue";
import manifest from "@/manifest.json";

definePage({
  style: {
    navigationBarTextStyle: "black",
    navigationStyle: "custom",
  },
});

const values = [
  { title: "Connection", description: "连接人与宠物的需要" },
  { title: "Trust", description: "提供可信的养宠信息" },
  { title: "Care", description: "认真对待每一次照护" },
  { title: "Companion", description: "陪伴每段宠物生活" },
] as const;
const appVersion = uni.getSystemInfoSync().appVersion || manifest.versionName;
</script>

<template>
  <SubPageLayout title="关于我们">
    <view class="flex flex-col gap-section px-action py-card">
      <view class="flex flex-col items-center text-center">
        <view class="h-[72px] w-[72px] flex items-center justify-center">
          <image
            style="width: 62.5313px; height: 60.319px"
            src="/static/content/petcare-symbol.svg"
            mode="aspectFit"
          />
        </view>
        <text class="mt-copy text-section text-ink font-semibold leading-section">PetCare</text>
        <text class="mt-caption text-body text-muted leading-body">宠伴</text>
        <text class="mt-caption text-body text-muted leading-body">让每一次陪伴，都更安心</text>
      </view>

      <view>
        <text class="section-heading">关于 PetCare</text>
        <text class="mt-copy block text-body text-muted leading-body">
          PetCare 帮助宠物主人管理宠物档案、阅读养宠内容并记录真实生活。
        </text>
        <text class="mt-copy block text-body text-muted leading-body">
          我们认真对待每一次照护，也珍视人与宠物共同生活的日常。
        </text>
      </view>

      <view>
        <text class="section-heading">我们相信</text>
        <view class="grid grid-cols-2 mt-copy gap-copy">
          <view
            v-for="value in values"
            :key="value.title"
            class="min-w-0 flex flex-col gap-caption py-copy"
          >
            <text class="text-body text-brand font-medium leading-label">{{ value.title }}</text>
            <text class="meta-text">{{ value.description }}</text>
          </view>
        </view>
      </view>

      <view class="overflow-hidden main-card">
        <navigator
          v-for="(item, index) in [
            { label: '服务协议', route: '/pages-content/legal/index?key=terms' },
            { label: '隐私政策', route: '/pages-content/legal/index?key=privacy' },
            { label: '帮助中心', route: '/pages-content/help/index' },
            { label: '联系我们', route: '/pages-content/contact/index' },
          ]"
          :key="item.label"
          class="flex items-center justify-between px-action py-copy"
          :class="index < 3 ? 'border-b border-divider' : ''"
          :url="item.route"
          hover-class="opacity-80"
        >
          <text class="text-body text-ink font-medium leading-label">{{ item.label }}</text>
          <image class="h-icon-sm w-icon-sm" src="/static/main/chevron.svg" mode="aspectFit" />
        </navigator>
      </view>

      <view class="flex flex-col items-center gap-caption pb-copy">
        <text class="quiet-text">PetCare 宠伴</text>
        <text class="quiet-text">版本 {{ appVersion }}</text>
      </view>
    </view>
  </SubPageLayout>
</template>
