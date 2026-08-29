<script setup lang="ts">
import { onLoad } from "@dcloudio/uni-app";
import { ADMIN_CONTENT_POST_STATUS } from "@petcare/shared-types";
import type {
  CommunityMediaAsset,
  CommunityPostStatus,
  MyCommunityPostListItem,
} from "@petcare/shared-types";
import { computed, ref } from "vue";
import {
  createCommunityPost,
  deleteCommunityPost,
  discardCommunityMedia,
  getMyCommunityPosts,
  uploadCommunityMedia,
} from "@/api/content";
import { getSafeRequestErrorMessage } from "@/api/request";
import PcButton from "@/components/PcButton.vue";
import PcStatePanel from "@/components/PcStatePanel.vue";
import SubPageLayout from "@/components/SubPageLayout.vue";
import { requireProfile } from "@/state/session";

const MAX_CONTENT_LENGTH = 1000;
const MAX_MEDIA_COUNT = 9;

interface DraftMedia {
  key: string;
  filePath: string;
  progress: number;
  status: "uploading" | "ready" | "error";
  asset: CommunityMediaAsset | null;
  error: string;
}

let mediaSequence = 0;
const content = ref("");
const draftMedia = ref<DraftMedia[]>([]);
const posts = ref<MyCommunityPostListItem[]>([]);
const total = ref(0);
const accessStatus = ref<"checking" | "ready" | "unauthenticated">("checking");
const listStatus = ref<"loading" | "ready" | "error">("loading");
const listLoading = ref(false);
const choosingMedia = ref(false);
const submitting = ref(false);
const submitError = ref("");
const deletingPostId = ref("");
const deleteError = ref("");
const trimmedContent = computed(() => content.value.trim());
const mediaUploading = computed(() => draftMedia.value.some((item) => item.status === "uploading"));
const mediaFailed = computed(() => draftMedia.value.some((item) => item.status === "error"));
const canChooseMedia = computed(
  () => !submitting.value && !choosingMedia.value && draftMedia.value.length < MAX_MEDIA_COUNT,
);
const canSubmit = computed(
  () =>
    !submitting.value &&
    !choosingMedia.value &&
    trimmedContent.value.length > 0 &&
    trimmedContent.value.length <= MAX_CONTENT_LENGTH &&
    draftMedia.value.every((item) => item.status === "ready" && item.asset),
);
const submitLabel = computed(() => {
  if (submitting.value) {
    return "提交中";
  }

  if (mediaUploading.value) {
    return "图片上传中";
  }

  if (mediaFailed.value) {
    return "请重试失败图片";
  }

  return "提交审核";
});

const statusLabels: Record<CommunityPostStatus, string> = {
  [ADMIN_CONTENT_POST_STATUS.PENDING]: "审核中",
  [ADMIN_CONTENT_POST_STATUS.PUBLISHED]: "已发布",
  [ADMIN_CONTENT_POST_STATUS.REJECTED]: "未通过",
  [ADMIN_CONTENT_POST_STATUS.OFFLINE]: "已下架",
  [ADMIN_CONTENT_POST_STATUS.DELETED]: "已删除",
};

const statusTones: Record<CommunityPostStatus, string> = {
  [ADMIN_CONTENT_POST_STATUS.PENDING]: "bg-warning-soft text-warning",
  [ADMIN_CONTENT_POST_STATUS.PUBLISHED]: "bg-success-soft text-success",
  [ADMIN_CONTENT_POST_STATUS.REJECTED]: "bg-danger-soft text-danger",
  [ADMIN_CONTENT_POST_STATUS.OFFLINE]: "bg-divider text-muted",
  [ADMIN_CONTENT_POST_STATUS.DELETED]: "bg-divider text-muted",
};

function errorMessage(error: unknown, fallback: string): string {
  return getSafeRequestErrorMessage(error, fallback);
}

function formatDate(value: string): string {
  return value.slice(0, 16).replace("T", " ");
}

async function uploadMedia(item: DraftMedia): Promise<void> {
  if (submitting.value || item.status === "uploading") {
    return;
  }

  item.status = "uploading";
  item.progress = 0;
  item.error = "";
  item.asset = null;

  try {
    item.asset = await uploadCommunityMedia(item.filePath, (progress) => {
      item.progress = progress;
    });
    item.progress = 100;
    item.status = "ready";
  } catch (error) {
    item.status = "error";
    item.error = errorMessage(error, "上传失败，请重试");
  }
}

function chooseMedia(): void {
  if (!canChooseMedia.value) {
    return;
  }

  choosingMedia.value = true;
  const remaining = MAX_MEDIA_COUNT - draftMedia.value.length;

  uni.chooseImage({
    count: remaining,
    sizeType: ["compressed"],
    success(result) {
      const paths = Array.isArray(result.tempFilePaths)
        ? result.tempFilePaths
        : [result.tempFilePaths];
      const items: DraftMedia[] = paths.slice(0, remaining).map((filePath) => ({
        key: `community-media-${(mediaSequence += 1)}`,
        filePath,
        progress: 0,
        status: "error",
        asset: null,
        error: "",
      }));

      draftMedia.value.push(...items);
      draftMedia.value.slice(-items.length).forEach((item) => void uploadMedia(item));
    },
    fail(error) {
      if (!error.errMsg.includes("cancel")) {
        void uni.showToast({ title: "图片选择失败", icon: "none" });
      }
    },
    complete() {
      choosingMedia.value = false;
    },
  });
}

