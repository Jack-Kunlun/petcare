<script setup lang="ts">
import { computed, ref } from "vue";
import SubPageLayout from "@/components/SubPageLayout.vue";

interface ReviewItem {
  id: string;
  label: string;
  title: string;
  content: string;
  action: string;
  mode?: "append" | "reply";
}

const activeTab = ref<"sent" | "received">("sent");
const reviewItems = computed<ReviewItem[]>(() =>
  activeTab.value === "sent"
    ? [
        {
          id: "feeding",
          label: "已发出",
          title: "上门喂养 · 咪咪",
          content: "照护者很细心，服务记录清晰。",
          action: "",
        },
        {
          id: "walking",
          label: "已发出",
          title: "遛狗陪护 · 旺财",
          content: "沟通及时，按约定完成服务。",
          action: "追加评论",
          mode: "append",
        },
      ]
    : [
        {
          id: "received-lin",
          label: "收到的",
          title: "来自小林的评价",
          content: "沟通顺畅，宠物状态说明完整。",
          action: "回复评价",
          mode: "reply",
        },
      ],
);

function openReviewAction(mode?: "append" | "reply"): void {
  if (!mode) {
    return;
  }

  uni.navigateTo({ url: `/pages-account/social/review-form?mode=${mode}` });
}
</script>

<template>
  <SubPageLayout title="我的评价">
    <view class="reviews">
      <view class="reviews__tabs" role="tablist" aria-label="评价类型">
        <button
          class="reviews__tab"
          :class="{ 'reviews__tab--active': activeTab === 'sent' }"
          :aria-selected="activeTab === 'sent'"
          role="tab"
          @click="activeTab = 'sent'"
        >
          已发出
          <view v-if="activeTab === 'sent'" class="reviews__indicator" />
        </button>
        <button
          class="reviews__tab"
          :class="{ 'reviews__tab--active': activeTab === 'received' }"
          :aria-selected="activeTab === 'received'"
          role="tab"
          @click="activeTab = 'received'"
        >
          收到的
          <view v-if="activeTab === 'received'" class="reviews__indicator" />
        </button>
      </view>

      <view class="reviews__list">
        <view v-for="item in reviewItems" :key="item.id" class="review-card">
          <text class="review-card__status">{{ item.label }}</text>
          <text class="review-card__title">{{ item.title }}</text>
          <view class="review-card__stars" aria-label="5星评价">★★★★★</view>
          <text class="review-card__content">{{ item.content }}</text>
          <button
            v-if="item.action"
            class="review-card__action"
            @click="openReviewAction(item.mode)"
          >
            {{ item.action }}
          </button>
        </view>
      </view>
    </view>
  </SubPageLayout>
</template>

<style scoped lang="scss">
.reviews {
  min-height: 100%;
  background: #f8fafc;

  &__tabs {
    display: flex;
    height: 44px;
    background: #fff;
  }

  &__tab {
    position: relative;
    display: flex;
    width: 50%;
    align-items: center;
    justify-content: center;
    padding: 0;
    border: 0;
    border-radius: 0;
    background: #fff;
    color: #667085;
    font-size: 14px;
    line-height: 21px;

    &::after {
      border: 0;
    }

    &--active {
      color: #2563eb;
      font-weight: 500;
    }
  }

  &__indicator {
    position: absolute;
    bottom: 1px;
    left: 50%;
    width: 24px;
    height: 2px;
    border-radius: 1px;
    background: #2563eb;
    transform: translateX(-50%);
  }

  &__list {
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding: 16px;
  }
}

.review-card {
  position: relative;
  display: flex;
  min-height: 148px;
  box-sizing: border-box;
  flex-direction: column;
  gap: 4px;
  padding: 14px 15px;
  border: 1px solid #f2f4f7;
  border-radius: 12px;
  background: #fff;

  &__status {
    color: #667085;
    font-size: 12px;
    line-height: 18px;
  }

  &__title {
    margin-top: 2px;
    color: #1f2937;
    font-size: 15px;
    font-weight: 500;
    line-height: 23px;
  }

  &__stars {
    color: #ff9800;
    font-size: 14px;
    font-weight: 500;
    letter-spacing: 0;
    line-height: 21px;
  }

  &__content {
    max-width: 235px;
    color: #667085;
    font-size: 13px;
    line-height: 20px;
  }

  &__action {
    position: absolute;
    right: 15px;
    bottom: 15px;
    display: flex;
    min-width: 72px;
    height: 44px;
    align-items: center;
    justify-content: center;
    padding: 0 12px;
    border: 0;
    border-radius: 999px;
    background: #f2f7ff;
    color: #3552c8;
    font-size: 12px;
    line-height: 18px;

    &::after {
      border: 0;
    }
  }
}
</style>
