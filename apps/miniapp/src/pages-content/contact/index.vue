<script setup lang="ts">
import SubPageLayout from "@/components/SubPageLayout.vue";
</script>

<template>
  <SubPageLayout title="联系客服">
    <view class="flex flex-col gap-copy px-action py-card">
      <view class="rounded-card from-brand to-brand-active bg-gradient-to-r p-card text-surface">
        <text class="text-page font-semibold leading-page">PetCare 客服</text>
        <text class="mt-sm block text-body leading-body">服务时间：工作日 09:00–20:00</text>
        <text class="mt-caption block text-caption leading-caption"
          >非服务时段可先整理订单号与问题说明</text
        >
      </view>

      <view class="main-card p-action">
        <text class="card-heading">电话客服</text>
        <text class="mt-copy block text-section text-brand font-semibold leading-section">
          400-888-6288
        </text>
        <view
          class="mt-action h-control flex items-center justify-center rounded-control bg-brand opacity-50"
          aria-disabled="true"
        >
          <text class="text-body text-surface font-medium leading-label">拨打电话</text>
        </view>
      </view>

      <view class="main-card p-action">
        <text class="card-heading">在线客服</text>
        <text class="mt-copy block meta-text">正式版本将支持在线提交订单问题和上传相关记录。</text>
        <view
          class="mt-action h-control flex items-center justify-center rounded-control bg-divider opacity-50"
          aria-disabled="true"
        >
          <text class="text-body text-muted font-medium leading-label">进入在线客服</text>
        </view>
      </view>

      <view class="main-card p-action">
        <text class="card-heading">电子邮箱</text>
        <text class="mt-copy block text-body text-brand leading-label" user-select>
          support@petcare.example
        </text>
      </view>

      <view class="rounded-card bg-warning-soft p-action">
        <text class="card-heading">反馈前请准备</text>
        <text class="mt-copy block meta-text"
          >订单编号、问题发生时间、照护记录截图和期望的处理方式。</text
        >
      </view>
    </view>
  </SubPageLayout>
</template>
