<script setup lang="ts">
import { onShow } from "@dcloudio/uni-app";
import { BOUNTY_ERROR_CODE, BOUNTY_SERVICE_TYPE_LABELS } from "@petcare/shared-types";
import type { PublicBounty } from "@petcare/shared-types";
import { computed, ref } from "vue";
import { getPublicBounties } from "@/api/bounties";
import { getSafeRequestErrorMessage, MiniappApiError } from "@/api/request";
import MainTabLayout from "@/components/MainTabLayout.vue";
import PcButton from "@/components/PcButton.vue";
import PcStatePanel from "@/components/PcStatePanel.vue";
import { commercialServicesEnabled } from "@/config/features";
import { formatBountyAmount } from "@/domain/bounty-form";

type PageStatus = "loading" | "ready" | "error" | "unavailable";

const markerPositions = [
  { top: "17%", left: "17%" },
  { top: "28%", left: "62%" },
  { top: "46%", left: "37%" },
  { top: "55%", left: "76%" },
  { top: "70%", left: "23%" },
  { top: "79%", left: "59%" },
];
const bounties = ref<PublicBounty[]>([]);
const selectedBountyId = ref<string | null>(null);
const status = ref<PageStatus>(commercialServicesEnabled ? "loading" : "unavailable");
const loadError = ref("");
const zoom = ref(1);
const selectedBounty = computed(
  () => bounties.value.find((bounty) => bounty.id === selectedBountyId.value) ?? null,
);
const markerBounties = computed(() => bounties.value.slice(0, markerPositions.length));
const mapStyle = computed(() => ({ transform: `scale(${zoom.value})` }));

function formatTime(value: string): string {
  const date = new Date(value);

  return Number.isFinite(date.getTime())
    ? new Intl.DateTimeFormat("zh-CN", {
        month: "numeric",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }).format(date)
    : "时间待确认";
}

async function load(): Promise<void> {
  if (!commercialServicesEnabled) {
    status.value = "unavailable";

    return;
  }

  status.value = "loading";
  loadError.value = "";

  try {
    const response = await getPublicBounties({ page: 1, pageSize: 50 });

    bounties.value = response.list;
    selectedBountyId.value = response.list[0]?.id ?? null;
    status.value = "ready";
  } catch (error) {
    bounties.value = [];

    if (error instanceof MiniappApiError && error.code === BOUNTY_ERROR_CODE.FEATURE_DISABLED) {
      status.value = "unavailable";
    } else {
      status.value = "error";
      loadError.value = getSafeRequestErrorMessage(error, "公开悬赏读取失败，请重试。");
    }
  }
}

function moveSelection(offset: number): void {
  if (bounties.value.length === 0 || !selectedBountyId.value) {
    return;
  }

  const index = bounties.value.findIndex((bounty) => bounty.id === selectedBountyId.value);
  const next = (index + offset + bounties.value.length) % bounties.value.length;

  selectedBountyId.value = bounties.value[next]?.id ?? null;
}

function openList(): void {
  uni.navigateBack({
    delta: 1,
    fail: () => uni.redirectTo({ url: "/pages-bounty/index" }),
  });
}

function openDetail(): void {
  if (selectedBounty.value) {
    uni.navigateTo({
      url: `/pages-bounty/detail?bountyId=${encodeURIComponent(selectedBounty.value.id)}`,
    });
  }
}

function zoomBy(value: number): void {
  zoom.value = Math.min(1.15, Math.max(0.9, Number((zoom.value + value).toFixed(2))));
}

onShow(() => void load());
</script>

