<script setup lang="ts">
import { BOUNTY_SOP_LIMITS, BOUNTY_STATUS_LABELS } from "@petcare/shared-types";
import type { BountySop, BountySopStep } from "@petcare/shared-types";
import PcButton from "@/components/PcButton.vue";

type SopPanelStatus = "idle" | "loading" | "ready" | "error";

const props = defineProps<{
  status: SopPanelStatus;
  sop?: BountySop;
  readOnly: boolean;
  busyKey?: string | null;
  uploadProgress?: number | null;
}>();

const emit = defineEmits<{
  load: [];
  photo: [stepNumber: number];
  video: [stepNumber: number];
  complete: [stepNumber: number];
}>();

function isCurrent(step: BountySopStep): boolean {
  return props.sop?.currentStepNumber === step.stepNumber;
}

function requirementsMet(step: BountySopStep): boolean {
  return (
    step.photos.length >= step.minimumPhotoCount && (!step.videoRequired || step.videos.length > 0)
  );
}

function stepBusy(step: BountySopStep): boolean {
  return Boolean(props.busyKey?.startsWith(`${step.stepNumber}:`));
}

function stepState(step: BountySopStep): string {
  if (step.completedAt) {
    return "已完成";
  }

  return isCurrent(step) ? "当前步骤" : "待执行";
}
</script>

<template>
  <view class="mt-sm border-t border-divider pt-copy">
    <PcButton
      v-if="status === 'idle'"
      block
      variant="secondary"
      aria-label="查看履约记录"
      @click="emit('load')"
    >
      查看履约记录
    </PcButton>

    <view v-else-if="status === 'loading'" class="py-copy text-center" role="status">
      <text class="meta-text">履约记录加载中…</text>
    </view>

    <view v-else-if="status === 'error'" class="flex flex-col gap-sm" role="alert">
      <text class="text-center text-small text-danger">履约记录加载失败</text>
      <PcButton block variant="secondary" @click="emit('load')">重试</PcButton>
    </view>

    <view v-else-if="sop" class="flex flex-col gap-copy">
      <view class="flex items-center justify-between gap-copy">
        <text class="card-heading">履约记录</text>
        <text class="quiet-text">{{ BOUNTY_STATUS_LABELS[sop.orderStatus] }}</text>
      </view>

      <view
        v-if="!readOnly && !sop.canExecute && sop.currentStepNumber !== null"
        class="rounded-control bg-danger-soft p-copy"
        role="status"
      >
        <text class="text-small text-danger leading-body">当前资格或订单状态不允许继续履约</text>
      </view>

      <view
        v-for="step in sop.steps"
        :key="step.stepNumber"
        class="flex flex-col gap-sm border rounded-control p-copy"
        :class="isCurrent(step) ? 'border-brand bg-soft' : 'border-border bg-surface'"
      >
        <view class="flex items-start justify-between gap-copy">
          <view class="min-w-0 flex flex-1 flex-col gap-caption">
            <text class="text-body text-ink font-medium leading-body">
              {{ step.stepNumber }}. {{ step.stepName }}
            </text>
            <text class="quiet-text">预计 {{ step.expectedDurationMinutes }} 分钟</text>
          </view>
          <text class="shrink-0 text-small" :class="isCurrent(step) ? 'text-brand' : 'text-muted'">
            {{ stepState(step) }}
          </text>
        </view>

        <text class="meta-text">{{ step.instruction }}</text>
        <text class="quiet-text">
          照片 {{ step.photos.length }}/{{ step.minimumPhotoCount }}
          <template v-if="step.videoRequired"> · 视频必传</template>
        </text>

        <view v-if="step.photos.length > 0" class="grid grid-cols-3 gap-sm">
          <image
            v-for="(photo, index) in step.photos"
            :key="photo"
            class="aspect-square w-full rounded-control bg-divider"
            :src="photo"
            mode="aspectFill"
            :aria-label="`${step.stepName}证据照片${index + 1}`"
          />
        </view>

        <video
          v-for="(video, index) in step.videos"
          :key="video"
          class="w-full rounded-control bg-ink"
          :src="video"
          controls
          :aria-label="`${step.stepName}证据视频${index + 1}`"
        />

        <view v-if="!readOnly && isCurrent(step)" class="flex flex-col gap-sm">
          <view
            v-if="stepBusy(step) && uploadProgress !== null && uploadProgress !== undefined"
            class="text-center"
            role="status"
            aria-live="polite"
          >
            <text class="quiet-text">证据上传 {{ uploadProgress }}%</text>
          </view>
          <view class="grid grid-cols-2 gap-sm">
            <PcButton
              block
              variant="secondary"
              :disabled="
                !sop.canExecute ||
                stepBusy(step) ||
                step.photos.length >= BOUNTY_SOP_LIMITS.MAX_PHOTOS_PER_STEP
              "
              :aria-label="`为${step.stepName}上传照片`"
              @click="emit('photo', step.stepNumber)"
            >
              上传照片
            </PcButton>
            <PcButton
              block
              variant="secondary"
              :disabled="
                !sop.canExecute ||
                stepBusy(step) ||
                step.videos.length >= BOUNTY_SOP_LIMITS.MAX_VIDEOS_PER_STEP
              "
              :aria-label="`为${step.stepName}上传视频`"
              @click="emit('video', step.stepNumber)"
            >
              {{ step.videoRequired ? "上传必需视频" : "上传视频" }}
            </PcButton>
          </view>
          <PcButton
            block
            :disabled="!sop.canExecute || stepBusy(step) || !requirementsMet(step)"
            :loading="busyKey === `${step.stepNumber}:complete`"
            :aria-label="`完成${step.stepName}`"
            @click="emit('complete', step.stepNumber)"
          >
            完成当前步骤
          </PcButton>
        </view>
      </view>
    </view>
  </view>
</template>
