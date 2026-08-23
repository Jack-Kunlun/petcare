<script setup lang="ts">
import { onLoad } from "@dcloudio/uni-app";
import { ref } from "vue";
import SubPageLayout from "@/components/SubPageLayout.vue";

const storeId = ref("store-1");
const services = ["猫咪洗护 ¥128起", "犬只美容 ¥168起", "安心寄养 ¥198/晚"] as const;

onLoad((query = {}) => {
  if (typeof query.id === "string" && query.id) {
    storeId.value = query.id;
  }
});
</script>

<template>
  <SubPageLayout title="店铺详情">
    <view class="flex flex-col gap-copy pb-card">
      <image
        class="h-hero-main w-full"
        src="/static/main/home-hero-trusted.png"
        mode="aspectFill"
      />
      <view class="mx-action main-card p-action -mt-surface-overlap">
        <text class="page-heading">PetCare 静安服务站</text>
        <text class="mt-caption block meta-text">{{ storeId }} · 静安区南京西路 · 1.2km</text>
        <text class="mt-sm block text-caption text-success leading-caption"
          >营业中 · 09:00–21:00</text
        >
        <view class="mt-copy flex gap-sm">
          <view class="rounded-pill bg-soft px-copy py-caption">
            <text class="text-caption text-brand leading-caption">平台认证</text>
          </view>
          <view class="rounded-pill bg-warning-soft px-copy py-caption">
            <text class="text-caption text-warning leading-caption">4.8分</text>
          </view>
        </view>
      </view>

      <view class="mx-action main-card p-action">
        <text class="card-heading">到店服务</text>
        <view class="mt-copy flex flex-col gap-sm">
          <view
            v-for="service in services"
            :key="service"
            class="rounded-control bg-divider px-copy py-action"
          >
            <text class="meta-text">{{ service }}</text>
          </view>
        </view>
      </view>

      <view class="mx-action main-card p-action">
        <text class="card-heading">服务团队</text>
        <view class="mt-copy flex items-center gap-copy">
          <image
            class="h-avatar w-avatar rounded-full"
            src="/static/main/owner-4.jpg"
            mode="aspectFill"
          />
          <view class="flex flex-1 flex-col">
            <text class="text-body text-ink font-medium leading-label">周店长</text>
            <text class="quiet-text">国家认证宠物美容师 · 8年经验</text>
          </view>
        </view>
      </view>

      <view class="mx-action main-card p-action">
        <text class="card-heading">最近评价</text>
        <text class="mt-copy block meta-text">“环境整洁，洗护过程会主动同步，体验很安心。”</text>
      </view>
    </view>

    <template #actions>
      <view class="flex gap-copy">
        <view
          v-for="action in ['电话咨询', '导航到店']"
          :key="action"
          class="h-button flex flex-1 items-center justify-center rounded-control bg-divider opacity-50"
          aria-disabled="true"
        >
          <text class="text-body text-muted font-medium leading-label">{{ action }}</text>
        </view>
      </view>
    </template>
  </SubPageLayout>
</template>