<template>
  <MainTabLayout active="bounty">
    <template #header>
      <view class="map-page__heading">
        <text class="page-heading">地图模式</text>
        <text class="quiet-text">位置示意 · 未提供真实坐标</text>
      </view>
    </template>

    <view class="map-page">
      <PcStatePanel
        v-if="status === 'unavailable'"
        status="unavailable"
        title="悬赏服务未开放"
        description="当前环境暂未开放悬赏服务。"
      />
      <PcStatePanel v-else-if="status === 'loading'" status="loading" title="公开悬赏加载中…" />
      <PcStatePanel
        v-else-if="status === 'error'"
        status="error"
        title="地图悬赏加载失败"
        :description="loadError || '请检查网络后重试。'"
        primary-label="重新加载"
        @primary="load"
      />
      <PcStatePanel
        v-else-if="bounties.length === 0"
        status="empty"
        title="暂无公开悬赏"
        description="有效悬赏出现后，可在这里查看公开服务信息。"
      />

      <template v-else>
        <view class="map-toolbar">
          <button class="map-toolbar__back" aria-label="返回悬赏列表" @click="openList">‹</button>
          <view class="map-toolbar__title">
            <text>公开悬赏</text>
            <text class="quiet-text">共 {{ bounties.length }} 条 · 位置示意</text>
          </view>
          <button class="map-toolbar__list" aria-label="切换到列表模式" @click="openList">
            列表
          </button>
        </view>

        <view class="map-canvas" aria-label="公开悬赏示意地图">
          <view class="map-canvas__world" :style="mapStyle">
            <view class="map-canvas__block map-canvas__block--one" />
            <view class="map-canvas__block map-canvas__block--two" />
            <view class="map-canvas__block map-canvas__block--three" />
            <view class="map-canvas__block map-canvas__block--four" />
            <view class="map-canvas__road map-canvas__road--vertical-one" />
            <view class="map-canvas__road map-canvas__road--vertical-two" />
            <view class="map-canvas__road map-canvas__road--horizontal-one" />
            <view class="map-canvas__road map-canvas__road--horizontal-two" />
            <button
              v-for="(bounty, index) in markerBounties"
              :key="bounty.id"
              class="map-marker"
              :class="selectedBountyId === bounty.id ? 'is-selected' : ''"
              :style="markerPositions[index]"
              :aria-label="`选择示意标记：${formatBountyAmount(bounty.amountCents)}，${BOUNTY_SERVICE_TYPE_LABELS[bounty.serviceType]}，${bounty.pet.name}`"
              @click="selectedBountyId = bounty.id"
            >
              {{ formatBountyAmount(bounty.amountCents) }}
            </button>
          </view>

          <view class="map-zoom-controls" aria-label="示意地图缩放">
            <button :disabled="zoom >= 1.15" aria-label="放大示意地图" @click="zoomBy(0.05)">
              ＋
            </button>
            <button :disabled="zoom <= 0.9" aria-label="缩小示意地图" @click="zoomBy(-0.05)">
              －
            </button>
            <button disabled aria-label="未提供当前地理位置">◎</button>
          </view>
        </view>

        <view class="map-disclaimer" role="note">
          标记只用于浏览公开悬赏，不代表宠物或服务地址的真实位置。服务地址会在主人确认服务者后开放。
        </view>

        <view v-if="selectedBounty" class="map-bounty-card main-card">
          <view class="map-bounty-card__pet">
            <image
              :src="selectedBounty.pet.coverImage || '/static/main/petcare-placeholder-light.svg'"
              mode="aspectFill"
              :aria-label="`${selectedBounty.pet.name}的照片`"
            />
            <view class="map-bounty-card__pet-copy">
              <text class="card-heading">
                {{ selectedBounty.pet.name
                }}<template v-if="selectedBounty.pet.breed">
                  · {{ selectedBounty.pet.breed }}</template
                >
              </text>
              <text class="meta-text">{{
                BOUNTY_SERVICE_TYPE_LABELS[selectedBounty.serviceType]
              }}</text>
              <text class="quiet-text">{{ formatTime(selectedBounty.serviceTime) }}</text>
            </view>
            <text class="map-bounty-card__count">
              {{ bounties.findIndex((bounty) => bounty.id === selectedBountyId) + 1 }}/{{
                bounties.length
              }}
            </text>
          </view>

          <view class="map-bounty-card__price">
            <text>{{ formatBountyAmount(selectedBounty.amountCents) }}</text>
            <text class="quiet-text">固定悬赏金额</text>
          </view>

          <view class="map-bounty-card__footer">
            <view class="map-bounty-card__owner">
              <text class="text-body text-ink">{{ selectedBounty.owner.nickname }}</text>
              <text class="quiet-text">公开发布</text>
            </view>
            <view class="map-bounty-card__arrows">
              <button
                :disabled="bounties.length < 2"
                aria-label="上一条悬赏"
                @click="moveSelection(-1)"
              >
                ‹
              </button>
              <button
                :disabled="bounties.length < 2"
                aria-label="下一条悬赏"
                @click="moveSelection(1)"
              >
                ›
              </button>
            </view>
          </view>

          <PcButton block size="action" @click="openDetail">查看悬赏详情</PcButton>
        </view>
      </template>
    </view>
  </MainTabLayout>
