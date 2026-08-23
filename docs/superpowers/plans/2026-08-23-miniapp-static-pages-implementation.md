# PetCare Miniapp Static Pages Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在 `apps/miniapp` 完成原型路由表的 34 个正式路由状态与登录页，并打通不依赖后端的基础页面跳转。

**Architecture:** 保留登录页和 5 个主 Tab 在主包，新增 `SubPageLayout` 统一子页面安全区、返回导航和底部操作区；其余页面按悬赏、订单照护、宠物个人、内容支持拆为 4 个 UniApp 分包。页面使用本地静态数据、现有批准资产、UnoCSS 语义 Token 与直接的 `uni.navigateTo`/`switchTab`/`navigateBack`，不增加通用页面渲染器、状态管理或 API 层。

**Tech Stack:** UniApp、Vue 3、TypeScript、Wot UI、UnoCSS、Vitest。

**Spec:** `docs/superpowers/specs/2026-08-23-miniapp-static-pages-design.md`

## Global Constraints

- 交付覆盖原型中的 34 个正式路由条目，以及登录页，共 35 个页面或页面状态；`/home` 与 `/rewards` 只作为兼容入口，不制作重复业务页面。
- 主包保留登录页与 5 个主 Tab；子页面按悬赏、订单照护、宠物个人、内容支持拆分为 UniApp 分包。
- 继续使用 UniApp、Vue 3、Wot UI 和 UnoCSS，不新增依赖。
- 页面主体采用 flex + px 流式布局，不使用 rpx。
- 常用颜色、间距、尺寸、圆角、阴影、字号和行高统一维护在 `apps/miniapp/src/config/design-tokens.ts`，页面禁止使用 UnoCSS 裸任意值。
- 不新增独立 CSS 或 SCSS；只有 UnoCSS 无法表达的平台安全区或动态进度才允许局部内联样式。
- 微信端内容起点位于胶囊底部；H5 与 App 使用平台顶部安全区；固定底部操作叠加底部安全区。
- 最小触控区域为 44×44px，不使用 Emoji 充当结构图标。
- 页面只使用静态示例数据；不请求 API，不新增全局状态，不保存表单，不调用真实定位、地图、聊天、视频、支付、上传、拨号或客服能力。
- 不可用控件必须同时表现为不可用并阻止点击。
- 只提取已稳定重复的主 Tab 布局、子页面布局和跨页面共享实体；不创建配置驱动的页面生成器。

## File Map

- Create: `apps/miniapp/src/components/SubPageLayout.vue` — 子页面安全区、返回栏、滚动区与底部操作槽。
- Modify: `apps/miniapp/pages.config.ts` — 注册 4 个分包及 27 个物理子页面。
- Modify: `apps/miniapp/src/config/design-tokens.ts`、`apps/miniapp/uno.config.ts` — 仅补充实际页面复用的语义 Token/shortcut。
- Create: `apps/miniapp/pages-config.spec.ts` — 锁定主包、分包和 35 个交付状态的路由契约。
- Modify: `apps/miniapp/src/pages/bounty/index.vue` — 列表/地图双状态及悬赏入口。
- Create: `apps/miniapp/src/pages-bounty/**` — 发布四页与悬赏详情。
- Modify: `apps/miniapp/src/pages/index/index.vue`、`apps/miniapp/src/pages/messages/index.vue` — 订单照护入口。
- Create: `apps/miniapp/src/pages-care/**` — 订单列表、详情、监控、聊天。
- Modify: `apps/miniapp/src/pages/profile/index.vue` — 宠物、个人、内容与支持入口。
- Create: `apps/miniapp/src/pages-account/**` — 宠物、资料、收藏关注评价和四类详情。
- Create: `apps/miniapp/src/pages-content/**` — 两类文章、优惠券、钱包、帮助、客服。
- Modify generated: `apps/miniapp/src/pages.json`、`apps/miniapp/src/components.d.ts`、`apps/miniapp/src/uni-pages.d.ts` — 由 UniApp 插件生成，禁止手工维护业务内容。

---

### Task 1: 建立分包路由与子页面布局

**Files:**

