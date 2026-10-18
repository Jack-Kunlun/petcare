<script setup lang="ts">
import { computed, ref } from "vue";
import SubPageLayout from "@/components/SubPageLayout.vue";

type FavoriteKind = "文章" | "悬赏" | "服务" | "照护者";
interface FavoriteItem {
  id: string;
  kind: FavoriteKind;
  title: string;
  summary: string;
  meta: string;
  image: string;
  route?: string;
  favorite: boolean;
}

const tabs = ["全部", "文章", "悬赏", "服务", "保姆"] as const;
const activeTab = ref<(typeof tabs)[number]>("全部");
const favorites = ref<FavoriteItem[]>([
  {
    id: "article-care",
    kind: "文章",
    title: "猫咪日常护理指南",
    summary: "从梳毛到剪指甲，在家也能完成的基础护理。",
    meta: "健康 · 2,340 阅读 · 收藏于今天",
    image: "/static/social/tabby-care.webp",
    favorite: true,
  },
  {
    id: "bounty-feeding",
    kind: "悬赏",
    title: "咪咪 · 上门喂养",
    summary: "今天 18:00 · 静安区 · 1.2km",
    meta: "¥68 · 收藏于昨天",
    image: "/static/social/gray-cat.webp",
    favorite: true,
  },
  {
    id: "service-grooming",
    kind: "服务",
    title: "专业上门洗护",
    summary: "林可 · 4.9分 · 猫犬基础洗护",
    meta: "¥88起 · 收藏于3天前",
    image: "/static/social/golden-dog.webp",
    route: "/pages-account/discover/service",
    favorite: true,
  },
  {
    id: "caregiver-lin",
    kind: "照护者",
    title: "林可",
    summary: "照护者资料示例 · 3年照护经验",
    meta: "喂养陪护 · 4.9 · 收藏4天前",
    image: "/static/social/caregiver.webp",
    route: "/pages-account/discover/caregiver",
    favorite: true,
  },
  {
    id: "article-dog",
    kind: "文章",
    title: "新手养狗：幼犬喂养注意事项",
    summary: "从食量、频率到换粮，建立稳定饮食节奏。",
    meta: "喂养 · 1,856 阅读 · 收藏于5天前",
    image: "/static/social/pets-at-home.webp",
    favorite: true,
  },
  {
    id: "bounty-walking",
    kind: "悬赏",
    title: "旺财 · 遛狗陪护",
    summary: "明天 09:00 · 徐汇区 · 2.5km",
    meta: "¥45 · 收藏于一周前",
    image: "/static/social/ragdoll-cat.webp",
    favorite: true,
  },
]);

const visibleFavorites = computed(() =>
  activeTab.value === "全部"
    ? favorites.value.filter((item) => item.favorite)
    : favorites.value.filter(
        (item) =>
          item.favorite &&
          (activeTab.value === "保姆" ? item.kind === "照护者" : item.kind === activeTab.value),
      ),
);

function toggleFavorite(item: FavoriteItem): void {
  item.favorite = !item.favorite;
  uni.showToast({ title: "已更新本页收藏", icon: "none" });
}

function openFavorite(item: FavoriteItem): void {
  if (item.route) {
    uni.navigateTo({ url: item.route });

    return;
  }

  uni.showModal({
    title: item.title,
    content: `${item.summary}\n${item.meta}\n静态收藏示例，未关联真实订单或文章。`,
    showCancel: false,
    confirmText: "关闭",
  });
}
</script>

