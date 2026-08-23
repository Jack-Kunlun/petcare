<script setup lang="ts">
import { onLoad } from "@dcloudio/uni-app";
import { computed, ref } from "vue";
import { getPetById } from "../fixtures";
import { getPetFormMode } from "./pet-form-mode";
import SubPageLayout from "@/components/SubPageLayout.vue";

const formMode = ref<"add" | "edit">("add");
const pet = ref(getPetById());
const title = computed(() => (formMode.value === "edit" ? "编辑宠物" : "添加宠物"));
const fields = computed(() => [
  { label: "名字", value: formMode.value === "edit" ? pet.value.name : "请输入宠物名字" },
  { label: "种类", value: formMode.value === "edit" ? pet.value.species : "请选择" },
  { label: "品种", value: formMode.value === "edit" ? pet.value.breed : "请选择" },
  { label: "性别", value: formMode.value === "edit" ? "妹妹" : "请选择" },
  { label: "生日", value: formMode.value === "edit" ? "2023年5月12日" : "请选择" },
  { label: "体重", value: formMode.value === "edit" ? "4.6kg" : "请输入" },
  { label: "绝育状态", value: formMode.value === "edit" ? "已绝育" : "请选择" },
  { label: "备注", value: formMode.value === "edit" ? "怕生，请轻声靠近" : "补充性格与照护习惯" },
]);

onLoad((query = {}) => {
  formMode.value = getPetFormMode(query);
  pet.value = getPetById(typeof query.id === "string" ? query.id : undefined);
});

function finish() {
  uni.navigateBack();
}
</script>

<template>
  <SubPageLayout :title="title">
    <view class="flex flex-col gap-card px-action py-card">
      <view class="flex flex-col items-center gap-sm">
        <image
          class="h-pet w-pet rounded-full bg-divider"
          :src="formMode === 'edit' ? pet.image : '/static/main/profile-cat.png'"
          mode="aspectFill"
        />
        <text class="text-caption text-brand leading-caption">更换头像</text>
        <text class="quiet-text">静态预览不支持上传</text>
      </view>

      <view class="overflow-hidden main-card">
        <view
          v-for="(field, index) in fields"
          :key="field.label"
          class="min-h-control flex items-center gap-action px-action py-copy"
          :class="index < fields.length - 1 ? 'border-b border-divider' : ''"
        >
          <text class="w-pet shrink-0 text-body text-muted leading-label">{{ field.label }}</text>
          <text class="min-w-0 flex-1 text-right text-body text-ink leading-body">
            {{ field.value }}
          </text>
        </view>
      </view>
    </view>

    <template #actions>
      <view
        class="h-button flex items-center justify-center rounded-control bg-brand"
        @click="finish"
      >
        <text class="text-button text-surface font-semibold leading-button">
          {{ formMode === "edit" ? "保存修改" : "完成添加" }}
        </text>
      </view>
    </template>
  </SubPageLayout>
</template>