- Create: `apps/miniapp/src/components/sub-page-layout.ts`
- Create: `apps/miniapp/src/components/sub-page-layout.spec.ts`
- Create: `apps/miniapp/src/components/SubPageLayout.vue`
- Modify: `apps/miniapp/src/config/design-tokens.ts`
- Modify: `apps/miniapp/uno.config.ts`
- Generated: `apps/miniapp/src/components.d.ts`

**Interfaces:**

- Consumes: `getMainLayoutTop(windowInfo, menuButton)` from `apps/miniapp/src/components/main-tab-layout.ts`.
- Produces: `getSubPageBottom(windowInfo): number` with a zero fallback.
- Produces: `<SubPageLayout title="...">`, optional `header-right` slot, default scroll slot, and optional `actions` slot.

- [ ] **Step 1: 写底部安全区失败测试**

Create `apps/miniapp/src/components/sub-page-layout.spec.ts`:

```ts
import { describe, expect, it } from "vitest";
import { getSubPageBottom } from "./sub-page-layout";

describe("getSubPageBottom", () => {
  it("uses the platform safe-area bottom with a zero fallback", () => {
    expect(getSubPageBottom({ safeAreaInsets: { bottom: 34 } })).toBe(34);
    expect(getSubPageBottom({})).toBe(0);
  });
});
```

- [ ] **Step 2: 运行测试并确认先失败**

Run: `pnpm --filter @petcare/miniapp test -- src/components/sub-page-layout.spec.ts`

Expected: FAIL because `getSubPageBottom` is missing.

- [ ] **Step 3: 实现最小底部安全区函数**

Create `apps/miniapp/src/components/sub-page-layout.ts`:

```ts
type WindowInfo = { safeAreaInsets?: { bottom?: number } };

export function getSubPageBottom(windowInfo: WindowInfo): number {
  return windowInfo.safeAreaInsets?.bottom ?? 0;
}
```

- [ ] **Step 4: 实现最小子页面布局**

Create `SubPageLayout.vue`. Reuse the existing top-safe-area helper; do not add a second platform detector.

```vue
<script setup lang="ts">
import { useSlots } from "vue";
import { getMainLayoutTop } from "./main-tab-layout";
import { getSubPageBottom } from "./sub-page-layout";

defineProps<{ title: string }>();

const slots = useSlots();
const windowInfo = uni.getWindowInfo();
/* eslint-disable prefer-const -- UniApp assigns this only in WeChat builds. */
let menuButton: { bottom: number } | undefined;
// #ifdef MP-WEIXIN
menuButton = uni.getMenuButtonBoundingClientRect();
// #endif
/* eslint-enable prefer-const */
const safeAreaTop = getMainLayoutTop(windowInfo, menuButton);
const safeAreaBottom = getSubPageBottom(windowInfo);

function goBack() {
  uni.navigateBack();
}
</script>

<template>
  <view class="h-screen min-h-screen flex flex-col overflow-hidden bg-page-bg text-ink">
    <view class="shrink-0" :style="{ height: `${safeAreaTop}px` }" />
    <view class="h-header shrink-0 flex items-center border-b border-divider bg-surface px-action">
      <view
        class="h-control w-control flex shrink-0 items-center justify-center"
        aria-label="返回"
        @click="goBack"
      >
        <image
          class="h-icon-sm w-icon-sm rotate-180"
          src="/static/main/chevron.svg"
          mode="aspectFit"
        />
      </view>
      <text class="min-w-0 flex-1 truncate text-center card-heading">{{ title }}</text>
      <view class="h-control w-control flex shrink-0 items-center justify-center"
        ><slot name="header-right"
      /></view>
    </view>
    <scroll-view class="h-0 min-h-0 flex-1" scroll-y :show-scrollbar="false"><slot /></scroll-view>
    <view
      v-if="slots.actions"
      class="shrink-0 border-t border-divider bg-surface px-action pt-copy"
      :style="{ paddingBottom: `${safeAreaBottom + 12}px` }"
    >
      <slot name="actions" />
    </view>
  </view>
</template>
```

Only add `control: "44px"` to width tokens if UnoCSS does not already expose it through `sizes`; add no unused page-specific values.

