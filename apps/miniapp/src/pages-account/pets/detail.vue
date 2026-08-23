<script setup lang="ts">
import { onLoad } from "@dcloudio/uni-app";
import { ref } from "vue";
import { getPetById } from "../fixtures";
import SubPageLayout from "@/components/SubPageLayout.vue";

const pet = ref(getPetById());
const facts = [
  { label: "性别", value: "妹妹" },
  { label: "生日", value: "2023年5月12日" },
  { label: "体重", value: "4.6kg" },
  { label: "绝育", value: "已绝育" },
] as const;

onLoad((query = {}) => {
  pet.value = getPetById(typeof query.id === "string" ? query.id : undefined);
});

function editPet() {
  uni.navigateTo({
    url: `/pages-account/pets/form?mode=edit&id=${encodeURIComponent(pet.value.id)}`,
  });
}
</script>

<template>
  <SubPageLayout title="宠物档案">
    <view class="flex flex-col gap-copy px-action py-card">
      <view class="flex flex-col items-center main-card p-card">
        <image class="h-card-cover w-card-cover rounded-full" :src="pet.image" mode="aspectFill" />
        <text class="mt-copy page-heading">{{ pet.name }}</text>
        <text class="mt-caption meta-text">{{ pet.breed }} · {{ pet.age }}</text>
        <view class="mt-copy flex gap-sm">
          <view class="rounded-pill bg-success-soft px-copy py-caption">
            <text class="text-caption text-success leading-caption">疫苗已完成</text>
          </view>
          <view class="rounded-pill bg-soft px-copy py-caption">
            <text class="text-caption text-brand leading-caption">已驱虫</text>
          </view>
        </view>
      </view>

      <view class="main-card p-action">
        <text class="card-heading">基本信息</text>
        <view class="grid grid-cols-2 mt-copy gap-copy">
          <view v-for="fact in facts" :key="fact.label" class="rounded-control bg-divider p-copy">
            <text class="quiet-text">{{ fact.label }}</text>
            <text class="mt-caption block text-body text-ink font-medium leading-label">
              {{ fact.value }}
            </text>
          </view>
        </view>
      </view>

      <view class="main-card p-action">
        <text class="card-heading">照护偏好</text>
        <text class="mt-copy block meta-text"
          >每天两餐，喜欢安静环境；进门后先坐下等待它主动靠近。</text
        >
      </view>
    </view>

    <template #actions>
      <view
        class="h-button flex items-center justify-center rounded-control bg-brand"
        @click="editPet"
      >
        <text class="text-button text-surface font-semibold leading-button">编辑档案</text>
      </view>
    </template>
  </SubPageLayout>
</template>
