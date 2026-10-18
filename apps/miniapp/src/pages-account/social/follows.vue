<script setup lang="ts">
import { computed, ref } from "vue";
import SubPageLayout from "@/components/SubPageLayout.vue";

type FollowKind = "照护者" | "门店" | "创作者";
interface FollowItem {
  id: string;
  kind: FollowKind;
  name: string;
  detail: string;
  initial: string;
  route: string;
  followed: boolean;
  hiddenFromAll?: boolean;
}

const tabs = ["全部", "照护者", "门店", "创作者"] as const;
const activeTab = ref<(typeof tabs)[number]>("全部");
const items = ref<FollowItem[]>([
  {
    id: "lin",
    kind: "照护者",
    name: "小林",
    detail: "照护者 · 4.9 分",
    initial: "小",
    route: "/pages-account/discover/caregiver",
    followed: true,
  },
  {
    id: "jie",
    kind: "照护者",
    name: "阿杰",
    detail: "照护者 · 4.8 分",
    initial: "阿",
    route: "/pages-account/discover/caregiver",
    followed: true,
    hiddenFromAll: true,
  },
  {
    id: "love-pet",
    kind: "门店",
    name: "爱宠生活馆",
    detail: "门店 · 静安区",
    initial: "爱",
    route: "/pages-account/discover/store",
    followed: true,
  },
  {
    id: "pet-observer",
    kind: "创作者",
    name: "萌宠观察局",
    detail: "创作者 · 2.4w 关注",
    initial: "萌",
    route: "/pages-account/discover/creator",
    followed: true,
  },
  {
    id: "petjoy",
    kind: "门店",
    name: "PetJoy",
    detail: "门店 · 徐汇区",
    initial: "P",
    route: "/pages-account/discover/store",
    followed: true,
    hiddenFromAll: true,
  },
  {
    id: "abu",
    kind: "创作者",
    name: "阿布的家",
    detail: "创作者 · 8.6k 关注",
    initial: "阿",
    route: "/pages-account/discover/creator",
    followed: true,
    hiddenFromAll: true,
  },
]);

const visibleItems = computed(() =>
  items.value.filter((item) => {
    if (activeTab.value === "全部") {
      return !item.hiddenFromAll;
    }

    return item.kind === activeTab.value;
  }),
);

function toggleFollow(item: FollowItem): void {
  item.followed = !item.followed;
  uni.showToast({ title: "仅本地预览，未提交关注状态", icon: "none" });
}

function openProfile(item: FollowItem): void {
  uni.navigateTo({ url: item.route });
}
</script>

<template>
  <SubPageLayout title="我的关注">
    <view class="follows">
      <view class="follows__tabs" role="tablist" aria-label="关注类型">
        <button
          v-for="tab in tabs"
          :key="tab"
          class="follows__tab"
          :class="{ 'follows__tab--active': activeTab === tab }"
          :aria-selected="activeTab === tab"
          role="tab"
          @click="activeTab = tab"
        >
          {{ tab }}
          <view v-if="activeTab === tab" class="follows__indicator" />
        </button>
      </view>

      <view class="follows__list">
        <view v-for="item in visibleItems" :key="item.id" class="follow-card">
          <view
            class="follow-card__identity"
            role="button"
            :aria-label="`查看${item.name}主页`"
            hover-class="opacity-80"
            @click="openProfile(item)"
          >
            <view class="follow-card__avatar">
              <text>{{ item.initial }}</text>
            </view>
            <view class="follow-card__copy">
              <text class="follow-card__name">{{ item.name }}</text>
              <text class="follow-card__detail">{{ item.detail }}</text>
            </view>
          </view>
          <button
            class="follow-card__action"
            :class="{ 'follow-card__action--following': item.followed }"
            :aria-label="(item.followed ? '取消关注' : '关注') + item.name"
            @click="toggleFollow(item)"
          >
            {{ item.followed ? "已关注" : "关注" }}
          </button>
        </view>
        <view v-if="visibleItems.length === 0" class="follows__empty">
          <text>暂无{{ activeTab }}关注</text>
        </view>
      </view>
    </view>
  </SubPageLayout>
</template>

<style scoped lang="scss">
.follows {
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

  &__empty {
    padding: 48px 16px;
    color: #667085;
    font-size: 14px;
    text-align: center;
  }
}

.follow-card {
  display: flex;
  min-height: 104px;
  box-sizing: border-box;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 15px;
  border: 1px solid #f2f4f7;
  border-radius: 12px;
  background: #fff;

  &__identity {
    display: flex;
    min-width: 0;
    flex: 1;
    align-items: center;
    gap: 12px;
  }

  &__avatar {
    display: flex;
    width: 56px;
    height: 56px;
    flex: 0 0 56px;
    align-items: center;
    justify-content: center;
    border-radius: 50%;
    background: #ecfbf8;
    color: #3552c8;
    font-size: 16px;
    font-weight: 500;
  }

  &__copy {
    display: flex;
    min-width: 0;
    flex-direction: column;
    gap: 5px;
  }

  &__name {
    overflow: hidden;
    color: #1f2937;
    font-size: 16px;
    font-weight: 500;
    line-height: 24px;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  &__detail {
    overflow: hidden;
    color: #667085;
    font-size: 13px;
    line-height: 20px;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  &__action {
    display: flex;
    min-width: 64px;
    height: 44px;
    flex: 0 0 auto;
    align-items: center;
    justify-content: center;
    padding: 0 10px;
    border: 0;
    border-radius: 999px;
    background: #2563eb;
    color: #fff;
    font-size: 12px;

    &::after {
      border: 0;
    }

    &--following {
      background: #f8fafc;
      color: #667085;
    }
  }
}
</style>