</template>

<style scoped lang="scss">
.map-page {
  padding: 0 16px 24px;

  &__heading {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
}

.map-toolbar {
  display: flex;
  min-height: 56px;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 0 10px;
  border-radius: 18px;
  background: #fff;
  box-shadow: 0 2px 8px rgba(16, 24, 40, 0.08);

  &__back,
  &__list {
    display: flex;
    min-width: 44px;
    height: 40px;
    align-items: center;
    justify-content: center;
    border: 0;
    background: transparent;
    color: #344054;
    font-size: 16px;
  }

  &__title {
    display: flex;
    flex: 1;
    flex-direction: column;
    align-items: center;
    gap: 1px;
    color: #1f2937;
    font-size: 16px;
    font-weight: 500;
  }

  &__list {
    color: #4a6cf7;
    font-size: 13px;
  }
}

.map-canvas {
  position: relative;
  overflow: hidden;
  height: 430px;
  margin-top: 12px;
  border-radius: 18px;
  background: #f8fafc;

  &__world {
    position: absolute;
    inset: -3%;
    transition: transform 160ms ease;
  }

  &__block {
    position: absolute;
    border-radius: 14px;
    background: #fff;

    &--one {
      top: 5%;
      left: 6%;
      width: 18%;
      height: 25%;
    }

    &--two {
      top: 11%;
      right: 20%;
      width: 20%;
      height: 28%;
      background: #eefbf7;
    }

    &--three {
      bottom: 16%;
      left: 31%;
      width: 20%;
      height: 26%;
    }

    &--four {
      right: 5%;
      bottom: 11%;
      width: 17%;
      height: 22%;
    }
  }

  &__road {
    position: absolute;
    background: #fff;

    &--vertical-one {
      top: 0;
      bottom: 0;
      left: 27%;
      width: 8px;
    }

    &--vertical-two {
      top: 0;
      bottom: 0;
      right: 29%;
      width: 8px;
    }

    &--horizontal-one {
      top: 34%;
      right: 0;
      left: 0;
      height: 8px;
    }

    &--horizontal-two {
      right: 0;
      bottom: 35%;
      left: 0;
      height: 8px;
    }
  }
}

.map-marker {
  position: absolute;
  min-width: 52px;
  height: 48px;
  padding: 0 10px;
  border: 1px solid #b26a00;
  border-radius: 999px;
  background: #fff8e8;
  color: #b26a00;
  font-size: 13px;
  line-height: 46px;
  transform: translate(-50%, -50%);

  &.is-selected {
    border-color: #4a6cf7;
    background: #4a6cf7;
    color: #fff;
  }
}

.map-zoom-controls {
  position: absolute;
  right: 12px;
  bottom: 14px;
  display: flex;
  flex-direction: column;
  gap: 6px;

  button {
    width: 42px;
    height: 42px;
    border: 1px solid #e3e8f2;
    border-radius: 12px;
    background: #fff;
    color: #667085;
    font-size: 18px;

    &:disabled {
      cursor: not-allowed;
      opacity: 0.48;
    }
  }
}

.map-disclaimer {
  margin: 10px 2px 12px;
  color: #667085;
  font-size: 12px;
  line-height: 18px;
}

.map-bounty-card {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 14px;
  border-radius: 18px;

  &__pet {
    display: flex;
    min-width: 0;
    align-items: center;
    gap: 10px;

    > image {
      width: 52px;
      height: 52px;
      flex: none;
      border-radius: 50%;
      background: #f2f4f7;
    }
  }

  &__pet-copy,
  &__owner {
    display: flex;
    min-width: 0;
    flex: 1;
    flex-direction: column;
    gap: 2px;
  }

  &__count {
    align-self: flex-start;
    color: #4a6cf7;
    font-size: 12px;
  }

  &__price {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 8px 12px;
    border-radius: 12px;
    background: #fff5df;
    color: #b26a00;
    font-size: 18px;
    font-weight: 600;
  }

  &__footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  &__arrows {
    display: flex;
    gap: 8px;

    button {
      width: 42px;
      height: 42px;
      border: 1px solid #e3e8f2;
      border-radius: 12px;
      background: #fff;
      color: #667085;
      font-size: 22px;

      &:disabled {
        cursor: not-allowed;
        opacity: 0.48;
      }
    }
  }
}
</style>