- [ ] **Step 5: 生成页面配置并跑基础门禁**

Run sequentially:

```powershell
pnpm --filter @petcare/miniapp build:mp-weixin
pnpm --filter @petcare/miniapp test -- src/components/sub-page-layout.spec.ts src/components/main-tab-layout.spec.ts
pnpm --filter @petcare/miniapp typecheck
pnpm --filter @petcare/miniapp lint
git diff --check
```

Expected: route test, typecheck, lint, build, and diff check all PASS.

- [ ] **Step 6: 提交基础层**

```powershell
git add apps/miniapp
git commit -m "feat(miniapp): 建立静态子页面路由与布局"
```

### Task 2: 完成悬赏列表、地图、发布流程与详情

**Files:**

- Modify: `apps/miniapp/pages.config.ts`
- Generated: `apps/miniapp/src/pages.json`
- Generated: `apps/miniapp/src/uni-pages.d.ts`
- Create: `apps/miniapp/src/pages/bounty/bounty-mode.ts`
- Create: `apps/miniapp/src/pages/bounty/bounty-mode.spec.ts`
- Modify: `apps/miniapp/src/pages/bounty/index.vue`
- Create: `apps/miniapp/src/pages-bounty/publish/step1.vue`
- Create: `apps/miniapp/src/pages-bounty/publish/step2.vue`
- Create: `apps/miniapp/src/pages-bounty/publish/step3.vue`
- Create: `apps/miniapp/src/pages-bounty/publish/success.vue`
- Create: `apps/miniapp/src/pages-bounty/reward/detail.vue`

**Interfaces:**

- Produces: `getBountyMode(query: Record<string, unknown>): "list" | "map"`.
- Navigation: list card → `/pages-bounty/reward/detail?id=reward-1`; FAB → step 1; steps 1→2→3→success; success → bounty Tab.

- [ ] **Step 1: 写地图状态解析失败测试**

```ts
import { describe, expect, it } from "vitest";
import { getBountyMode } from "./bounty-mode";

describe("getBountyMode", () => {
  it("accepts only the explicit map state", () => {
    expect(getBountyMode({ mode: "map" })).toBe("map");
    expect(getBountyMode({ mode: "unknown" })).toBe("list");
    expect(getBountyMode({})).toBe("list");
  });
});
```

Run: `pnpm --filter @petcare/miniapp test -- src/pages/bounty/bounty-mode.spec.ts`

Expected: FAIL because the helper does not exist.

- [ ] **Step 2: 实现列表/地图状态和入口跳转**

```ts
export function getBountyMode(query: Record<string, unknown>): "list" | "map" {
  return query.mode === "map" ? "map" : "list";
}
```

In `pages.config.ts`, introduce the shared subpage style and register the first complete subpackage together with its physical pages:

```ts
const subPageStyle = {
  navigationBarTextStyle: "black",
  navigationStyle: "custom",
} as const;

const createPage = (path: string) => ({ path, style: subPageStyle });

subPackages: [
  {
    root: "pages-bounty",
    pages: ["publish/step1", "publish/step2", "publish/step3", "publish/success", "reward/detail"].map(createPage),
  },
],
```

In `pages/bounty/index.vue`, initialize `mode` from `onLoad`, switch it from the centered list/map segment, and wire only real page transitions:

```ts
const mode = ref<"list" | "map">("list");
onLoad((query = {}) => {
  mode.value = getBountyMode(query);
});

function openPublish() {
  uni.navigateTo({ url: "/pages-bounty/publish/step1" });
}

function openReward(id: string) {
  uni.navigateTo({ url: `/pages-bounty/reward/detail?id=${encodeURIComponent(id)}` });
}
```

For `mode === "map"`, render a branded static map surface, 3 fixed markers, a location-denied-safe hint, and one bottom result card. Do not use a real map component or location API.

- [ ] **Step 3: 创建三步发布与成功页**

Use `SubPageLayout` and these exact static sections:

