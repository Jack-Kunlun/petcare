<script setup lang="ts">
import { onLoad } from "@dcloudio/uni-app";
import type { WebsiteContentKey, WebsiteRichTextContent } from "@petcare/shared-types";
import { WEBSITE_CONTENT_KEY } from "@petcare/shared-types";
import { computed, ref } from "vue";
import { getPublishedContent } from "@/api/content";
import SubPageLayout from "@/components/SubPageLayout.vue";
import { getLegalContentKey, toRichTextContent } from "@/pages-content/content-mappers";

const contentKey = ref<WebsiteContentKey>(WEBSITE_CONTENT_KEY.PRIVACY);
const sections = ref<WebsiteRichTextContent[]>([]);
const status = ref<"loading" | "ready" | "error">("loading");
const loading = ref(false);
const title = computed(() =>
  contentKey.value === WEBSITE_CONTENT_KEY.TERMS ? "服务协议" : "隐私协议",
);

async function load(): Promise<void> {
  if (loading.value) {
    return;
  }

  loading.value = true;
  status.value = "loading";

  try {
    sections.value = toRichTextContent(await getPublishedContent(contentKey.value));
    status.value = "ready";
  } catch {
    status.value = "error";
  } finally {
    loading.value = false;
  }
}

onLoad((query = {}) => {
  contentKey.value = getLegalContentKey(query.key);
  void load();
});
</script>

<template>
  <SubPageLayout :title="title">
    <view class="flex flex-col gap-card px-action py-card">
      <view v-if="status === 'loading'" class="main-card p-action">
        <text class="text-body text-muted leading-body">协议内容加载中…</text>
      </view>

      <view
        v-else-if="status === 'error'"
        class="flex flex-col gap-copy rounded-card bg-danger-soft p-action"
        role="alert"
      >
        <text class="text-body text-ink leading-body">协议内容加载失败，请稍后重试</text>
        <button
          class="h-control rounded-control bg-brand-active px-action text-body text-surface font-medium"
          :class="loading ? 'opacity-50' : ''"
          :disabled="loading"
          :aria-disabled="loading"
          :loading="loading"
          @click="load"
        >
          重新加载
        </button>
      </view>

      <view v-else-if="sections.length === 0" class="main-card p-action">
        <text class="text-body text-muted leading-body">协议内容暂未配置</text>
      </view>

      <view v-else class="flex flex-col gap-card">
        <view
          v-for="(section, sectionIndex) in sections"
          :key="`${section.title}-${sectionIndex}`"
          class="main-card p-action"
        >
          <text class="section-heading">{{ section.title }}</text>
          <text v-if="section.effectiveDate" class="mt-sm block meta-text">
            {{ section.effectiveDate }}
          </text>
          <view class="mt-action flex flex-col gap-action">
            <view v-for="part in section.parts" :key="part.partKey">
              <text class="text-body text-ink font-semibold leading-label">
                {{ part.heading }}
              </text>
              <text
                v-for="(paragraph, paragraphIndex) in part.paragraphs"
                :key="`${part.partKey}-${paragraphIndex}`"
                class="mt-sm block text-body text-ink leading-body"
              >
                {{ paragraph }}
              </text>
            </view>
          </view>
        </view>
      </view>
    </view>
  </SubPageLayout>
</template>
