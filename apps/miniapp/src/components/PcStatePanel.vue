<script setup lang="ts">
import { computed, useSlots } from "vue";
import PcButton from "./PcButton.vue";

type PcState = "loading" | "empty" | "error" | "unavailable" | "unauthenticated";

const props = withDefaults(
  defineProps<{
    /** State represented by this panel. */
    status: PcState;
    /** Short, user-facing state title. */
    title: string;
    /** Optional explanation that helps the user decide what to do next. */
    description?: string;
    /** Main recovery action label. Omitted for loading states. */
    primaryLabel?: string;
    /** Lower-emphasis secondary action label. Omitted for loading states. */
    secondaryLabel?: string;
    /** Prevents the primary action while its owner is busy. */
    primaryDisabled?: boolean;
    /** Prevents the secondary action while its owner is busy. */
    secondaryDisabled?: boolean;
  }>(),
  {
    description: "",
    primaryLabel: "",
    secondaryLabel: "",
    primaryDisabled: false,
    secondaryDisabled: false,
  },
);

const emit = defineEmits<{
  /** Requests the primary recovery action. */
  primary: [];
  /** Requests the secondary recovery action. */
  secondary: [];
}>();

const slots = useSlots();
const iconByStatus: Record<PcState, string> = {
  loading: "",
  empty: "",
  error: "!",
  unavailable: "—",
  unauthenticated: "→",
};
const toneByStatus: Record<PcState, string> = {
  loading: "pc-state-panel--loading",
  empty: "pc-state-panel--empty",
  error: "pc-state-panel--error",
  unavailable: "pc-state-panel--unavailable",
  unauthenticated: "pc-state-panel--unauthenticated",
};
const isLoading = computed(() => props.status === "loading");
const hasActions = computed(
  () =>
    !isLoading.value &&
    (Boolean(props.primaryLabel) || Boolean(props.secondaryLabel) || Boolean(slots.actions)),
);
</script>

<template>
  <view
    class="pc-state-panel"
    :class="toneByStatus[status]"
    :role="status === 'error' || status === 'unavailable' ? 'alert' : 'status'"
    aria-live="polite"
  >
    <slot name="illustration">
      <image
        v-if="status === 'empty'"
        class="pc-state-panel__illustration"
        src="/static/main/state-empty.svg"
        mode="aspectFit"
        aria-hidden="true"
      />
      <view v-else class="pc-state-panel__icon" aria-hidden="true">
        <view v-if="status === 'loading'" class="pc-state-panel__spinner" />
        <text>{{ iconByStatus[status] }}</text>
      </view>
    </slot>
    <text class="pc-state-panel__title">{{ title }}</text>
    <text v-if="description" class="pc-state-panel__description">{{ description }}</text>

    <view v-if="hasActions" class="pc-state-panel__actions">
      <slot name="actions">
        <PcButton
          v-if="primaryLabel"
          block
          variant="primary"
          :disabled="primaryDisabled"
          @click="emit('primary')"
        >
          {{ primaryLabel }}
        </PcButton>
        <PcButton
          v-if="secondaryLabel"
          block
          variant="ghost"
          :disabled="secondaryDisabled"
          @click="emit('secondary')"
        >
          {{ secondaryLabel }}
        </PcButton>
      </slot>
    </view>
  </view>
</template>

<style scoped lang="scss">
.pc-state-panel {
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  min-height: 196px;
  padding: 24px 16px;
  border: 1px solid #eaecf0;
  border-radius: 16px;
  background: #ffffff;
  text-align: center;

  &--error {
    border-color: #fecdca;
    background: #fef3f2;
  }

  &--unavailable,
  &--unauthenticated {
    background: #eff6ff;
  }

  &__icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 48px;
    height: 48px;
    border-radius: 999px;
    background: #eff6ff;
    color: #2563eb;
    font-size: 24px;
    font-weight: 600;
    line-height: 32px;
  }

  &__illustration {
    width: 96px;
    height: 72px;
  }

  &__spinner {
    width: 20px;
    height: 20px;
    border: 2px solid currentColor;
    border-right-color: transparent;
    border-radius: 999px;
    animation: pc-state-panel-spin 700ms linear infinite;
  }

  &--error &__icon {
    background: #fee4e2;
    color: #d92d20;
  }

  &__title {
    color: #1f2937;
    font-size: 16px;
    font-weight: 600;
    line-height: 24px;
  }

  &__description {
    max-width: 290px;
    color: #667085;
    font-size: 14px;
    line-height: 22px;
  }

  &__actions {
    display: flex;
    width: min(100%, 280px);
    flex-direction: column;
    gap: 8px;
    margin-top: 4px;
  }
}

@keyframes pc-state-panel-spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
