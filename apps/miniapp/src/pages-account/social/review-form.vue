<script setup lang="ts">
import { onLoad } from "@dcloudio/uni-app";
import { computed, ref } from "vue";
import PcButton from "@/components/PcButton.vue";
import SubPageLayout from "@/components/SubPageLayout.vue";

type ReviewMode = "create" | "append" | "reply";

const mode = ref<ReviewMode>("create");
const rating = ref(5);
const content = ref("");
const images = ref<string[]>([]);
const draftNotice = ref("");
const title = computed(() => {
  if (mode.value === "append") {
    return "追加评论";
  }

  return mode.value === "reply" ? "回复评价" : "评价服务";
});
const ratingLabel = computed(
  () => ["", "非常不满意", "不满意", "一般", "满意", "非常满意"][rating.value],
);

onLoad((query) => {
  if (query?.mode === "append" || query?.mode === "reply") {
    mode.value = query.mode;
  }
});

function chooseImages(): void {
  if (images.value.length >= 9) {
    return;
  }

  uni.chooseImage({
    count: 9 - images.value.length,
    sizeType: ["compressed"],
    sourceType: ["album", "camera"],
    success: (result) => {
      images.value = [...images.value, ...result.tempFilePaths].slice(0, 9);
    },
  });
}

function removeImage(index: number): void {
  images.value.splice(index, 1);
}

function previewImage(current: string): void {
  uni.previewImage({ current, urls: images.value });
}

function keepDraft(): void {
  draftNotice.value = "本页草稿已暂存，尚未发布。";
  uni.showToast({ title: "未连接评价服务，草稿仅保留在本页", icon: "none" });
}
</script>

<template>
  <SubPageLayout :title="title">
    <view class="review-form">
      <template v-if="mode === 'create'">
        <view class="review-form__service">
          <view class="review-form__pet-avatar"><text>咪</text></view>
          <view class="review-form__service-copy">
            <text class="review-form__service-title">咪咪 · 上门喂养</text>
            <text class="review-form__service-detail">照护者：小林</text>
            <text class="review-form__service-date">8 月 14 日 14:00–16:00</text>
          </view>
        </view>

        <view class="review-form__section review-form__rating">
          <text class="review-form__section-title">服务评分</text>
          <view class="review-form__rating-stars" role="radiogroup" aria-label="服务评分">
            <button
              v-for="score in 5"
              :key="score"
              class="review-form__star"
              :class="{ 'review-form__star--muted': score > rating }"
              :aria-label="`${score} 星`"
              :aria-checked="rating === score"
              role="radio"
              @click="rating = score"
            >
              ★
            </button>
          </view>
          <text class="review-form__rating-label">{{ ratingLabel }}</text>
        </view>

        <view class="review-form__section">
          <text class="review-form__section-title">评价内容</text>
          <view class="review-form__textarea-wrap">
            <textarea
              v-model="content"
              class="review-form__textarea"
              :maxlength="500"
              placeholder="分享一下这次服务体验吧"
              aria-label="评价内容"
            />
            <text class="review-form__count">{{ content.length }} / 500</text>
          </view>
        </view>

        <view class="review-form__section">
          <text class="review-form__section-title">评价图片（可选）</text>
          <view class="review-form__upload-list">
            <button v-if="images.length < 9" class="review-form__upload" @click="chooseImages">
              <image src="/static/social/upload.svg" mode="aspectFit" aria-hidden="true" />
              <text class="review-form__upload-title">添加图片</text>
              <text class="review-form__upload-detail">支持多图上传</text>
            </button>
            <view v-for="(image, index) in images" :key="image" class="review-form__image-wrap">
              <image
                class="review-form__image"
                :src="image"
                mode="aspectFill"
                :aria-label="`预览第${index + 1}张评价图片`"
                @click="previewImage(image)"
              />
              <button
                class="review-form__remove-image"
                :aria-label="`移除第${index + 1}张评价图片`"
                @click="removeImage(index)"
              >
                ×
              </button>
            </view>
          </view>
        </view>
        <text v-if="draftNotice" class="review-form__notice" role="status">{{ draftNotice }}</text>
      </template>

      <template v-else-if="mode === 'append'">
        <view class="review-form__single-tab">订单评价</view>
        <view class="review-form__review-card">
          <text class="review-form__review-state">已发出</text>
          <text class="review-form__review-title">上门喂养 · 咪咪</text>
          <text class="review-form__review-stars">★★★★★</text>
          <text class="review-form__review-content">原评价：照护者很细心，服务记录清晰。</text>
        </view>
        <textarea
          v-model="content"
          class="review-form__append-textarea"
          :maxlength="500"
          placeholder="补充本次服务体验…"
          aria-label="追加评论内容"
        />
        <text v-if="draftNotice" class="review-form__notice" role="status">{{ draftNotice }}</text>
      </template>

      <template v-else>
        <view class="review-form__single-tab">收到的</view>
        <view class="review-form__review-card">
          <text class="review-form__review-state">收到的</text>
          <text class="review-form__review-title">来自小林的评价</text>
          <text class="review-form__review-stars">★★★★★</text>
          <text class="review-form__review-content">沟通顺畅，宠物状态说明完整。</text>
        </view>
        <view class="review-form__reply">
          <text class="review-form__reply-heading">我的回复</text>
          <text class="review-form__reply-text">谢谢认可，期待再次为咪咪服务。</text>
        </view>
      </template>
    </view>

    <template v-if="mode !== 'reply'" #actions>
      <PcButton block size="action" @click="keepDraft">
        {{ mode === "append" ? "提交追加评论" : "提交评价" }}
      </PcButton>
    </template>
  </SubPageLayout>