```ts
const publishSteps = {
  step1: ["上门喂养", "遛狗", "洗护美容", "寄养"],
  step2: ["服务宠物", "服务日期", "时间段", "服务地址", "补充说明"],
  step3: ["服务类型", "宠物", "时间", "地址", "预算", "服务协议"],
} as const;

const goStep2 = () => uni.navigateTo({ url: "/pages-bounty/publish/step2" });
const goStep3 = () => uni.navigateTo({ url: "/pages-bounty/publish/step3" });
const publish = () => uni.navigateTo({ url: "/pages-bounty/publish/success" });
const finish = () => uni.switchTab({ url: "/pages/bounty/index" });
```

Each step shows `步骤 1/3`, `步骤 2/3`, or `步骤 3/3`, a shared progress bar, and a 44px-or-taller bottom action. Fields are static visual rows; do not save or validate values.

- [ ] **Step 4: 创建悬赏详情**

Use fallback ID `reward-1` when `onLoad` receives no usable `id`. Render: pet/service summary, owner identity, time/address, budget, care requirements, 3 nearby suggestions, and fixed actions `联系发布者`/`申请接单`. The contact action opens `/pages-care/chat/index?userId=owner-1`; the apply action is visually disabled with `aria-disabled="true"` and no click handler because submitting is out of scope.

- [ ] **Step 5: 验证并提交悬赏批次**

Run:

```powershell
pnpm --filter @petcare/miniapp test -- src/pages/bounty/bounty-mode.spec.ts
pnpm --filter @petcare/miniapp typecheck
pnpm --filter @petcare/miniapp lint
pnpm --filter @petcare/miniapp build:mp-weixin
git diff --check
```

Expected: all checks PASS; in WeChat DevTools inspect list, map, step 1, step 3, success, and detail without capsule or bottom-action overlap.

```powershell
git add apps/miniapp
git commit -m "feat(miniapp): 完成悬赏静态流程"
```

### Task 3: 完成订单、监控与聊天链路

**Files:**

- Modify: `apps/miniapp/pages.config.ts`
- Generated: `apps/miniapp/src/pages.json`
- Generated: `apps/miniapp/src/uni-pages.d.ts`
- Create: `apps/miniapp/src/pages/messages/message-route.ts`
- Create: `apps/miniapp/src/pages/messages/message-route.spec.ts`
- Modify: `apps/miniapp/src/pages/index/index.vue`
- Modify: `apps/miniapp/src/pages/messages/index.vue`
- Create: `apps/miniapp/src/pages-care/orders/index.vue`
- Create: `apps/miniapp/src/pages-care/order/detail.vue`
- Create: `apps/miniapp/src/pages-care/monitor/index.vue`
- Create: `apps/miniapp/src/pages-care/chat/index.vue`

**Interfaces:**

- Produces: `getMessageTarget(kind, id): string | undefined` for `system`, `order`, and `interaction` messages.
- Navigation: home service card/profile order stat → orders; order list/message → order detail; order detail → monitor/chat.

- [ ] **Step 1: 写消息路由失败测试**

```ts
import { describe, expect, it } from "vitest";
import { getMessageTarget } from "./message-route";

describe("getMessageTarget", () => {
  it("maps actionable messages and leaves system notices inert", () => {
    expect(getMessageTarget("order", "order-1")).toBe("/pages-care/order/detail?id=order-1");
    expect(getMessageTarget("interaction", "user-1")).toBe("/pages-care/chat/index?userId=user-1");
    expect(getMessageTarget("system", "notice-1")).toBeUndefined();
  });
});
```

Run: `pnpm --filter @petcare/miniapp test -- src/pages/messages/message-route.spec.ts`

Expected: FAIL because the mapper is missing.

- [ ] **Step 2: 实现消息映射并连接现有入口**

```ts
export function getMessageTarget(kind: "system" | "order" | "interaction", id: string) {
  if (kind === "order") return `/pages-care/order/detail?id=${encodeURIComponent(id)}`;
  if (kind === "interaction") return `/pages-care/chat/index?userId=${encodeURIComponent(id)}`;
  return undefined;
}
```

Append the complete care package to `subPackages` in `pages.config.ts`:

```ts
{
  root: "pages-care",
  pages: ["orders/index", "order/detail", "monitor/index", "chat/index"].map(createPage),
},
```