function removeMedia(item: DraftMedia): void {
  if (submitting.value || item.status === "uploading") {
    return;
  }

  draftMedia.value = draftMedia.value.filter((candidate) => candidate.key !== item.key);

  if (item.asset) {
    void discardCommunityMedia(item.asset.id).catch(() => undefined);
  }
}

async function loadMine(): Promise<void> {
  if (listLoading.value) {
    return;
  }

  listLoading.value = true;
  listStatus.value = "loading";

  try {
    const response = await getMyCommunityPosts({ page: 1, pageSize: 20 });

    posts.value = response.list;
    total.value = response.total;
    listStatus.value = "ready";
  } catch {
    listStatus.value = "error";
  } finally {
    listLoading.value = false;
  }
}

async function submit(): Promise<void> {
  if (!canSubmit.value) {
    return;
  }

  submitting.value = true;
  submitError.value = "";

  try {
    const post = await createCommunityPost({
      content: trimmedContent.value,
      mediaAssetIds: draftMedia.value.flatMap((item) => (item.asset ? [item.asset.id] : [])),
    });

    content.value = "";
    draftMedia.value = [];
    posts.value = [post, ...posts.value];
    total.value += 1;
    listStatus.value = "ready";
    await uni.showToast({ title: "已提交审核", icon: "success" }).catch(() => undefined);
  } catch (error) {
    submitError.value = errorMessage(error, "提交失败，请稍后重试");
  } finally {
    submitting.value = false;
  }
}

async function deletePost(post: MyCommunityPostListItem): Promise<void> {
  if (deletingPostId.value) {
    return;
  }

  const confirmation = await uni
    .showModal({
      title: "删除动态",
      content: "删除后将不再公开展示，确定继续吗？",
      confirmText: "删除",
    })
    .catch(() => null);

  if (!confirmation?.confirm) {
    return;
  }

  deletingPostId.value = post.id;
  deleteError.value = "";

  try {
    await deleteCommunityPost(post.id);
    posts.value = posts.value.filter((item) => item.id !== post.id);
    total.value = Math.max(0, total.value - 1);
    await uni.showToast({ title: "动态已删除", icon: "success" }).catch(() => undefined);
  } catch (error) {
    deleteError.value = errorMessage(error, "删除失败，动态仍保留，请重试");
  } finally {
    deletingPostId.value = "";
  }
}

async function checkAccess(): Promise<void> {
  accessStatus.value = "checking";
  let allowed = false;

  try {
    allowed = await requireProfile("/pages-content/community/publish");
  } catch {
    accessStatus.value = "unauthenticated";

    return;
  }

  if (!allowed) {
    accessStatus.value = "unauthenticated";

    return;
  }

  accessStatus.value = "ready";
  void loadMine();
}

function returnToCommunity(): void {
  uni.redirectTo({ url: "/pages/community/index" });
}

onLoad(() => {
  void checkAccess();
});
</script>