</template>

<style scoped lang="scss">
.review-form {
  display: flex;
  min-height: 100%;
  flex-direction: column;
  gap: 16px;
  box-sizing: border-box;
  padding: 16px;
  background: #f8fafc;

  &__service {
    display: flex;
    min-height: 112px;
    box-sizing: border-box;
    align-items: center;
    gap: 12px;
    padding: 16px;
    border: 1px solid #e6eaf0;
    border-radius: 16px;
    background: #fff;
  }

  &__pet-avatar {
    display: flex;
    width: 56px;
    height: 56px;
    flex: 0 0 56px;
    align-items: center;
    justify-content: center;
    border-radius: 50%;
    background: #ecfbf8;
    color: #1f2937;
    font-size: 18px;
  }

  &__service-copy {
    display: flex;
    min-width: 0;
    flex-direction: column;
    gap: 2px;
  }

  &__service-title {
    color: #1f2937;
    font-size: 16px;
    font-weight: 500;
    line-height: 24px;
  }

  &__service-detail,
  &__service-date {
    color: #667085;
    font-size: 13px;
    line-height: 20px;
  }

  &__section {
    display: flex;
    flex-direction: column;
    gap: 8px;
    background: #fff;
  }

  &__section-title {
    color: #1f2937;
    font-size: 16px;
    font-weight: 500;
    line-height: 24px;
  }

  &__rating-stars {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  &__star {
    width: 28px;
    height: 40px;
    padding: 0;
    border: 0;
    background: transparent;
    color: #b26a00;
    font-size: 28px;
    line-height: 40px;

    &::after {
      border: 0;
    }

    &--muted {
      color: #d0d5dd;
    }
  }

  &__rating-label {
    color: #667085;
    font-size: 14px;
    line-height: 22px;
  }

  &__textarea-wrap {
    position: relative;
    height: 120px;
    border: 1px solid #e6eaf0;
    border-radius: 12px;
    background: #fff;
  }

  &__textarea {
    display: block;
    width: 100%;
    height: 100%;
    box-sizing: border-box;
    padding: 14px;
    color: #1f2937;
    font-size: 14px;
    line-height: 22px;
  }

  &__count {
    position: absolute;
    right: 14px;
    bottom: 10px;
    color: #667085;
    font-size: 12px;
    line-height: 18px;
  }

  &__upload-list {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }

  &__upload {
    display: flex;
    width: 166px;
    height: 120px;
    flex: 0 0 166px;
    flex-direction: column;
    align-items: center;
    justify-content: flex-start;
    padding: 15px 0 0;
    border: 1px dashed #e6eaf0;
    border-radius: 12px;
    background: #f8fafc;

    &::after {
      border: 0;
    }

    image {
      width: 44px;
      height: 44px;
    }
  }

  &__upload-title {
    margin-top: 8px;
    color: #1f2937;
    font-size: 14px;
    line-height: 22px;
  }

  &__upload-detail {
    color: #667085;
    font-size: 12px;
    line-height: 18px;
  }

  &__image-wrap {
    position: relative;
    width: 80px;
    height: 80px;
  }

  &__image {
    width: 80px;
    height: 80px;
    border-radius: 8px;
  }

  &__remove-image {
    position: absolute;
    top: -5px;
    right: -5px;
    width: 24px;
    height: 24px;
    padding: 0;
    border-radius: 50%;
    background: #1f2937;
    color: #fff;
    line-height: 24px;

    &::after {
      border: 0;
    }
  }

  &__notice {
    color: #667085;
    font-size: 12px;
    line-height: 18px;
  }

  &__single-tab {
    display: flex;
    height: 44px;
    align-items: center;
    justify-content: center;
    margin: -16px -16px 0;
    border-bottom: 2px solid #2563eb;
    background: #fff;
    color: #2563eb;
    font-size: 14px;
  }

  &__review-card {
    position: relative;
    display: flex;
    min-height: 148px;
    flex-direction: column;
    gap: 4px;
    padding: 14px 15px;
    border: 1px solid #f2f4f7;
    border-radius: 12px;
    background: #fff;
  }

  &__review-state {
    color: #667085;
    font-size: 12px;
    line-height: 18px;
  }

  &__review-title {
    margin-top: 2px;
    color: #1f2937;
    font-size: 15px;
    font-weight: 500;
    line-height: 23px;
  }

  &__review-stars {
    color: #ff9800;
    font-size: 14px;
    line-height: 21px;
  }

  &__review-content {
    color: #667085;
    font-size: 13px;
    line-height: 20px;
  }

  &__append-textarea {
    height: 140px;
    box-sizing: border-box;
    padding: 14px;
    border: 1px solid #f2f4f7;
    border-radius: 12px;
    background: #fff;
    color: #1f2937;
    font-size: 14px;
    line-height: 22px;
  }

  &__reply {
    display: flex;
    min-height: 96px;
    flex-direction: column;
    gap: 8px;
    box-sizing: border-box;
    padding: 14px 16px;
    border-radius: 12px;
    background: #eef2ff;
  }

  &__reply-heading {
    color: #3552c8;
    font-size: 13px;
    font-weight: 500;
    line-height: 20px;
  }

  &__reply-text {
    color: #1f2937;
    font-size: 14px;
    line-height: 21px;
  }
}
</style>