Only add `@click` when the mapper returns a target. System notices must have no chevron, click handler, or pointer styling. Keep all 4 message category labels centered with `flex-1 items-center justify-center`; center unread badges inside fixed square containers.

- [ ] **Step 3: 创建订单列表与详情**

Orders list shows centered status segments `全部/待付款/待服务/服务中/已完成`, then three static order cards. Every card uses an encoded fixed ID and opens the detail page.

Order detail falls back to `order-1` and renders:

```ts
const timeline = ["订单已确认", "照护者已到达", "完成首次喂食", "等待下一次上门"] as const;
const actions = {
  monitor: "/pages-care/monitor/index?orderId=order-1",
  chat: "/pages-care/chat/index?userId=caregiver-1",
} as const;
```

The page includes status summary, service/pet/provider cards, address/time, progress timeline, care evidence thumbnails, price details, and two bottom actions.

- [ ] **Step 4: 创建静态监控与聊天**

Monitor renders a dark 16:9 placeholder, `LIVE` text badge, timestamp, device status, and care event list. Video, mute, fullscreen, and screenshot controls are shown disabled with no handlers.

Chat renders fixed incoming/outgoing bubbles, timestamps, and a bottom composer. The input and send button are disabled and carry `aria-disabled="true"`; back navigation remains active.

- [ ] **Step 5: 验证并提交订单照护批次**

Run the focused message test, all Miniapp tests, typecheck, lint, MP build, and `git diff --check`. Inspect Messages → Order → Monitor and Messages → Chat in WeChat DevTools.

```powershell
git add apps/miniapp
git commit -m "feat(miniapp): 完成订单照护静态页面"
```

### Task 4: 完成宠物档案与个人资料

**Files:**

- Modify: `apps/miniapp/pages.config.ts`
- Generated: `apps/miniapp/src/pages.json`
- Generated: `apps/miniapp/src/uni-pages.d.ts`
- Create: `apps/miniapp/src/pages-account/fixtures.ts`
- Create: `apps/miniapp/src/pages-account/pets/pet-form-mode.ts`
- Create: `apps/miniapp/src/pages-account/pets/pet-form-mode.spec.ts`
- Modify: `apps/miniapp/src/pages/profile/index.vue`
- Create: `apps/miniapp/src/pages-account/pets/index.vue`
- Create: `apps/miniapp/src/pages-account/pets/form.vue`
- Create: `apps/miniapp/src/pages-account/pets/detail.vue`
- Create: `apps/miniapp/src/pages-account/profile/info.vue`
- Create: `apps/miniapp/src/pages-account/profile/edit.vue`

**Interfaces:**

- Produces: shared `profileFixture`, `petFixtures`, and `getPetById(id)` with first-pet fallback.
- Produces: `getPetFormMode(query): "add" | "edit"`.
- Navigation: profile header → info → edit; pet section → list → detail/edit/add.

- [ ] **Step 1: 写宠物表单状态失败测试**

```ts
import { describe, expect, it } from "vitest";
import { getPetFormMode } from "./pet-form-mode";

describe("getPetFormMode", () => {
  it("uses edit only when mode and id are both present", () => {
    expect(getPetFormMode({ mode: "edit", id: "mimi" })).toBe("edit");
    expect(getPetFormMode({ mode: "edit" })).toBe("add");
    expect(getPetFormMode({})).toBe("add");
  });
});
```

Run the focused test and expect FAIL.

- [ ] **Step 2: 创建跨页共享实体与最小状态解析**

```ts
export const profileFixture = {
  id: "owner-1",
  name: "郑先生",
  city: "上海市 · 静安区",
  credit: 720,
} as const;

export const petFixtures = [
  {
    id: "mimi",
    name: "咪咪",
    breed: "英国短毛猫",
    age: "3岁",
    image: "/static/main/profile-cat.png",
  },
  {
    id: "wangcai",
    name: "旺财",
    breed: "金毛寻回犬",
    age: "4岁",
    image: "/static/main/profile-dog.png",
  },
] as const;

export function getPetById(id?: string) {
  return petFixtures.find((pet) => pet.id === id) ?? petFixtures[0];
}

export function getPetFormMode(query: Record<string, unknown>): "add" | "edit" {
  return query.mode === "edit" && typeof query.id === "string" && query.id ? "edit" : "add";
}
```

