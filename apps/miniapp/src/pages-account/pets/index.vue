<script setup lang="ts">
import { petFixtures } from "../fixtures";
import SubPageLayout from "@/components/SubPageLayout.vue";

function openPet(id: string) {
  uni.navigateTo({ url: `/pages-account/pets/detail?id=${encodeURIComponent(id)}` });
}

function addPet() {
  uni.navigateTo({ url: "/pages-account/pets/form" });
}
</script>

<template>
  <SubPageLayout title="我的宠物">
    <view class="flex flex-col gap-copy px-action py-card">
      <view
        v-for="pet in petFixtures"
        :key="pet.id"
        class="flex items-center gap-action main-card p-action"
        hover-class="opacity-80"
        @click="openPet(pet.id)"
      >
        <image class="h-pet w-pet rounded-control" :src="pet.image" mode="aspectFill" />
        <view class="min-w-0 flex flex-1 flex-col">
          <text class="card-heading">{{ pet.name }}</text>
          <text class="mt-caption meta-text">{{ pet.breed }} · {{ pet.age }}</text>
          <view class="mt-sm self-start rounded-pill bg-success-soft px-sm py-caption">
            <text class="text-micro text-success leading-micro">健康档案完整</text>
          </view>
        </view>
        <image class="h-icon-xs w-icon-xs" src="/static/main/chevron.svg" mode="aspectFit" />
      </view>

      <view
        class="h-button flex items-center justify-center gap-sm border border-brand rounded-control bg-surface"
        hover-class="opacity-80"
        @click="addPet"
      >
        <image class="h-icon-sm w-icon-sm" src="/static/main/plus.svg" mode="aspectFit" />
        <text class="text-body text-brand font-medium leading-label">添加宠物</text>
      </view>
    </view>
  </SubPageLayout>
</template>
