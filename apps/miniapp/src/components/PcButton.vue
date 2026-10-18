<script setup lang="ts">
import { computed } from "vue";
import { miniappDesignTokens } from "@/config/design-tokens";

type PcButtonVariant = "primary" | "secondary" | "ghost" | "danger";
type PcButtonSize = "control" | "action";

const props = withDefaults(
  defineProps<{
    /** Visual emphasis for the action. */
    variant?: PcButtonVariant;
    /** Height and typography preset for the action. */
    size?: PcButtonSize;
    /** Expands the button to the available width. */
    block?: boolean;
    /** Shows the busy affordance and prevents duplicate activation. */
    loading?: boolean;
    /** Disables the action without removing it from the page. */
    disabled?: boolean;
    /** Accessible name for icon-only actions. */
    ariaLabel?: string;
  }>(),
  {
    variant: "primary",
    size: "control",
    block: false,
    loading: false,
    disabled: false,
    ariaLabel: undefined,
  },
);

const emit = defineEmits<{
  /** Emits the native click event when the action is enabled. */
  click: [event: Event];
}>();

const isDisabled = computed(() => props.disabled || props.loading);
const colors = miniappDesignTokens.colors;
const palette = {
  "--pc-button-brand": colors.brand,
  "--pc-button-active": colors["brand-active"],
  "--pc-button-soft": colors.soft,
  "--pc-button-disabled": colors["brand-disabled"],
  "--pc-button-danger": colors.danger,
};

function handleClick(event: Event): void {
  if (!isDisabled.value) {
    emit("click", event);
  }
}
</script>

<template>
  <button
    class="pc-button"
    :style="palette"
    :class="[
      `pc-button--${variant}`,
      `pc-button--${size}`,
      block ? 'pc-button--block' : '',
      isDisabled ? 'pc-button--disabled' : '',
    ]"
    :disabled="isDisabled"
    :aria-disabled="isDisabled"
    :aria-busy="loading"
    :aria-label="ariaLabel"
    @click="handleClick"
  >
    <view v-if="loading" class="pc-button__spinner" aria-hidden="true" />
    <slot name="prefix" />
    <slot />
    <slot name="suffix" />
  </button>
</template>

<style scoped lang="scss">
.pc-button {
  box-sizing: border-box;
  display: inline-flex;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  gap: 6px;
  border: 1px solid transparent;
  border-radius: 12px;
  font-size: 14px;
  font-weight: 500;
  line-height: 22px;
  text-align: center;
  cursor: pointer;
  transition:
    background-color 120ms ease,
    border-color 120ms ease,
    opacity 120ms ease;

  &--control {
    min-height: 44px;
    padding: 0 16px;
  }

  &--action {
    min-height: 52px;
    padding: 0 16px;
    font-size: 16px;
    font-weight: 600;
    line-height: 24px;
  }

  &--block {
    width: 100%;
  }

  &--primary {
    background: var(--pc-button-brand);
    color: #ffffff;

    &:active {
      background: var(--pc-button-active);
    }
  }

  &--secondary {
    border-color: #f2f4f7;
    background: #ffffff;
    color: #1f2937;

    &:active {
      background: var(--pc-button-soft);
    }
  }

  &--ghost {
    background: transparent;
    color: var(--pc-button-brand);

    &:active {
      background: var(--pc-button-soft);
    }
  }

  &--danger {
    border-color: var(--pc-button-danger);
    background: #ffffff;
    color: var(--pc-button-danger);

    &:active {
      background: #fddbd8;
    }
  }

  &--disabled {
    cursor: not-allowed;
    background: var(--pc-button-disabled);
    border-color: transparent;
    color: #ffffff;
  }

  &__spinner {
    width: 14px;
    height: 14px;
    border: 2px solid currentColor;
    border-right-color: transparent;
    border-radius: 999px;
    animation: pc-button-spin 700ms linear infinite;
  }
}

@media (prefers-reduced-motion: reduce) {
  .pc-button {
    transition: none;
  }
}

@keyframes pc-button-spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