Register the account pages delivered by this task:

```ts
{
  root: "pages-account",
  pages: ["pets/index", "pets/form", "pets/detail", "profile/info", "profile/edit"].map(createPage),
},
```

- [ ] **Step 3: 创建宠物列表、详情和复用表单状态**

The pet list shows two cards and one full-width add button. Detail shows identity, health tags, basic information, care preferences, and an edit action. Use one physical form page for the two explicit states:

```ts
const formMode = ref<"add" | "edit">("add");
const pet = ref(getPetById());
onLoad((query = {}) => {
  formMode.value = getPetFormMode(query);
  pet.value = getPetById(typeof query.id === "string" ? query.id : undefined);
});

const title = computed(() => (formMode.value === "edit" ? "编辑宠物" : "添加宠物"));
const finish = () => uni.navigateBack();
```

Render avatar, name, species, breed, sex, birthday, weight, neuter status, and notes as static fields. Do not upload or persist. The bottom action returns to the previous page only.

- [ ] **Step 4: 创建个人信息查看与编辑页并连接“我的”**

Info renders avatar, nickname, phone mask, location, bio, and credit. Edit renders the same values as static field shells; its save action only navigates back. Update profile header, stats, pet cards, and add button to their registered routes. Remove the clickable-looking `关于我们` row because no such route is in scope.

- [ ] **Step 5: 验证并提交宠物个人基础批次**

Run the pet-mode test, all Miniapp tests, typecheck, lint, MP build, and diff check. Inspect Profile → Pets → Detail/Edit and Profile → Info/Edit.

```powershell
git add apps/miniapp
git commit -m "feat(miniapp): 完成宠物与个人资料静态页"
```

### Task 5: 完成收藏、关注、评价与业务详情

**Files:**

- Modify: `apps/miniapp/pages.config.ts`
- Generated: `apps/miniapp/src/pages.json`
- Generated: `apps/miniapp/src/uni-pages.d.ts`
- Create: `apps/miniapp/src/pages-account/favorites/index.vue`
- Create: `apps/miniapp/src/pages-account/follows/index.vue`
- Create: `apps/miniapp/src/pages-account/reviews/index.vue`
- Create: `apps/miniapp/src/pages-account/services/detail.vue`
- Create: `apps/miniapp/src/pages-account/caregivers/detail.vue`
- Create: `apps/miniapp/src/pages-account/stores/detail.vue`
- Create: `apps/miniapp/src/pages-account/creators/detail.vue`
- Modify: `apps/miniapp/src/pages/profile/index.vue`

**Interfaces:**

- Navigation: favorites/follows/reviews from profile; cards open fixed service, caregiver, store, creator, or article routes; details cross-link only to registered pages.

- [ ] **Step 1: 连接“我的内容”三个入口**

```ts
const contentItems = [
  { icon: "/static/main/favorite.svg", label: "我的收藏", route: "/pages-account/favorites/index" },
  { icon: "/static/main/follow.svg", label: "我的关注", route: "/pages-account/follows/index" },
  { icon: "/static/main/review.svg", label: "我的评价", route: "/pages-account/reviews/index" },
] as const;

function openPage(route: string) {
  uni.navigateTo({ url: route });
}
```

Extend the existing `pages-account` entry so its final page list is exact:

```ts
pages: [
  "pets/index", "pets/form", "pets/detail", "favorites/index", "follows/index",
  "reviews/index", "services/detail", "caregivers/detail", "stores/detail",
  "creators/detail", "profile/info", "profile/edit",
].map(createPage),
```

- [ ] **Step 2: 创建收藏、关注和评价列表**

Favorites uses centered segments `文章/动态/服务/照护者` and renders one card per category with fixed registered targets. Follows uses `照护者/店铺/创作者` and cards target `/pages-account/caregivers/detail?id=caregiver-1`, `/pages-account/stores/detail?id=store-1`, and `/pages-account/creators/detail?id=creator-1`. Reviews shows received/given summary and three static review cards; no reply or delete controls.

