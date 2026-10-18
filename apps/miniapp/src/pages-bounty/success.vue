<script setup lang="ts">
import { onLoad } from "@dcloudio/uni-app";
import { ref } from "vue";
import PcButton from "@/components/PcButton.vue";
import SubPageLayout from "@/components/SubPageLayout.vue";

const bountyId = ref("");

function openMyBounties(): void {
  uni.redirectTo({ url: "/pages-bounty/index?tab=mine" });
}

function openHome(): void {
  uni.redirectTo({ url: "/pages/index/index" });
}

onLoad((query = {}) => {
  bountyId.value = typeof query.bountyId === "string" ? query.bountyId : "";
});
</script>

<template>
  <SubPageLayout title="发布成功">
    <view class="bounty-success">
      <view class="bounty-success__check" aria-hidden="true">✓</view>
      <text class="bounty-success__title">悬赏已发布</text>
      <text class="bounty-success__description">
        公开服务者可以查看需求并提交接单意向。服务进度会在订单详情中显示。
      </text>

      <view v-if="bountyId" class="bounty-success__reference" role="status">
        <text class="quiet-text">悬赏编号</text>
        <text class="text-body text-ink">{{ bountyId }}</text>
      </view>

      <view class="bounty-success__actions">
        <PcButton block size="action" @click="openMyBounties">查看我的悬赏</PcButton>
        <PcButton block variant="secondary" @click="openHome">返回首页</PcButton>
      </view>
    </view>
  </SubPageLayout>
</template>

<style scoped lang="scss">
.bounty-success {
  box-sizing: border-box;
  display: flex;
  min-height: 100%;
  flex-direction: column;
  align-items: center;
  padding: 32px 18px 24px;

  &__check {
    display: flex;
    width: 96px;
    height: 96px;
    align-items: center;
    justify-content: center;
    border: 2px solid #4bcdb2;
    border-radius: 50%;
    background: #eefbf7;
    color: #1f2937;
    font-size: 34px;
  }

  &__title {
    margin-top: 22px;
    color: #1f2937;
    font-size: 24px;
    font-weight: 600;
    line-height: 32px;
  }

  &__description {
    margin-top: 8px;
    color: #667085;
    font-size: 14px;
    line-height: 22px;
    text-align: center;
  }

  &__reference {
    display: flex;
    width: 100%;
    flex-direction: column;
    gap: 6px;
    margin-top: 28px;
    padding: 16px;
    border: 1px solid #eaecf0;
    border-radius: 16px;
    background: #fff;
    overflow-wrap: anywhere;
  }

  &__actions {
    display: flex;
    width: 100%;
    flex-direction: column;
    gap: 12px;
    margin-top: 24px;
  }
}
</style>
