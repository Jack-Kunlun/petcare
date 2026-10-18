<script setup lang="ts">
import { onShareAppMessage, onShareTimeline, onShow } from "@dcloudio/uni-app";
import {
  BOUNTY_SERVICE_TYPE_LABELS,
  CLASSROOM_ARTICLE_CATEGORY_LABELS,
} from "@petcare/shared-types";
import type {
  BountySop,
  MyBounty,
  MyBountyIntentBounty,
  PublicBounty,
  PublicClassroomArticleListItem,
  PublicCommunityPostListItem,
} from "@petcare/shared-types";
import { computed, ref, watch } from "vue";
import { getBountySop, getMyBounties, getMyBountyIntents, getPublicBounties } from "@/api/bounties";
import { getClassroomArticles, getCommunityPosts } from "@/api/content";
import MainTabLayout from "@/components/MainTabLayout.vue";
import PcButton from "@/components/PcButton.vue";
import PcStatePanel from "@/components/PcStatePanel.vue";
import { commercialServicesEnabled } from "@/config/features";
import { captureSessionUserRevision, isSessionUserRevisionCurrent, session } from "@/state/session";

definePage({ style: { navigationBarTextStyle: "black", navigationStyle: "custom" } });
const HOME_CLASSROOM_PAGE_SIZE = 4;
const CLASSROOM_COVER_PLACEHOLDER = "/static/main/petcare-placeholder-light.svg";
const HOME_SHARE_TITLE = "PetCare 宠伴｜记录每一份陪伴";
const MINIAPP_TRUSTED_CARE_HERO = "/static/home/hero-care.webp";
const slides = [
  {
    image: MINIAPP_TRUSTED_CARE_HERO,
    title: "专业照护，就在身边",
    subtitle: "让每一次出门，都有人照顾 TA",
    action: "",
  },
  {
    image: "/static/home/hero-weekend.webp",
    title: "周末出行？宠物交给我们",
    subtitle: "认证保姆 · 服务记录 · 安心无忧",
    action: "查看附近服务",
  },
  {
    image: "/static/home/hero-guide.webp",
    title: "新手养宠，不再迷路",
    subtitle: "专业知识，陪你走过每一步",
    action: "了解更多",
  },
];
const classroomArticles = ref<PublicClassroomArticleListItem[]>([]);
const classroomStatus = ref<"loading" | "ready" | "error">("loading");
const classroomLoading = ref(false);
const bounties = ref<PublicBounty[]>([]);
const bountyStatus = ref<"loading" | "ready" | "error">("loading");
const posts = ref<PublicCommunityPostListItem[]>([]);
const postStatus = ref<"loading" | "ready" | "error">("loading");
const service = ref<MyBounty | MyBountyIntentBounty | null>(null);
const sop = ref<BountySop | null>(null);
const serviceError = ref(false);
const serviceLoading = ref(false);
const loading = ref(false);
const progress = computed(() =>
  sop.value?.steps.length
    ? Math.round(
        (sop.value.steps.filter((s) => s.completedAt).length / sop.value.steps.length) * 100,
      )
    : 0,
);
const currentHour = new Date().getHours();
let greeting = "晚上好";

if (currentHour < 12) {
  greeting = "早上好";
} else if (currentHour < 18) {
  greeting = "下午好";
}

function openPage(url: string) {
  uni.navigateTo({ url });
}

function openClassroomArticle(slug: string) {
  openPage(`/pages-content/classroom/article?id=${encodeURIComponent(slug)}`);
}

function openClassroomList() {
  uni.redirectTo({ url: "/pages/community/index?tab=classroom" });
}

function openCommunityList() {
  uni.redirectTo({ url: "/pages/community/index" });
}

function openBounties() {
  uni.redirectTo({ url: "/pages-bounty/index" });
}

function openOrders() {
  openPage("/pages-orders/index");
}