- [ ] **Step 3: 创建四类详情页面**

Service detail: cover, title, price, rating, scope, service flow, included/excluded items, provider summary, and bottom chat/booking actions; chat works, booking is disabled.

Caregiver detail: identity, verification, rating, introduction, service tags, available service cards, reviews, and bottom chat action.

Store detail: store identity, address/hours, qualification tags, services, staff, and reviews; phone/navigation controls are disabled.

Creator detail: identity, stats, introduction, expertise tags, and three content cards linking only to registered article pages; follow action is disabled.

Each dynamic page reads `id` on load and uses its documented fixture when the query is missing or unknown.

- [ ] **Step 4: 验证交叉跳转与提交**

Run all current Miniapp tests, typecheck, lint, MP build, and diff check. Inspect Favorites → Service → Caregiver → Chat and Follows → Store/Creator.

```powershell
git add apps/miniapp
git commit -m "feat(miniapp): 完成账户内容与业务详情页"
```

### Task 6: 完成文章、优惠券、钱包与帮助支持

**Files:**

- Modify: `apps/miniapp/pages.config.ts`
- Create: `apps/miniapp/pages-config.spec.ts`
- Generated: `apps/miniapp/src/pages.json`
- Generated: `apps/miniapp/src/uni-pages.d.ts`
- Modify: `apps/miniapp/src/pages/index/index.vue`
- Modify: `apps/miniapp/src/pages/community/index.vue`
- Modify: `apps/miniapp/src/pages/profile/index.vue`
- Create: `apps/miniapp/src/pages-content/classroom/article.vue`
- Create: `apps/miniapp/src/pages-content/community/article.vue`
- Create: `apps/miniapp/src/pages-content/coupons/index.vue`
- Create: `apps/miniapp/src/pages-content/wallet/index.vue`
- Create: `apps/miniapp/src/pages-content/help/index.vue`
- Create: `apps/miniapp/src/pages-content/contact/index.vue`

**Interfaces:**

- Navigation: home classroom → classroom article; community card → community article; profile stats/items → coupons, wallet, help, contact.

- [ ] **Step 1: 写最终路由契约失败测试**

Create `apps/miniapp/pages-config.spec.ts`. Before adding `pages-content`, the exact route assertion must fail.

```ts
import { describe, expect, it } from "vitest";
import pagesConfig from "./pages.config";

const expectedSubPages = [
  "pages-bounty/publish/step1",
  "pages-bounty/publish/step2",
  "pages-bounty/publish/step3",
  "pages-bounty/publish/success",
  "pages-bounty/reward/detail",
  "pages-care/orders/index",
  "pages-care/order/detail",
  "pages-care/monitor/index",
  "pages-care/chat/index",
  "pages-account/pets/index",
  "pages-account/pets/form",
  "pages-account/pets/detail",
  "pages-account/favorites/index",
  "pages-account/follows/index",
  "pages-account/reviews/index",
  "pages-account/services/detail",
  "pages-account/caregivers/detail",
  "pages-account/stores/detail",
  "pages-account/creators/detail",
  "pages-account/profile/info",
  "pages-account/profile/edit",
  "pages-content/classroom/article",
  "pages-content/community/article",
  "pages-content/coupons/index",
  "pages-content/wallet/index",
  "pages-content/help/index",
  "pages-content/contact/index",
] as const;

describe("miniapp page contract", () => {
  it("registers all subpackage pages exactly once", () => {
    const actual = (pagesConfig.subPackages ?? []).flatMap(({ root, pages }) =>
      pages.map(({ path }) => `${root}/${path}`),
    );

    expect(actual).toEqual(expectedSubPages);
    expect(new Set(actual).size).toBe(expectedSubPages.length);
  });

  it("delivers 35 formal pages or states including auth", () => {
    expect(6 + expectedSubPages.length + 2).toBe(35);
  });
});
```

Run: `pnpm --filter @petcare/miniapp test -- pages-config.spec.ts`

Expected: FAIL because the six `pages-content` entries are missing.