<template>
  <SubPageLayout title="我的收藏">
    <view class="favorites">
      <view class="favorites__tabs" role="tablist" aria-label="收藏类型">
        <button
          v-for="tab in tabs"
          :key="tab"
          class="favorites__tab"
          :class="{ 'favorites__tab--active': activeTab === tab }"
          :aria-selected="activeTab === tab"
          role="tab"
          @click="activeTab = tab"
        >
          {{ tab }}
          <view v-if="activeTab === tab" class="favorites__indicator" />
        </button>
      </view>

      <view class="favorites__list">
        <view v-for="item in visibleFavorites" :key="item.id" class="favorite-card">
          <view
            class="favorite-card__body"
            role="button"
            :aria-label="`打开${item.title}`"
            hover-class="opacity-80"
            @click="openFavorite(item)"
          >
            <image
              class="favorite-card__image"
              :class="{ 'favorite-card__image--round': item.kind === '照护者' }"
              :src="item.image"
              :alt="item.title"
              mode="aspectFill"
            />
            <view class="favorite-card__copy">
              <text class="favorite-card__tag">{{ item.kind }}</text>
              <text class="favorite-card__title">{{ item.title }}</text>
              <text class="favorite-card__summary">{{ item.summary }}</text>
              <text
                class="favorite-card__meta"
                :class="{
                  'favorite-card__meta--price': item.kind === '悬赏' || item.kind === '服务',
                }"
              >
                {{ item.meta }}
              </text>
            </view>
          </view>
          <button
            class="favorite-card__action"
            :aria-label="(item.favorite ? '取消收藏' : '收藏') + item.title"
            @click="toggleFavorite(item)"
          >
            <image
              class="favorite-card__bookmark"
              :class="{ 'favorite-card__bookmark--inactive': !item.favorite }"
              src="/static/social/bookmark-active.svg"
              mode="aspectFit"
              aria-hidden="true"
            />
          </button>
        </view>
        <view v-if="visibleFavorites.length === 0" class="favorites__empty">
          <text>暂无{{ activeTab }}收藏</text>
        </view>
      </view>
    </view>
  </SubPageLayout>
</template>

<style scoped lang="scss">
.favorites {
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
    flex: 1;
    align-items: center;
    justify-content: center;
    border: 0;
    border-radius: 0;
    background: #fff;
    color: #667085;
    font-size: 14px;
    line-height: 22px;

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
    padding: 16px 16px 24px;
  }

  &__empty {
    padding: 48px 16px;
    color: #667085;
    font-size: 14px;
    text-align: center;
  }
}

.favorite-card {
  display: flex;
  min-height: 140px;
  box-sizing: border-box;
  align-items: center;
  gap: 4px;
  padding: 12px;
  border: 1px solid #f2f4f7;
  border-radius: 12px;
  background: #fff;

  &__body {
    display: flex;
    min-width: 0;
    flex: 1;
    align-items: center;
    gap: 8px;
  }

  &__image {
    width: 72px;
    height: 72px;
    flex: 0 0 72px;
    border-radius: 8px;
    background: #f8fafc;

    &--round {
      border-radius: 50%;
    }
  }

  &__copy {
    display: flex;
    min-width: 0;
    flex: 1;
    flex-direction: column;
    gap: 3px;
  }

  &__tag {
    align-self: flex-start;
    padding: 1px 10px;
    border-radius: 10px;
    background: #eef2ff;
    color: #3552c8;
    font-size: 12px;
    line-height: 18px;
  }

  &__title {
    overflow: hidden;
    color: #1f2937;
    font-size: 16px;
    font-weight: 500;
    line-height: 22px;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  &__summary {
    overflow: hidden;
    color: #667085;
    font-size: 14px;
    line-height: 20px;
    text-overflow: ellipsis;
    white-space: normal;
  }

  &__meta {
    color: #667085;
    font-size: 12px;
    line-height: 18px;
    white-space: nowrap;

    &--price {
      color: #f6a623;
    }
  }

  &__action {
    display: flex;
    width: 44px;
    height: 44px;
    flex: 0 0 44px;
    align-items: center;
    justify-content: center;
    padding: 0;
    border: 0;
    border-radius: 50%;
    background: #fff;

    &::after {
      border: 0;
    }
  }

  &__bookmark {
    width: 20px;
    height: 20px;

    &--inactive {
      opacity: 0.35;
    }
  }
}
</style>
