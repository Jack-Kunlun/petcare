<script setup lang="ts">
import { computed, ref } from "vue";
import PcButton from "@/components/PcButton.vue";
import SubPageLayout from "@/components/SubPageLayout.vue";

type DiscoverVariant = "service" | "caregiver" | "store" | "creator";
interface DetailSection {
  title: string;
  tags?: string[];
  items: string[];
}

const props = defineProps<{ variant: DiscoverVariant }>();
const profiles: Record<
  DiscoverVariant,
  {
    title: string;
    tag: string;
    name: string;
    detail: string;
    description: string;
    image: string;
    stats: [string, string][];
    sections: DetailSection[];
    headerAction: string;
    footerPrimary: string;
    footerSecondary?: string;
  }
> = {
  service: {
    title: "服务详情",
    tag: "上门服务",
    name: "专业上门洗护",
    detail: "林可 · 4.9 分 · 已服务 328 单",
    description: "为猫犬提供基础洗护、梳毛与清洁记录，服务过程可追踪。",
    image: "/static/social/golden-dog.webp",
    stats: [
      ["¥88 起", "价格"],
      ["60–90 分", "时长"],
      ["10 分钟", "响应"],
    ],
    sections: [
      {
        title: "服务内容",
        tags: ["猫犬适用", "用品消毒"],
        items: ["基础清洁与毛发梳理", "耳部、足部与指甲护理", "完成后上传服务记录与照片"],
      },
      {
        title: "服务流程",
        items: ["1. 选择宠物、地址与时间", "2. 照护者确认后上门服务", "3. 查看记录并完成评价"],
      },
      {
        title: "服务保障",
        items: ["平台资料待核验与服务留痕", "异常情况支持平台协助处理"],
      },
      {
        title: "照护者",
        items: ["林可 · 3 年照护经验", "擅长猫咪洗护与敏感宠物安抚"],
      },
      {
        title: "评价摘要",
        items: ["4.9 / 5 · 286 条评价", "“沟通细致，服务记录很完整。”"],
      },
    ],
    headerAction: "已收藏",
    footerPrimary: "联系照护者",
  },
  caregiver: {
    title: "照护者详情",
    tag: "已关注",
    name: "林可",
    detail: "资料待核验 · 3 年经验 · 静安区",
    description: "专注猫咪与小型犬上门照护，支持喂养、陪伴、基础护理与过程记录。",
    image: "/static/social/caregiver.webp",
    stats: [
      ["4.9", "评分"],
      ["328 单", "服务"],
      ["86%", "复购"],
    ],
    sections: [
      {
        title: "照护能力",
        tags: ["资料待核验", "技能信息"],
        items: ["猫咪照护、上门喂养、基础洗护", "可照护幼宠、老年宠与需要定时用药的宠物"],
      },
      {
        title: "可预约服务",
        items: ["上门喂养 · ¥55 起", "专业洗护 · ¥88 起", "陪伴式遛狗 · ¥45 起"],
      },
      {
        title: "信任与保障",
        items: ["真实资格以平台审核结果为准", "服务过程记录、异常上报与平台协助"],
      },
      {
        title: "评价摘要",
        items: ["4.9 / 5 · 286 条评价", "“很有耐心，咪咪第二次就主动靠近了。”"],
      },
    ],
    headerAction: "收藏",
    footerPrimary: "查看服务",
    footerSecondary: "发消息",
  },
  store: {
    title: "门店详情",
    tag: "平台门店",
    name: "爱宠生活馆",
    detail: "静安区 · 营业中 · 09:00–21:00",
    description: "社区宠物护理门店，提供基础洗护、健康护理与到店咨询。",
    image: "/static/social/tabby-care.webp",
    stats: [
      ["4.8", "评分"],
      ["12 项", "服务"],
      ["1.2 km", "距离"],
    ],
    sections: [
      {
        title: "地址与营业",
        items: [
          "静安区愚园路 218 号",
          "营业时间 09:00–21:00",
          "联系电话 021-6888 1024",
          "地图定位：愚园路社区服务点",
        ],
      },
      {
        title: "服务项目",
        tags: ["可预约", "到店服务"],
        items: ["基础洗护与毛发护理", "指甲、耳部与足部清洁", "宠物日常护理咨询"],
      },
      {
        title: "门店介绍",
        items: ["配备独立清洁区与等候区", "服务用品按次消毒，过程记录可查询"],
      },
      {
        title: "评价摘要",
        items: ["4.8 / 5 · 412 条评价", "“环境整洁，工作人员沟通很清楚。”"],
      },
    ],
    headerAction: "已关注",
    footerPrimary: "查看服务",
    footerSecondary: "联系门店",
  },
  creator: {
    title: "创作者主页",
    tag: "创作者",
    name: "萌宠观察局",
    detail: "养宠知识 · 日常记录",
    description: "分享科学养宠、护理经验与真实陪伴故事。",
    image: "/static/social/gray-cat.webp",
    stats: [
      ["12.8k", "粉丝"],
      ["186", "内容"],
      ["35.6k", "互动"],
    ],
    sections: [
      {
        title: "内容主题",
        tags: ["健康护理", "新手养宠", "陪伴记录"],
        items: ["猫咪健康与日常护理", "新手养宠避坑与用品选择"],
      },
    ],
    headerAction: "已关注",
    footerPrimary: "已关注",
  },
};

