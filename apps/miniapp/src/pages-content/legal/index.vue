<script setup lang="ts">
import { onLoad } from "@dcloudio/uni-app";
import type { WebsiteContentKey, WebsiteRichTextContent } from "@petcare/shared-types";
import { WEBSITE_CONTENT_KEY } from "@petcare/shared-types";
import { computed, ref } from "vue";
import { getPublishedContent } from "@/api/content";
import PcStatePanel from "@/components/PcStatePanel.vue";
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
      <PcStatePanel v-if="status === 'loading'" status="loading" title="协议内容加载中…" />

      <PcStatePanel
        v-else-if="status === 'error'"
        status="error"
        title="协议内容加载失败"
        description="请检查网络后重试。"
        primary-label="重新加载"
        :primary-disabled="loading"
        @primary="load"
      />

      <PcStatePanel
        v-else-if="sections.length === 0"
        status="empty"
        title="暂无已发布的协议内容"
        description="请稍后返回查看。"
      />

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
