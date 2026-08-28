<script setup lang="ts">
import { onLoad } from "@dcloudio/uni-app";
import { WEBSITE_CONTENT_KEY } from "@petcare/shared-types";
import { computed, ref } from "vue";
import { getPublishedContent } from "@/api/content";
import PcStatePanel from "@/components/PcStatePanel.vue";
import SubPageLayout from "@/components/SubPageLayout.vue";
import { filterHelpCategories, toHelpCategories } from "@/pages-content/content-mappers";
import type { HelpCategory } from "@/pages-content/content-mappers";

const query = ref("");
const categories = ref<HelpCategory[]>([]);
const status = ref<"loading" | "ready" | "error">("loading");
const loading = ref(false);
const filtered = computed(() => filterHelpCategories(categories.value, query.value));

async function load(): Promise<void> {
  if (loading.value) {
    return;
  }

  loading.value = true;
  status.value = "loading";

  try {
    categories.value = toHelpCategories(await getPublishedContent(WEBSITE_CONTENT_KEY.HELP));
    status.value = "ready";
  } catch {
    status.value = "error";
  } finally {
    loading.value = false;
  }
}

function clearQuery(): void {
  query.value = "";
}

onLoad(() => {
  void load();
});
</script>

<template>
  <SubPageLayout title="帮助中心">
    <view class="flex flex-col gap-card px-action py-card">
      <PcStatePanel v-if="status === 'loading'" status="loading" title="帮助内容加载中…" />

      <PcStatePanel
        v-else-if="status === 'error'"
        status="error"
        title="帮助内容加载失败"
        description="请检查网络后重试。"
        primary-label="重新加载"
        :primary-disabled="loading"
        @primary="load"
      />

      <template v-else>
        <view
          v-if="categories.length > 0"
          class="h-control flex items-center gap-sm rounded-control bg-surface px-copy shadow-card"
        >
          <image
            class="h-icon-sm w-icon-sm"
            src="/static/main/search.svg"
            mode="aspectFit"
            aria-hidden="true"
          />
          <input
            v-model="query"
            class="h-full min-w-0 flex-1 text-body text-ink"
            aria-label="搜索常见问题"
            confirm-type="search"
            placeholder="搜索常见问题"
          />
        </view>

        <PcStatePanel
          v-if="categories.length === 0"
          status="empty"
          title="暂无帮助内容"
          description="有新的使用说明时会显示在这里。"
        />

        <PcStatePanel
          v-else-if="filtered.length === 0"
          status="empty"
          title="未找到相关问题"
          description="可以换个关键词，或清除搜索后查看全部问题。"
          primary-label="清除搜索"
          @primary="clearQuery"
        />

        <view v-else class="flex flex-col gap-card">
          <view v-for="category in filtered" :key="category.key" class="main-card p-action">
            <text class="section-heading">{{ category.title }}</text>
            <view class="mt-copy flex flex-col gap-action">
              <view v-for="question in category.questions" :key="question.key">
                <text class="text-body text-ink font-semibold leading-label">
                  {{ question.question }}
                </text>
                <text class="mt-sm block whitespace-pre-line meta-text">
                  {{ question.answer }}
                </text>
              </view>
            </view>
          </view>
        </view>
      </template>
    </view>
  </SubPageLayout>
</template>