function serviceRoute(page: string) {
  if (service.value) {
    openPage(`/pages-orders/${page}?bountyId=${encodeURIComponent(service.value.id)}`);
  }
}

function classroomCategoryLabel(article: PublicClassroomArticleListItem): string {
  return article.category ? CLASSROOM_ARTICLE_CATEGORY_LABELS[article.category] : "未分类";
}

function publishedDate(value: string | null): string {
  return value?.slice(0, 10) ?? "";
}

async function loadHomeClassroom(): Promise<void> {
  if (classroomLoading.value) {
    return;
  }

  classroomLoading.value = true;
  classroomStatus.value = "loading";

  try {
    const response = await getClassroomArticles({ page: 1, pageSize: HOME_CLASSROOM_PAGE_SIZE });

    classroomArticles.value = response.list;
    classroomStatus.value = "ready";
  } catch {
    classroomArticles.value = [];
    classroomStatus.value = "error";
  } finally {
    classroomLoading.value = false;
  }
}

async function loadDiscovery() {
  if (loading.value) {
    return;
  }

  loading.value = true;
  postStatus.value = "loading";
  const results = await Promise.allSettled([
    getCommunityPosts({ page: 1, pageSize: 1 }),
    ...(commercialServicesEnabled ? [getPublicBounties({ page: 1, pageSize: 6 })] : []),
  ]);
  const postResult = results[0];

  if (postResult.status === "fulfilled") {
    posts.value = postResult.value.list as PublicCommunityPostListItem[];
    postStatus.value = "ready";
  } else {
    posts.value = [];
    postStatus.value = "error";
  }

  const bountyResult = results[1];

  if (bountyResult?.status === "fulfilled") {
    bounties.value = bountyResult.value.list as PublicBounty[];
    bountyStatus.value = "ready";
  } else if (commercialServicesEnabled) {
    bounties.value = [];
    bountyStatus.value = "error";
  }

  loading.value = false;
}

async function loadService() {
  if (serviceLoading.value) {
    return;
  }

  service.value = null;
  sop.value = null;
  serviceError.value = false;

  if (!commercialServicesEnabled || !session.user) {
    return;
  }

  const revision = captureSessionUserRevision();

  serviceLoading.value = true;

  try {
    let page = 1;
    let totalPages = 1;

    do {
      // The previous response determines whether another page exists.
      // eslint-disable-next-line no-await-in-loop
      const [owned, intents] = await Promise.all([
        getMyBounties({ page, pageSize: 50 }),
        getMyBountyIntents({ page, pageSize: 50 }),
      ]);

      if (!isSessionUserRevisionCurrent(revision)) {
        return;
      }

      service.value =
        [
          ...owned.list,
          ...intents.list.filter((i) => i.status === "confirmed").map((i) => i.bounty),
        ].find((b) => b.status === "in_progress" || b.status === "confirmed") ?? null;
      totalPages = Math.max(Math.ceil(owned.total / 50), Math.ceil(intents.total / 50));
      page += 1;
    } while (!service.value && page <= totalPages);

    if (service.value) {
      const current = await getBountySop(service.value.id);

      if (isSessionUserRevisionCurrent(revision)) {
        sop.value = current;
      }
    }
  } catch {
    if (isSessionUserRevisionCurrent(revision)) {
      serviceError.value = true;
    }
  } finally {
    serviceLoading.value = false;

    if (!isSessionUserRevisionCurrent(revision)) {
      service.value = null;
      sop.value = null;

      if (session.user && session.user.id !== revision.userId) {
        void loadService();
      }
    }
  }
}

watch(
  () => session.user?.id,
  () => {
    service.value = null;
    sop.value = null;
    serviceError.value = false;

    if (!serviceLoading.value) {
      void loadService();
    }
  },
  { flush: "sync" },
);