<template>
  <SubPageLayout title="发布动态">
    <view class="flex flex-col gap-card px-action py-card">
      <PcStatePanel v-if="accessStatus === 'checking'" status="loading" title="正在检查账号资料…" />

      <PcStatePanel
        v-else-if="accessStatus === 'unauthenticated'"
        status="unauthenticated"
        title="登录并完善资料后发布动态"
        description="发布前需要确认当前账号资料。"
        primary-label="重新验证"
        secondary-label="返回社区"
        @primary="checkAccess"
        @secondary="returnToCommunity"
      />

      <template v-else>
        <view class="main-card p-action">
          <text class="section-heading">分享养宠生活</text>
          <text class="mt-caption block meta-text">文字动态提交后将进入审核，不会立即公开。</text>
          <textarea
            v-model="content"
            class="mt-action box-border h-hero-main w-full rounded-control bg-page-bg p-copy text-body text-ink leading-body"
            :class="submitting ? 'opacity-50' : ''"
            :disabled="submitting"
            :aria-disabled="submitting"
            :maxlength="MAX_CONTENT_LENGTH"
            aria-label="动态正文"
            placeholder="记录你和宠物今天的故事"
          />
          <text class="mt-sm block text-right quiet-text">
            {{ content.length }}/{{ MAX_CONTENT_LENGTH }}
          </text>

          <view class="mt-action flex items-center justify-between gap-copy">
            <view class="flex flex-col">
              <text class="text-body text-ink font-medium leading-label">动态图片</text>
              <text class="quiet-text">{{ draftMedia.length }}/{{ MAX_MEDIA_COUNT }} 张</text>
            </view>
            <PcButton
              variant="secondary"
              :disabled="!canChooseMedia"
              :loading="choosingMedia"
              @click="chooseMedia"
            >
              {{ choosingMedia ? "选择中" : "选择图片" }}
            </PcButton>
          </view>

          <view v-if="draftMedia.length > 0" class="grid grid-cols-3 mt-copy gap-copy">
            <view v-for="(item, index) in draftMedia" :key="item.key" class="min-w-0">
              <view class="relative h-card-cover overflow-hidden rounded-control bg-divider">
                <image class="h-full w-full" :src="item.filePath" mode="aspectFill" />
                <view
                  v-if="item.status === 'uploading'"
                  class="absolute inset-0 flex items-center justify-center bg-ink opacity-80"
                  aria-live="polite"
                >
                  <text class="text-caption text-surface leading-caption"
                    >{{ item.progress }}%</text
                  >
                </view>
                <view
                  v-else-if="item.status === 'error'"
                  class="absolute inset-0 flex items-center justify-center bg-danger-soft p-sm"
                  role="alert"
                >
                  <text class="text-center text-micro text-danger leading-micro">{{
                    item.error
                  }}</text>
                </view>
              </view>
              <PcButton
                v-if="item.status === 'error'"
                class="mt-sm"
                block
                variant="secondary"
                :disabled="submitting"
                :aria-label="`重试第 ${index + 1} 张图片`"
                @click="uploadMedia(item)"
              >
                重试
              </PcButton>
              <PcButton
                class="mt-sm"
                block
                variant="ghost"
                :disabled="submitting || item.status === 'uploading'"
                :aria-label="`删除第 ${index + 1} 张图片`"
                @click="removeMedia(item)"
              >
                删除
              </PcButton>
            </view>
          </view>
          <text v-if="submitError" class="mt-copy block text-caption text-danger" role="alert">
            {{ submitError }}
          </text>
        </view>

        <view>
          <view class="flex items-end justify-between">
            <text class="section-heading">我的动态</text>
            <text v-if="listStatus === 'ready'" class="quiet-text">共 {{ total }} 条</text>
          </view>

          <PcStatePanel
            v-if="listStatus === 'loading'"
            class="mt-copy"
            status="loading"
            title="我的动态加载中…"
          />

          <PcStatePanel
            v-else-if="listStatus === 'error'"
            class="mt-copy"
            status="error"
            title="我的动态加载失败"
            description="请检查网络后重试。"
            primary-label="重新加载"
            :primary-disabled="listLoading"
            @primary="loadMine"
          />

          <PcStatePanel
            v-else-if="posts.length === 0"
            class="mt-copy"
            status="empty"
            title="还没有提交过动态"
            description="填写上方内容并提交后，可在这里查看审核状态。"
          />

          <view v-else class="mt-copy flex flex-col gap-copy">
            <text v-if="deleteError" class="text-caption text-danger" role="alert">
              {{ deleteError }}
            </text>
            <view v-for="post in posts" :key="post.id" class="main-card p-action">
              <view class="flex items-center justify-between gap-copy">
                <text class="quiet-text">{{ formatDate(post.createdAt) }}</text>
                <text
                  class="shrink-0 rounded-pill px-copy py-caption text-caption font-medium leading-caption"
                  :class="statusTones[post.status]"
                >
                  {{ statusLabels[post.status] }}
                </text>
              </view>
              <text class="mt-copy block text-body text-ink leading-body">{{ post.content }}</text>
              <view v-if="post.mediaUrls.length > 0" class="grid grid-cols-3 mt-copy gap-sm">
                <image
                  v-for="url in post.mediaUrls"
                  :key="url"
                  class="h-card-cover w-full rounded-control"
                  :src="url"
                  mode="aspectFill"
                />
              </view>
              <view
                v-if="post.status === ADMIN_CONTENT_POST_STATUS.REJECTED && post.moderationReason"
                class="mt-copy rounded-control bg-danger-soft p-copy"
              >
                <text class="text-caption text-danger leading-caption">
                  未通过原因：{{ post.moderationReason }}
                </text>
              </view>
              <PcButton
                v-if="post.status !== ADMIN_CONTENT_POST_STATUS.DELETED"
                class="mt-copy"
                block
                variant="danger"
                :disabled="Boolean(deletingPostId)"
                :loading="deletingPostId === post.id"
                :aria-label="`删除动态 ${formatDate(post.createdAt)}`"
                @click="deletePost(post)"
              >
                {{ deletingPostId === post.id ? "删除中" : "删除动态" }}
              </PcButton>
            </view>
          </view>
        </view>
      </template>
    </view>

    <template v-if="accessStatus === 'ready'" #actions>
      <PcButton block size="action" :disabled="!canSubmit" :loading="submitting" @click="submit">
        {{ submitLabel }}
      </PcButton>
    </template>
  </SubPageLayout>
</template>