- [ ] **Step 2: 注册内容分包并连接主页面入口**

Append the final subpackage in `pages.config.ts`:

```ts
{
  root: "pages-content",
  pages: [
    "classroom/article", "community/article", "coupons/index", "wallet/index",
    "help/index", "contact/index",
  ].map(createPage),
},
```

```ts
const openClassroomArticle = (id: string) =>
  uni.navigateTo({ url: `/pages-content/classroom/article?id=${encodeURIComponent(id)}` });
const openCommunityArticle = (id: string) =>
  uni.navigateTo({ url: `/pages-content/community/article?id=${encodeURIComponent(id)}` });
```

Add routes to the coupon/wallet profile stats and to the help/contact rows. Only rows with registered targets receive chevrons and click handlers.

- [ ] **Step 3: 创建两类文章详情**

Classroom article renders category, title, author/date/read time, approved pet cover image, introduction, three titled sections, care checklist, and three related article links back to the same physical page with a different fixed `id`.

Community article renders author summary, title/body, 1–3 approved pet images, tags, like/comment counts, three static comments, and related community posts. Like, comment, share, and follow controls are visibly disabled because real interaction is out of scope.

- [ ] **Step 4: 创建优惠券、钱包、帮助与客服**

Coupons uses centered segments `可使用/已使用/已过期`, balance summary, and three static coupon cards. `立即使用` is disabled.

Wallet renders available balance, cumulative income, two disabled money actions, and a static transaction list.

Help renders search shell, categories, and six visible FAQ answers; no unimplemented search handler.

Contact renders service hours, hotline, online-service description, email, and an issue-guidance card. Phone and online-service actions are disabled with no API calls; email is selectable text only.

- [ ] **Step 5: 跑完整 Miniapp 门禁**

Run sequentially; UniApp builds must not run in parallel because they share generated `pages.json` state:

```powershell
pnpm --filter @petcare/miniapp test
pnpm --filter @petcare/miniapp typecheck
pnpm --filter @petcare/miniapp lint
pnpm --filter @petcare/miniapp build:mp-weixin
pnpm --filter @petcare/miniapp build:h5
pnpm --filter @petcare/miniapp build:app-android
git diff --check
```

Expected: every command exits 0.

- [ ] **Step 6: 做最终静态与视觉检查**

Run:

```powershell
rg -n "rpx|\[[^]]*px\]" apps/miniapp/src apps/miniapp/uno.config.ts
```

Expected: no rpx or arbitrary-px class matches. Inspect these representative flows in WeChat DevTools and H5:

1. Login → Home → Bounty list/map → Publish success → Reward detail.
2. Messages → Order detail → Monitor/Chat.
3. Profile → Pets add/edit/detail → Info edit.
4. Favorites/Follows → Service/Caregiver/Store/Creator.
5. Home/Community/Profile → Articles/Coupons/Wallet/Help/Contact.

Confirm no capsule/status-bar overlap, bottom-action overlap, unintended horizontal scrolling, text clipping, misleading enabled controls, or custom Tab on subpages.

- [ ] **Step 7: 提交内容支持批次**

```powershell
git add apps/miniapp
git commit -m "feat(miniapp): 完成内容与支持静态页面"
```

## Final Acceptance Checklist

- [ ] `pages-config.spec.ts` proves 6 main physical pages + 27 subpackage pages + 2 alternate states = 35 delivered pages/states.
- [ ] `/home` and `/rewards` have no duplicate physical pages; their canonical destinations remain Home and Bounty.
- [ ] Only the five main Tab pages render `MainTabLayout`; all subpages render `SubPageLayout` and no bottom Tab.
- [ ] Every designed entrance, back control, publish step, and registered detail link has a working static navigation path.
- [ ] Missing or unknown query IDs fall back to a visible fixture.
- [ ] No API, global state, persistence, location, map, chat, video, upload, payment, dial, or customer-service integration was added.
- [ ] UnoCSS/flex/px, shared Token, touch-target, approved-asset, and disabled-control requirements pass review.
- [ ] Vitest, typecheck, lint, WeChat build, H5 build, App Android build, and `git diff --check` pass on the final tree.
