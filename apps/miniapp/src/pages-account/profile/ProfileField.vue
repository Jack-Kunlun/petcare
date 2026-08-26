<script setup lang="ts">
import { computed } from "vue";

interface ProfileFieldProps {
  label: string;
  value?: string | null;
  placeholder?: string;
  clickable?: boolean;
  readonly?: boolean;
  disabled?: boolean;
  required?: boolean;
  helper?: string;
  error?: string;
  rightIcon?: string;
  last?: boolean;
}

const props = withDefaults(defineProps<ProfileFieldProps>(), {
  value: "",
  placeholder: "",
  clickable: false,
  readonly: false,
  disabled: false,
  required: false,
  helper: "",
  error: "",
  rightIcon: "",
  last: false,
});
const emit = defineEmits<{ click: [] }>();

const displayValue = computed(() => props.value || props.placeholder);
const interactive = computed(() => props.clickable && !props.readonly && !props.disabled);

function activate() {
  if (interactive.value) {
    emit("click");
  }
}
</script>

<template>
  <view :class="[last ? '' : 'border-b border-divider', disabled ? 'opacity-50' : '']">
    <button
      v-if="clickable"
      class="profile-field-button min-h-button w-full flex items-center gap-action bg-transparent p-0 text-left"
      :class="interactive ? 'cursor-pointer' : 'cursor-not-allowed'"
      style="margin: 0; border: none; background: transparent"
      :disabled="!interactive"
      :aria-disabled="!interactive"
      :aria-label="`${label}，${displayValue || '未填写'}`"
      hover-class="bg-page-bg"
      @click="activate"
    >
      <text class="w-pet shrink-0 text-body text-muted leading-label">
        {{ label }}<text v-if="required" class="text-danger" aria-hidden="true"> *</text>
      </text>
      <view class="min-w-0 flex-1">
        <view class="min-h-control flex items-center justify-end gap-sm">
          <slot name="control" :disabled="disabled" :readonly="readonly">
            <text
              class="truncate text-right text-body leading-body"
              :class="value ? 'text-ink' : 'text-subtle'"
            >
              {{ displayValue }}
            </text>
          </slot>
          <image
            v-if="rightIcon"
            class="h-icon-xs w-icon-xs shrink-0"
            :src="rightIcon"
            mode="aspectFit"
          />
        </view>
        <text v-if="error" class="mb-sm block text-right text-caption text-danger leading-caption">
          {{ error }}
        </text>
        <text
          v-else-if="helper"
          class="mb-sm block text-right text-caption text-subtle leading-caption"
        >
          {{ helper }}
        </text>
      </view>
    </button>

    <label v-else class="min-h-button flex items-center gap-action" :aria-disabled="disabled">
      <text class="w-pet shrink-0 text-body text-muted leading-label">
        {{ label }}<text v-if="required" class="text-danger" aria-hidden="true"> *</text>
      </text>
      <view class="min-w-0 flex-1">
        <view class="min-h-control flex items-center justify-end gap-sm">
          <slot name="control" :disabled="disabled" :readonly="readonly">
            <text
              class="truncate text-right text-body leading-body"
              :class="value ? 'text-ink' : 'text-subtle'"
            >
              {{ displayValue }}
            </text>
          </slot>
          <image
            v-if="rightIcon"
            class="h-icon-xs w-icon-xs shrink-0"
            :src="rightIcon"
            mode="aspectFit"
          />
        </view>
        <text v-if="error" class="mb-sm block text-right text-caption text-danger leading-caption">
          {{ error }}
        </text>
        <text
          v-else-if="helper"
          class="mb-sm block text-right text-caption text-subtle leading-caption"
        >
          {{ helper }}
        </text>
      </view>
    </label>
  </view>
</template>

<style scoped>
.profile-field-button::after {
  border: 0;
}
</style>