const profile = computed(() => profiles[props.variant]);
const isFavorite = ref(props.variant === "service");
const isFollowing = ref(true);
const headerAction = computed(() => {
  if (props.variant === "service" || props.variant === "caregiver") {
    return isFavorite.value ? "已收藏" : "收藏";
  }

  return isFollowing.value ? "已关注" : "关注";
});
const footerPrimary = computed(() => {
  if (props.variant === "creator") {
    return isFollowing.value ? "已关注" : "关注";
  }

  return profile.value.footerPrimary;
});
const representativeContent = [
  ["猫咪换季掉毛护理清单", "图文 · 2.3k 阅读 · 186 赞"],
  ["新手如何建立稳定喂养节奏", "视频 · 18.6k 播放 · 1.2k 赞"],
  ["宠物应激时的安抚步骤", "图文 · 4.8k 阅读 · 432 收藏"],
];

function toggleHeaderAction(): void {
  if (props.variant === "service" || props.variant === "caregiver") {
    isFavorite.value = !isFavorite.value;
  } else {
    isFollowing.value = !isFollowing.value;
  }

  uni.showToast({ title: "仅本地预览，未提交服务端", icon: "none" });
}

function toggleCreatorFollow(): void {
  isFollowing.value = !isFollowing.value;
  uni.showToast({ title: "仅本地预览，未提交关注状态", icon: "none" });
}

function handleSecondaryAction(): void {
  uni.navigateTo({ url: "/pages-content/chat/index?mode=service" });
}

function handlePrimaryAction(): void {
  if (props.variant === "creator") {
    toggleCreatorFollow();

    return;
  }

  if (props.variant === "service") {
    handleSecondaryAction();

    return;
  }

  uni.navigateTo({ url: "/pages-account/discover/service" });
}

function openContent(item: string[]): void {
  uni.showModal({
    title: item[0],
    content: `${item[1]}\n创作者内容示例，尚未关联公开文章。`,
    showCancel: false,
    confirmText: "关闭",
  });
}
</script>

<template>
  <SubPageLayout :title="profile.title">
    <view class="px-action pt-copy text-caption text-muted"
      >示例资料，不代表真实资格或可预约服务</view
    >
    <template #header-right>
      <button class="discover-detail__header-action" @click="toggleHeaderAction">
        {{ headerAction }}
      </button>
    </template>

    <view class="discover-detail">
      <view class="discover-detail__content">
        <view class="discover-card discover-detail__hero">
          <view class="discover-detail__hero-top">
            <image
              class="discover-detail__image"
              :class="{ 'discover-detail__image--round': variant === 'caregiver' }"
              :src="profile.image"
              :alt="profile.name"
              mode="aspectFill"
            />
            <view class="discover-detail__identity">
              <text class="discover-detail__tag">{{ profile.tag }}</text>
              <text class="discover-detail__name">{{ profile.name }}</text>
              <text class="discover-detail__meta">{{ profile.detail }}</text>
            </view>
          </view>
          <text class="discover-detail__description">{{ profile.description }}</text>
          <view class="discover-detail__stats">
            <view v-for="stat in profile.stats" :key="stat[1]" class="discover-detail__stat">
              <text class="discover-detail__stat-value">{{ stat[0] }}</text>
              <text class="discover-detail__stat-label">{{ stat[1] }}</text>
            </view>
          </view>
        </view>

        <view
          v-for="section in profile.sections"
          :key="section.title"
          class="discover-card discover-detail__section"
        >
          <text class="discover-detail__section-title">{{ section.title }}</text>
          <view v-if="section.tags" class="discover-detail__tags">
            <text v-for="tag in section.tags" :key="tag" class="discover-detail__tag">
              {{ tag }}
            </text>
          </view>
          <text v-for="item in section.items" :key="item" class="discover-detail__section-item">
            {{ item }}
          </text>
        </view>

        <template v-if="variant === 'creator'">
          <text class="discover-detail__section-title">代表内容</text>
          <view
            v-for="item in representativeContent"
            :key="item[0]"
            class="discover-card discover-detail__content-card"
            role="button"
            :aria-label="`预览${item[0]}`"
            hover-class="opacity-80"
            @click="openContent(item)"
          >
            <view class="discover-detail__thumbnail" />
            <view class="discover-detail__content-copy">
              <text class="discover-detail__content-title">{{ item[0] }}</text>
              <text class="discover-detail__content-meta">{{ item[1] }}</text>
            </view>
          </view>
        </template>
      </view>
    </view>

    <template #actions>
      <view class="discover-detail__actions">
        <PcButton
          v-if="profile.footerSecondary"
          class="discover-detail__secondary"
          block
          variant="secondary"
          @click="handleSecondaryAction"
        >
          {{ profile.footerSecondary }}
        </PcButton>
        <PcButton class="discover-detail__primary" block size="action" @click="handlePrimaryAction">
          {{ footerPrimary }}
        </PcButton>
      </view>
    </template>
  </SubPageLayout>