onShareAppMessage(() => ({
  title: HOME_SHARE_TITLE,
  path: "/pages/index/index",
  imageUrl: MINIAPP_TRUSTED_CARE_HERO,
}));
onShareTimeline(() => ({ title: HOME_SHARE_TITLE, imageUrl: MINIAPP_TRUSTED_CARE_HERO }));
onShow(() => {
  void loadHomeClassroom();
  void loadDiscovery();
  void loadService();
});
</script>

<template>
  <MainTabLayout active="home">
    <template #header>
      <view
        class="flex items-center gap-copy"
        role="button"
        aria-label="个人资料"
        @click="openPage(session.user ? '/pages-account/profile/info' : '/pages/auth/index')"
      >
        <image
          v-if="session.user?.avatar"
          class="h-avatar w-avatar rounded-full"
          :src="session.user.avatar"
          mode="aspectFill"
        />
        <view
          v-else
          class="h-avatar w-avatar flex items-center justify-center rounded-full bg-soft text-brand"
          >{{ session.user?.nickname.slice(0, 1) || "宠" }}</view
        >
        <view class="min-w-0 flex flex-col"
          ><text class="quiet-text">{{ greeting }}</text
          ><text class="truncate text-section text-ink font-medium leading-section">{{
            session.user?.nickname || "PetCare 宠伴"
          }}</text></view
        >
      </view>
    </template>
    <view class="flex flex-col px-page-horizontal pb-screen">
      <view
        class="mb-copy flex items-center gap-sm"
        role="button"
        aria-label="设置所在地区"
        @click="openPage(session.user ? '/pages-account/profile/edit' : '/pages/auth/index')"
      >
        <image class="h-icon-sm w-icon-sm" src="/static/home/location.svg" mode="aspectFit" /><text
          class="text-body text-link leading-body"
          >{{ session.user?.region || "设置所在地区" }}</text
        ><image class="h-icon-xs w-icon-xs" src="/static/main/chevron.svg" mode="aspectFit" />
      </view>
      <swiper
        class="h-hero-main w-full overflow-hidden rounded-card"
        :indicator-dots="true"
        indicator-color="rgba(255,255,255,0.55)"
        indicator-active-color="#ffffff"
        :autoplay="true"
        :interval="5000"
        :circular="true"
      >
        <swiper-item v-for="(slide, index) in slides" :key="slide.image">
          <view class="relative h-full overflow-hidden rounded-card">
            <image
              class="absolute inset-0 h-full w-full"
              :src="slide.image"
              mode="aspectFill"
            /><view class="hero-shade absolute inset-0" />
            <view class="absolute left-card top-card flex flex-col gap-sm pr-action"
              ><text class="hero-title">{{ slide.title }}</text
              ><text class="text-body text-surface leading-label opacity-80">{{
                slide.subtitle
              }}</text>
              <button
                v-if="slide.action && (commercialServicesEnabled || index === 2)"
                class="mt-caption h-control self-start rounded-full bg-surface px-action text-body text-link"
                @click="index === 1 ? openBounties() : openClassroomList()"
              >
                {{ slide.action }}
              </button>
            </view>
          </view>
        </swiper-item>
      </swiper>
      <template v-if="commercialServicesEnabled">
        <view class="mb-copy mt-section flex items-center justify-between"
          ><text class="section-heading">我的服务</text
          ><button class="m-0 h-control bg-transparent p-0 text-body text-link" @click="openOrders">
            查看订单 ›
          </button></view
        >
        <view v-if="service" class="border border-divider rounded-card bg-soft p-action">
          <text class="text-body text-success font-medium">{{
            service.status === "in_progress" ? "服务进行中" : "等待服务开始"
          }}</text>
          <view class="my-sm flex items-center gap-copy"
            ><image
              class="h-avatar w-avatar rounded-full"
              :src="service.pet.coverImage || CLASSROOM_COVER_PLACEHOLDER"
              mode="aspectFill"
            /><view class="flex flex-1 flex-col"
              ><text class="card-heading">{{ service.pet.name }}</text
              ><text class="quiet-text">{{ service.pet.breed }}</text></view
            ><text class="rounded-full bg-surface px-copy py-caption text-caption text-link">{{
              BOUNTY_SERVICE_TYPE_LABELS[service.serviceType]
            }}</text></view
          >
          <view class="mb-sm flex justify-between"
            ><text class="text-body">服务进度</text
            ><text class="text-body">{{ sop ? `${progress}%` : "暂未获取" }}</text></view
          >
          <view class="h-progress overflow-hidden rounded-full bg-brand-disabled"
            ><view class="h-full rounded-full bg-brand" :style="{ width: `${progress}%` }"
          /></view>
          <view class="mt-action flex gap-sm"
            ><PcButton block class="flex-1" @click="serviceRoute('monitor')">查看实时</PcButton
            ><PcButton block variant="secondary" class="flex-1" @click="serviceRoute('detail')"
              >服务详情</PcButton
            ></view
          >
        </view>
        <PcStatePanel v-else-if="serviceLoading" status="loading" title="正在读取服务进度…" />
        <PcStatePanel
          v-else-if="serviceError"
          status="error"
          title="服务加载失败"
          primary-label="重试"
          @primary="loadService"
        />
        <PcStatePanel
          v-else
          status="empty"
          :title="session.user ? '暂无进行中的服务' : '登录后查看我的服务'"
          :primary-label="session.user ? '查看订单' : '微信登录'"
          @primary="session.user ? openOrders() : openPage('/pages/auth/index')"
        />
        <view class="mb-copy mt-section flex items-center justify-between"
          ><text class="section-heading">热门悬赏</text
          ><button
            class="m-0 h-control bg-transparent p-0 text-body text-link"
            aria-label="浏览悬赏服务"
            @click="openBounties"
          >
            查看全部 ›
          </button></view
        >
        <PcStatePanel v-if="bountyStatus === 'loading'" status="loading" title="悬赏加载中…" />
        <PcStatePanel
          v-else-if="bountyStatus === 'error'"
          status="error"
          title="悬赏加载失败"
          primary-label="重试"
          @primary="loadDiscovery"
        />
        <PcStatePanel v-else-if="bounties.length === 0" status="empty" title="暂无公开悬赏" />
        <scroll-view v-else scroll-x class="w-full whitespace-nowrap" :show-scrollbar="false">
          <view class="inline-flex gap-copy"
            ><view
              v-for="bounty in bounties"
              :key="bounty.id"
              class="bounty-preview main-card p-action"
              role="button"
              @click="openPage(`/pages-bounty/detail?bountyId=${encodeURIComponent(bounty.id)}`)"
            >
              <view class="flex items-center gap-sm"
                ><image
                  class="h-avatar w-avatar rounded-full"
                  :src="bounty.pet.coverImage || CLASSROOM_COVER_PLACEHOLDER"
                  mode="aspectFill"
                /><text class="truncate meta-text"
                  >{{ bounty.pet.name }} · {{ bounty.pet.breed }}</text
                ></view
              >
              <text class="my-sm block card-heading">{{
                BOUNTY_SERVICE_TYPE_LABELS[bounty.serviceType]
              }}</text
              ><text class="block quiet-text">{{
                bounty.serviceTime.slice(0, 16).replace("T", " ")
              }}</text
              ><text class="mt-copy block text-right text-amount text-brand font-medium"
                >¥{{ (bounty.amountCents / 100).toFixed(2) }}</text
              >
            </view></view
          >
        </scroll-view>
      </template>
      <view class="mb-copy mt-section flex items-center justify-between"
        ><text class="section-heading">养宠小课堂</text
        ><button
          class="m-0 h-control bg-transparent p-0 text-body text-link"
          aria-label="查看全部课堂文章"
          @click="openClassroomList"
        >
          更多 ›
        </button></view
      >
      <PcStatePanel v-if="classroomStatus === 'loading'" status="loading" title="课堂内容加载中…" />
      <PcStatePanel
        v-else-if="classroomStatus === 'error'"
        status="error"
        title="课堂内容加载失败"
        primary-label="重新加载"
        :primary-disabled="classroomLoading"
        @primary="loadHomeClassroom"
      />
      <PcStatePanel
        v-else-if="classroomArticles.length === 0"
        status="empty"
        title="暂无已发布的课堂文章"
      />
      <view v-else class="flex flex-col gap-copy"
        ><view
          v-for="article in classroomArticles"
          :key="article.slug"
          class="flex items-center gap-copy main-card p-sm"
          role="button"
          @click="openClassroomArticle(article.slug)"
        >
          <view class="min-w-0 flex flex-1 flex-col gap-sm pl-caption"
            ><text class="text-body text-ink font-medium leading-label">{{ article.title }}</text
            ><view class="flex items-center gap-sm"
              ><text class="rounded-chip bg-success-soft px-sm text-caption text-success">{{
                classroomCategoryLabel(article)
              }}</text
              ><text v-if="article.publishedAt" class="quiet-text"
                >发布于 {{ publishedDate(article.publishedAt) }}</text
              ></view
            ></view
          >
          <image
            class="h-mini-cover w-mini-cover shrink-0 rounded-chip"
            :src="article.coverUrl || CLASSROOM_COVER_PLACEHOLDER"
            mode="aspectFill"
          /> </view
      ></view>
      <view class="mb-copy mt-section flex items-center justify-between"
        ><text class="section-heading">社区精选</text
        ><button
          class="m-0 h-control bg-transparent p-0 text-body text-link"
          @click="openCommunityList"
        >
          发现更多 ›
        </button></view
      >
      <PcStatePanel v-if="postStatus === 'loading'" status="loading" title="社区内容加载中…" />
      <PcStatePanel
        v-else-if="postStatus === 'error'"
        status="error"
        title="社区内容加载失败"
        primary-label="重试"
        @primary="loadDiscovery"
      />
      <PcStatePanel v-else-if="posts.length === 0" status="empty" title="暂无社区分享" />
      <view
        v-for="post in posts"
        v-else
        :key="post.id"
        class="main-card p-action"
        role="button"
        @click="openPage(`/pages-content/community/article?id=${encodeURIComponent(post.id)}`)"
      >
        <view class="mb-copy flex items-center gap-copy"
          ><image
            class="h-avatar w-avatar rounded-full"
            :src="post.author.avatar || '/static/main/profile-cat.png'"
            mode="aspectFill"
          /><view class="flex flex-col"
            ><text class="text-body text-ink font-medium">{{ post.author.displayName }}</text
            ><text class="quiet-text">{{ post.createdAt.slice(0, 10) }}</text></view
          ></view
        >
        <text class="line-clamp-3 text-body text-ink leading-body">{{ post.content }}</text
        ><image
          v-if="post.mediaUrls[0]"
          class="mt-copy h-hero-main w-full rounded-control"
          :src="post.mediaUrls[0]"
          mode="aspectFill"
        />
        <view class="mt-copy flex items-center gap-action"
          ><image class="h-icon-sm w-icon-sm" src="/static/main/heart.svg" /><text
            class="meta-text"
            >{{ post.likesCount }}</text
          ><text class="meta-text">评论 {{ post.commentsCount }}</text
          ><text class="ml-auto text-caption text-link">查看动态 ›</text></view
        >
      </view>
    </view>
  </MainTabLayout>
</template>

<style scoped>
.hero-shade {
  background: linear-gradient(
    90deg,
    rgba(8, 19, 45, 0.78),
    rgba(8, 19, 45, 0.34) 54%,
    rgba(8, 19, 45, 0.02)
  );
}
.hero-title {
  color: white;
  font-size: 22px;
  font-weight: 500;
  line-height: 28px;
  white-space: nowrap;
}
.bounty-preview {
  box-sizing: border-box;
  width: 272px;
  white-space: normal;
}
</style>