</template>

<style scoped lang="scss">
.discover-detail {
  min-height: 100%;
  background: #f8fafc;

  &__header-action {
    min-width: 44px;
    height: 44px;
    padding: 0;
    border: 0;
    background: transparent;
    color: #2563eb;
    font-size: 14px;
    font-weight: 500;

    &::after {
      border: 0;
    }
  }

  &__content {
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding: 16px 16px 24px;
  }

  &__hero {
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding: 16px;
  }

  &__hero-top {
    display: flex;
    min-height: 100px;
    align-items: center;
    gap: 12px;
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

  &__identity {
    display: flex;
    min-width: 0;
    flex: 1;
    flex-direction: column;
    gap: 4px;
  }

  &__tag {
    align-self: flex-start;
    padding: 2px 10px;
    border-radius: 10px;
    background: #eef2ff;
    color: #3552c8;
    font-size: 12px;
    line-height: 18px;
  }

  &__name {
    overflow: hidden;
    color: #202632;
    font-size: 18px;
    font-weight: 500;
    line-height: 26px;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  &__meta {
    color: #667085;
    font-size: 14px;
    line-height: 22px;
  }

  &__description {
    color: #667085;
    font-size: 14px;
    line-height: 22px;
  }

  &__stats {
    display: flex;
    min-height: 100px;
    align-items: flex-start;
    justify-content: space-between;
    padding: 12px 6px;
    border-radius: 10px;
    background: #eef2ff;
  }

  &__stat {
    display: flex;
    min-width: 0;
    flex: 1;
    flex-direction: column;
    align-items: center;
    gap: 2px;
    text-align: center;
  }

  &__stat-value {
    color: #202632;
    font-size: 16px;
    font-weight: 500;
    line-height: 24px;
  }

  &__stat-label {
    color: #667085;
    font-size: 12px;
    line-height: 18px;
  }

  &__section {
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding: 16px;
  }

  &__section-title {
    color: #202632;
    font-size: 16px;
    font-weight: 500;
    line-height: 24px;
  }

  &__tags {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }

  &__tags .discover-detail__tag {
    padding: 2px 8px;
  }

  &__section-item {
    color: #667085;
    font-size: 14px;
    line-height: 22px;
  }

  &__content-card {
    display: flex;
    min-height: 100px;
    align-items: center;
    gap: 12px;
    padding: 12px;
  }

  &__thumbnail {
    width: 72px;
    height: 72px;
    flex: 0 0 72px;
    border-radius: 8px;
    background: #eef2ff;
  }

  &__content-copy {
    display: flex;
    min-width: 0;
    flex: 1;
    flex-direction: column;
    gap: 4px;
  }

  &__content-title {
    overflow: hidden;
    color: #202632;
    font-size: 16px;
    font-weight: 500;
    line-height: 24px;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  &__content-meta {
    color: #667085;
    font-size: 12px;
    line-height: 18px;
  }

  &__actions {
    display: flex;
    gap: 12px;
    width: 100%;
  }

  &__secondary {
    width: 104px;
  }

  &__primary {
    min-width: 0;
    flex: 1;
  }
}

.discover-card {
  border: 1px solid #f2f4f7;
  border-radius: 12px;
  background: #fff;
}
</style>
