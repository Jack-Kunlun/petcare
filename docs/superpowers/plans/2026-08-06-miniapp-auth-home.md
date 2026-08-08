# Miniapp 登录页与首页品牌化 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在不改变 H5 原型首页布局顺序的前提下，完成 Miniapp 登录页与首页的 PetCare 品牌化改造，并使用安全区适配的自定义导航替代这两个页面的微信原生标题栏。

**Architecture:** 登录页保留现有认证编排，只重构视觉层；首页将原型数据与展示组件分离，由路由页组合登录状态、页面动作和静态内容。状态栏安全区和自定义 TabBar 保持独立，供后续一级页面复用，但本次不全局关闭其他页面的原生导航。

**Tech Stack:** Taro 4.2.1、React 18.3、TypeScript 6、Tailwind CSS 4 CSS-first、weapp-tailwindcss 5、Jest 30、Testing Library

## Global Constraints

- 首页模块顺序固定为：顶部信息、品牌轮播、服务状态、热门悬赏、养宠课堂、社区精选、底部导航。
- 登录页和首页使用 `navigationStyle: "custom"`；其他页面继续保留原生导航。
- 品牌主色固定为 `#4A6CF7`，陪伴辅助色固定为 `#5BC8AF`，悬赏强调色固定为 `#F6B343`。
- Miniapp 最终样式保持 `14px` 默认字号并关闭 px 到 rpx 转换。
- Miniapp 禁止任意值类、分数尺寸、值编码类、动态类名、变体、`rem/rpx` 和页面级 CSS/SCSS。
- 新尺寸必须先进入 `apps/miniapp/src/app.css` 的 `@theme`，再通过语义类使用。
- 首页原型静态图片只从 `apps/miniapp/src/assets` 导入，不引用 H5 原型中的外部图片 URL；真实用户头像继续使用现有用户契约提供的地址。
- 不新增 npm 依赖，不修改服务端、数据库或 Admin。
- 所有触控目标不小于 `44px × 44px`，相邻触控目标至少间隔 `8px`。
- 请求和响应契约继续使用 `@petcare/shared-types`；页面原型数据类型的每个字段必须有 JSDoc。

---

## File Structure

### Create

- `apps/miniapp/src/components/layout/StatusBarSpacer.tsx`：读取微信状态栏高度并输出纯间距容器。
- `apps/miniapp/src/components/layout/StatusBarSpacer.test.tsx`：验证状态栏高度和缺省回退。
- `apps/miniapp/src/pages/navigation.config.test.ts`：验证仅登录页与首页关闭原生导航。
- `apps/miniapp/src/pages/index/home.data.ts`：集中定义首页原型数据、字段类型和本地图片引用。
- `apps/miniapp/src/pages/index/components/HomeHeader.tsx`：问候、头像、定位和消息入口。
- `apps/miniapp/src/pages/index/components/HeroCarousel.tsx`：品牌轮播和单一主行动。
- `apps/miniapp/src/pages/index/components/ServiceOverview.tsx`：加载、游客、进行中服务和空状态。
- `apps/miniapp/src/pages/index/components/ServiceOverview.test.tsx`：验证服务区域的四种状态。
- `apps/miniapp/src/pages/index/components/BountySection.tsx`：热门悬赏横向列表。
- `apps/miniapp/src/pages/index/components/ClassroomSection.tsx`：课堂文章列表。
- `apps/miniapp/src/pages/index/components/CommunitySection.tsx`：社区内容信息流。
- `apps/miniapp/src/assets/navigation/*-{default,active}.svg`：五项底部导航的 24px 双状态图标。

### Modify

- `apps/miniapp/src/app.css`：增加登录、首页、动画和底部导航语义 token。
- `apps/miniapp/src/pages/auth/index.config.ts`：启用自定义导航。
- `apps/miniapp/src/pages/auth/index.tsx`：实现沉浸式品牌登录页。
- `apps/miniapp/src/pages/auth/index.test.tsx`：验证新视觉结构且保留认证闭环。
- `apps/miniapp/src/pages/index/index.config.ts`：启用自定义导航。
- `apps/miniapp/src/pages/index/index.tsx`：组合首页组件、登录态和路由动作。
- `apps/miniapp/src/pages/index/index.test.tsx`：覆盖首页模块顺序、状态和路由。
- `apps/miniapp/src/custom-tab-bar/index.tsx`：使用本地图标、品牌选中态、未读角标和安全区。
- `apps/miniapp/src/custom-tab-bar/index.test.tsx`：覆盖图标状态、角标和切换行为。

---

### Task 1: 自定义导航与状态栏安全区基础

**Files:**

- Create: `apps/miniapp/src/components/layout/StatusBarSpacer.tsx`
- Create: `apps/miniapp/src/components/layout/StatusBarSpacer.test.tsx`
- Create: `apps/miniapp/src/pages/navigation.config.test.ts`
- Modify: `apps/miniapp/src/pages/auth/index.config.ts`
- Modify: `apps/miniapp/src/pages/index/index.config.ts`

**Interfaces:**

- Produces: `StatusBarSpacer(): JSX.Element`
- Consumes: `Taro.getWindowInfo(): { statusBarHeight?: number }`
- Invariant: 状态栏高度缺失时使用 `0`，组件不接收动态 `className`。

- [ ] **Step 1: 写状态栏和页面配置失败测试**

```tsx
// StatusBarSpacer.test.tsx
jest.mock("@tarojs/taro", () => ({
  __esModule: true,
  default: { getWindowInfo: jest.fn() },
}));

it("uses the current WeChat status bar height", () => {
  jest.mocked(Taro.getWindowInfo).mockReturnValue({ statusBarHeight: 24 } as never);
  render(<StatusBarSpacer />);
  expect(screen.getByTestId("status-bar-spacer")).toHaveStyle({ height: "24px" });
});

it("falls back to zero when status bar height is unavailable", () => {
  jest.mocked(Taro.getWindowInfo).mockReturnValue({} as never);
  render(<StatusBarSpacer />);
  expect(screen.getByTestId("status-bar-spacer")).toHaveStyle({ height: "0px" });
});
```

```ts
// navigation.config.test.ts
import authConfig from "./auth/index.config";
import bountyConfig from "./bounty/index.config";
import indexConfig from "./index/index.config";

it("uses custom navigation only on the redesigned entry pages", () => {
  expect(authConfig.navigationStyle).toBe("custom");
  expect(indexConfig.navigationStyle).toBe("custom");
  expect(bountyConfig).not.toHaveProperty("navigationStyle", "custom");
});
```

- [ ] **Step 2: 运行测试并确认失败**

Run:

```bash
pnpm --filter @petcare/miniapp exec jest src/components/layout/StatusBarSpacer.test.tsx src/pages/navigation.config.test.ts --runInBand
```

Expected: FAIL，原因分别为 `StatusBarSpacer` 不存在和页面配置缺少 `navigationStyle: "custom"`。

- [ ] **Step 3: 实现最小安全区组件和页面配置**

```tsx
// StatusBarSpacer.tsx
import { View } from "@tarojs/components";
import Taro from "@tarojs/taro";

/** 为自定义导航页面预留微信状态栏高度。 */
export default function StatusBarSpacer() {
  const statusBarHeight = Taro.getWindowInfo().statusBarHeight ?? 0;

  return (
    <View
      className="w-full shrink-0"
      style={{ height: `${statusBarHeight}px` }}
      data-testid="status-bar-spacer"
    />
  );
}
```

```ts
// auth/index.config.ts 与 index/index.config.ts
export default {
  navigationStyle: "custom",
};
```

首页配置保留现有 `usingComponents: {}`；登录页不再设置 `navigationBarTitleText`。

- [ ] **Step 4: 运行测试并确认通过**

Run:

```bash
pnpm --filter @petcare/miniapp exec jest src/components/layout/StatusBarSpacer.test.tsx src/pages/navigation.config.test.ts --runInBand
```

Expected: 2 个测试文件全部 PASS。

- [ ] **Step 5: 提交**

```bash
git add apps/miniapp/src/components/layout apps/miniapp/src/pages/navigation.config.test.ts apps/miniapp/src/pages/auth/index.config.ts apps/miniapp/src/pages/index/index.config.ts
git commit -m "feat(miniapp): 增加自定义导航安全区基础"
```

---

### Task 2: 重构沉浸式微信登录页

**Files:**

- Modify: `apps/miniapp/src/app.css`
- Modify: `apps/miniapp/src/pages/auth/index.tsx`
- Modify: `apps/miniapp/src/pages/auth/index.test.tsx`

**Interfaces:**

- Consumes: `StatusBarSpacer`、`BrandLogo`、`useAuth().login()`、`useAuth().bindPhone()`。
- Produces: 保持 `AuthPage(): JSX.Element` 和 `completeLogin(): Promise<void>` 行为不变。
- Invariant: 登录按钮继续使用 `openType="getPhoneNumber"`，成功后只调用 `Taro.switchTab`。

- [ ] **Step 1: 扩展登录页测试描述新视觉契约**

在保留现有 7 个认证测试的基础上，替换旧样式断言并新增结构断言：

```tsx
it("renders the immersive PetCare login composition", () => {
  const { container } = render(<AuthPage />);

  expect(container.firstElementChild).toHaveClass(
    "min-h-screen",
    "bg-linear-to-b",
    "from-surface-brand",
    "to-surface",
  );
  expect(screen.getByLabelText("PetCare 宠伴品牌 Logo")).toBeInTheDocument();
  expect(screen.getByText("让每一次托付，都安心可见")).toBeInTheDocument();
  expect(screen.getByText("微信手机号快捷登录")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "微信登录" })).toHaveClass("h-control", "bg-brand");
});

it("keeps a stable card height while showing an error", async () => {
  mockPhoneDetail = { errMsg: "getPhoneNumber:fail user deny" };
  render(<AuthPage />);
  fireEvent.click(screen.getByRole("button", { name: "微信登录" }));

  expect(await screen.findByText("需要授权手机号才能完成登录，请重试")).toBeInTheDocument();
  expect(screen.getByTestId("auth-card")).toHaveClass("min-h-auth-card");
});
```

同时在 `@tarojs/taro` mock 中加入：

```ts
getWindowInfo: jest.fn(() => ({ statusBarHeight: 24 })),
```

- [ ] **Step 2: 运行登录页测试并确认失败**

Run:

```bash
pnpm --filter @petcare/miniapp exec jest src/pages/auth/index.test.tsx --runInBand
```

Expected: 新视觉文案、结构和 token 断言 FAIL，原有认证流程测试保持 PASS。

- [ ] **Step 3: 在 `app.css` 增加登录页语义 token**

将以下 token 合并进现有 `@theme`，不删除现有 token：

```css
--color-surface-brand: #eef2ff;
--color-surface-soft: #f6f8ff;
--spacing-control: 44px;
--spacing-auth-card: 300px;
--spacing-auth-visual: 220px;
--spacing-feedback: 20px;
--spacing-page-x: 16px;
--radius-panel: 20px;
--shadow-panel: 0 12px 32px rgb(31 41 55 / 10%);
--animate-page-enter: page-enter 240ms ease-out both;
```

在 `@theme` 之后增加：

```css
@keyframes page-enter {
  from {
    opacity: 0;
    transform: translateY(12px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@media (prefers-reduced-motion: reduce) {
  .animate-page-enter {
    animation-duration: 0ms;
  }
}
```

- [ ] **Step 4: 重写登录页展示层**

页面根节点固定使用静态 Tailwind 类名：

```tsx
<View className="box-border flex min-h-screen flex-col bg-linear-to-b from-surface-brand to-surface px-page-x pb-page-y">
  <StatusBarSpacer />
  <View className="flex h-auth-visual flex-col items-center justify-center animate-page-enter">
    <BrandLogo label="PetCare 宠伴品牌 Logo" />
    <Text className="mt-compact block text-welcome font-bold text-ink-strong">
      让每一次托付，都安心可见
    </Text>
    <Text className="mt-note block text-center text-base text-muted-brand">
      可信赖的宠物生活服务平台
    </Text>
  </View>
  <View
    className="box-border min-h-auth-card w-full rounded-panel bg-white px-section py-page shadow-panel animate-page-enter"
    data-testid="auth-card"
  >
    <Text className="block text-heading font-bold text-ink-strong">欢迎来到 PetCare 宠伴</Text>
    <Text className="mt-note block text-description text-muted-brand">微信手机号快捷登录</Text>
    <Button
      className="mt-section h-control rounded-button border-none bg-brand text-white"
      hoverClass="opacity-80"
      openType="getPhoneNumber"
      loading={pending}
      disabled={pending}
      onGetPhoneNumber={handleWechatLogin}
    >
      {pending ? "正在登录" : "微信登录"}
    </Button>
    <View className="mt-note min-h-feedback">
      {error ? <Text className="block text-base text-danger">{error}</Text> : null}
    </View>
    <Text className="mt-compact block text-center text-base text-muted-brand">
      登录即代表你同意授权必要的微信账号与手机号信息
    </Text>
  </View>
</View>
```

按钮增加 `h-control`，并把 `opacity-80` 加入 `app.css` 现有的 `@source inline` 类名清单；不得使用 `active:` 变体。错误区域通过 `min-h-feedback` 始终保留高度，只有有错误时渲染文本。

- [ ] **Step 5: 运行登录页与样式策略测试**

Run:

```bash
pnpm --filter @petcare/miniapp exec jest src/pages/auth/index.test.tsx --runInBand
pnpm --filter @petcare/miniapp lint:styles
```

Expected: 登录页测试全部 PASS，样式策略输出 `样式策略检查通过：miniapp`。

- [ ] **Step 6: 提交**

```bash
git add apps/miniapp/src/app.css apps/miniapp/src/pages/auth/index.tsx apps/miniapp/src/pages/auth/index.test.tsx
git commit -m "feat(miniapp): 优化沉浸式登录页面"
```

---

### Task 3: 建立首页数据模型、顶部与轮播组件

**Files:**

- Create: `apps/miniapp/src/pages/index/home.data.ts`
- Create: `apps/miniapp/src/pages/index/components/HomeHeader.tsx`
- Create: `apps/miniapp/src/pages/index/components/HeroCarousel.tsx`
- Modify: `apps/miniapp/src/app.css`
- Modify: `apps/miniapp/src/pages/index/index.tsx`
- Modify: `apps/miniapp/src/pages/index/index.test.tsx`

**Interfaces:**

- Produces: `HomeBanner`、`HomeService`、`HomeBounty`、`HomeArticle`、`HomePost` 及对应只读常量。
- Produces: `HomeHeader({ nickname, avatar, location, hasUnread, onMessages })`。
- Produces: `HeroCarousel({ banners, onAction })`。
- Consumes: 现有三张 `apps/miniapp/src/assets/brand/hero-*-miniapp-v1.png`。

- [ ] **Step 1: 添加顶部和轮播失败测试**

在 `index.test.tsx` 的 Taro mock 中加入 `switchTab` 和 `getWindowInfo`，并新增：

```tsx
it("renders the prototype header and switches to the messages tab", () => {
  renderAuthenticatedHome();

  expect(screen.getByText("早上好")).toBeInTheDocument();
  expect(screen.getByText("上海市 · 静安区")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "打开消息" }));
  expect(Taro.switchTab).toHaveBeenCalledWith({ url: "/pages/messages/index" });
});

it("renders three local brand banners in prototype order", () => {
  renderAuthenticatedHome();
  expect(screen.getAllByTestId("home-banner")).toHaveLength(3);
  expect(screen.getByText("毛孩子 · 专业上门宠物服务")).toBeInTheDocument();
  expect(screen.getByText("每一次照护，都有清晰记录")).toBeInTheDocument();
});
```

测试中固定系统时间为上午，`afterEach` 恢复真实计时器，避免问候文案不稳定。

- [ ] **Step 2: 运行首页测试并确认失败**

Run:

```bash
pnpm --filter @petcare/miniapp exec jest src/pages/index/index.test.tsx --runInBand
```

Expected: 新顶部文案、路由方式和三张轮播断言 FAIL。

- [ ] **Step 3: 定义首页数据类型与本地数据**

先在 `app.css` 的 `@theme` 中定义 `--spacing-home-banner: 158px`，确保 `HeroCarousel` 使用的静态 `h-home-banner` 类在本任务即可生成；Task 4 不再重复添加该 token。

`home.data.ts` 中每个字段添加用途 JSDoc，核心接口如下：

```ts
export interface HomeBanner {
  /** 稳定的轮播项标识。 */
  id: string;
  /** Miniapp 打包后的本地品牌图片。 */
  image: string;
  /** 轮播主标题。 */
  title: string;
  /** 轮播辅助说明。 */
  subtitle: string;
  /** 单一主行动文案。 */
  actionLabel: string;
  /** 主行动对应的一级 Tab 路径。 */
  actionPath: string;
}

export interface HomeService {
  /** 进行中服务的稳定标识。 */
  id: string;
  /** 宠物头像的本地图片地址。 */
  petAvatar: string;
  /** 宠物展示名称。 */
  petName: string;
  /** 宠物品种说明。 */
  petBreed: string;
  /** 当前服务类型与执行轮次。 */
  serviceType: string;
  /** 当前宠托师展示名称。 */
  caregiverName: string;
  /** 取值 0 到 100 的服务完成百分比。 */
  progress: number;
  /** 预计完成时间。 */
  estimatedTime: string;
}

export interface HomeBounty {
  /** 悬赏稳定标识。 */
  id: string;
  /** 宠物类型。 */
  petType: string;
  /** 宠物缩略图的本地图片地址。 */
  image: string;
  /** 服务类型。 */
  serviceType: string;
  /** 服务需求摘要。 */
  description: string;
  /** 格式化后的悬赏价格。 */
  price: string;
  /** 格式化后的距离。 */
  distance: string;
  /** 服务持续时间。 */
  duration: string;
  /** 是否展示紧急标记。 */
  urgent: boolean;
}

export interface HomeArticle {
  /** 文章稳定标识。 */
  id: string;
  /** 文章缩略图的本地图片地址。 */
  image: string;
  /** 文章标题。 */
  title: string;
  /** 浏览次数。 */
  views: number;
  /** ISO 日期格式的发布日期。 */
  publishDate: string;
  /** 文章分类。 */
  category: string;
}

export interface HomePost {
  /** 帖子稳定标识。 */
  id: string;
  /** 作者头像的本地图片地址。 */
  authorAvatar: string;
  /** 作者展示名称。 */
  authorName: string;
  /** 相对发布时间。 */
  publishedAt: string;
  /** 作者发布位置。 */
  location: string;
  /** 帖子正文。 */
  content: string;
  /** 帖子媒体的本地图片地址；没有媒体时为空。 */
  image: string | null;
  /** 点赞数量。 */
  likes: number;
  /** 评论数量。 */
  comments: number;
}
```

三个轮播项固定为：

| id                    | title                     | subtitle                     | actionLabel  | actionPath               |
| --------------------- | ------------------------- | ---------------------------- | ------------ | ------------------------ |
| `professional-care`   | 毛孩子 · 专业上门宠物服务 | 每一次照护，都有清晰记录     | 立即预约服务 | `/pages/bounty/index`    |
| `trusted-care`        | 每一次托付，都值得信赖    | 认证宠托师，服务进度安心可见 | 查看附近服务 | `/pages/bounty/index`    |
| `community-companion` | 和同城宠友一起成长        | 分享真实经验，遇见可靠伙伴   | 探索宠物社区 | `/pages/community/index` |

导出 `HOME_BANNERS`、`HOME_ONGOING_SERVICE`、`HOME_BOUNTIES`、`HOME_ARTICLES` 和 `HOME_POSTS`，所有图片字段引用上述三张本地品牌图片。

除轮播表格外，其余首页原型数据固定为：

```ts
export const HOME_ONGOING_SERVICE: HomeService = {
  id: "service-1",
  petAvatar: heroCommunity,
  petName: "咪咪",
  petBreed: "英短蓝猫",
  serviceType: "上门喂养 · 第 2 次服务",
  caregiverName: "林小雨",
  progress: 65,
  estimatedTime: "12:30",
};

export const HOME_BOUNTIES: readonly HomeBounty[] = [
  {
    id: "bounty-1",
    petType: "猫咪",
    image: heroCommunity,
    serviceType: "上门喂养",
    description: "需要每天上门喂两只猫并清理猫砂",
    price: "¥50/天",
    distance: "1.5km",
    duration: "3天",
    urgent: true,
  },
  {
    id: "bounty-2",
    petType: "狗狗",
    image: heroProfessional,
    serviceType: "遛狗服务",
    description: "每天早晚各遛一次，每次 30 分钟",
    price: "¥35/次",
    distance: "2.0km",
    duration: "7天",
    urgent: false,
  },
  {
    id: "bounty-3",
    petType: "猫咪",
    image: heroTrusted,
    serviceType: "宠物寄养",
    description: "出差一周，需要寄养一只英短蓝猫",
    price: "¥80/天",
    distance: "3.2km",
    duration: "7天",
    urgent: false,
  },
];

export const HOME_ARTICLES: readonly HomeArticle[] = [
  {
    id: "article-1",
    image: heroCommunity,
    title: "猫咪日常护理指南：从梳毛到剪指甲",
    views: 2340,
    publishDate: "2026-07-15",
    category: "健康",
  },
  {
    id: "article-2",
    image: heroProfessional,
    title: "新手养狗必看：幼犬喂养注意事项",
    views: 1856,
    publishDate: "2026-07-14",
    category: "喂养",
  },
  {
    id: "article-3",
    image: heroTrusted,
    title: "如何训练狗狗定点上厕所？",
    views: 3120,
    publishDate: "2026-07-13",
    category: "行为",
  },
  {
    id: "article-4",
    image: heroCommunity,
    title: "宠物夏季防暑降温小贴士",
    views: 1567,
    publishDate: "2026-07-12",
    category: "健康",
  },
];

export const HOME_POSTS: readonly HomePost[] = [
  {
    id: "post-1",
    authorAvatar: heroCommunity,
    authorName: "小萌",
    publishedAt: "2小时前",
    location: "静安区",
    content: "今天带我家布偶体验了第一次上门喂养，照护记录很清楚，也收到了不少照片和视频。",
    image: heroCommunity,
    likes: 42,
    comments: 8,
  },
  {
    id: "post-2",
    authorAvatar: heroProfessional,
    authorName: "大壮",
    publishedAt: "5小时前",
    location: "浦东新区",
    content: "周末带狗狗去宠物公园玩，遇到了许多新伙伴，也积累了新的社交经验。",
    image: heroProfessional,
    likes: 67,
    comments: 15,
  },
  {
    id: "post-3",
    authorAvatar: heroTrusted,
    authorName: "小美",
    publishedAt: "昨天",
    location: "徐汇区",
    content: "分享一个实用的猫咪梳毛技巧：顺着毛发生长方向轻轻梳理，过程会更舒适。",
    image: null,
    likes: 89,
    comments: 23,
  },
];
```

- [ ] **Step 4: 实现 `HomeHeader` 与 `HeroCarousel`**

`HomeHeader` 通过 `getGreeting(now = new Date())` 计算问候；头像为空时显示昵称首字，不构造虚假姓名。消息入口使用 `Button` 和原生 `hoverClass`。

`HeroCarousel` 使用：

```tsx
<Swiper
  className="h-home-banner overflow-hidden rounded-card"
  autoplay
  circular
  interval={5000}
  indicatorDots
  indicatorColor="#FFFFFF99"
  indicatorActiveColor="#FFFFFF"
>
  {banners.map((banner) => (
    <SwiperItem key={banner.id} data-testid="home-banner">
      <View className="relative h-full w-full overflow-hidden rounded-card bg-brand">
        <Image
          className="h-full w-full object-cover"
          src={banner.image}
          mode="aspectFill"
          ariaLabel={banner.title}
        />
        <View className="absolute top-overlay right-overlay bottom-overlay left-overlay flex flex-col justify-end bg-ink px-compact py-compact">
          <Text className="block text-subtitle font-bold text-white">{banner.title}</Text>
          <Text className="mt-tab-label block text-base text-white">{banner.subtitle}</Text>
          <Button
            className="mt-note h-control self-start rounded-button border-none bg-white px-compact text-base font-semibold text-brand-strong"
            hoverClass="opacity-80"
            onClick={() => onAction(banner.actionPath)}
          >
            {banner.actionLabel}
          </Button>
        </View>
      </View>
    </SwiperItem>
  ))}
</Swiper>
```

`indicatorColor` 属于 Taro 组件属性，不写入 `className`；页面组件中的 UI 颜色仍使用品牌 token。

在 `index.tsx` 中移除旧的顶部 Logo、品牌副标题和内联轮播实现，改为按顺序组合已完成的安全区、顶部和轮播组件：

```tsx
<StatusBarSpacer />
<View data-testid="home-section-header">
  <HomeHeader
    nickname={nickname}
    avatar={user?.avatar ?? null}
    location="上海市 · 静安区"
    hasUnread
    onMessages={() => void Taro.switchTab({ url: "/pages/messages/index" })}
  />
</View>
<View className="mt-compact" data-testid="home-section-hero">
  <HeroCarousel
    banners={HOME_BANNERS}
    onAction={(url) => void Taro.switchTab({ url })}
  />
</View>
```

本任务保留首页旧的服务状态和三个内容模块，Task 4 再用新组件替换；不得提前实现 Task 4。

- [ ] **Step 5: 运行首页测试和类型检查**

Run:

```bash
pnpm --filter @petcare/miniapp exec jest src/pages/index/index.test.tsx --runInBand
pnpm --filter @petcare/miniapp typecheck
```

Expected: 首页测试 PASS，TypeScript 无错误。

- [ ] **Step 6: 提交**

```bash
git add apps/miniapp/src/app.css apps/miniapp/src/pages/index/home.data.ts apps/miniapp/src/pages/index/components/HomeHeader.tsx apps/miniapp/src/pages/index/components/HeroCarousel.tsx apps/miniapp/src/pages/index/index.tsx apps/miniapp/src/pages/index/index.test.tsx
git commit -m "feat(miniapp): 增加首页顶部与品牌轮播"
```

---

### Task 4: 实现首页服务状态与三类内容模块

**Files:**

- Create: `apps/miniapp/src/pages/index/components/ServiceOverview.tsx`
- Create: `apps/miniapp/src/pages/index/components/ServiceOverview.test.tsx`
- Create: `apps/miniapp/src/pages/index/components/BountySection.tsx`
- Create: `apps/miniapp/src/pages/index/components/ClassroomSection.tsx`
- Create: `apps/miniapp/src/pages/index/components/CommunitySection.tsx`
- Modify: `apps/miniapp/src/app.css`
- Modify: `apps/miniapp/src/pages/index/index.tsx`
- Modify: `apps/miniapp/src/pages/index/index.test.tsx`

**Interfaces:**

- `ServiceOverviewProps`: `{ status: AuthStatus; service: HomeService | null; onLogin(): void; onPublish(): void; onViewService(): void; onContact(): void }`
- `BountySectionProps`: `{ items: readonly HomeBounty[]; onViewAll(): void; onSelect(id: string): void }`
- `ClassroomSectionProps`: `{ items: readonly HomeArticle[]; onViewAll(): void; onSelect(id: string): void }`
- `CommunitySectionProps`: `{ items: readonly HomePost[]; onViewAll(): void; onSelect(id: string): void }`
- Invariant: 所有 `className` 是完整静态字符串，不通过模板字符串、映射或三元表达式动态拼接。

- [ ] **Step 1: 增加首页完整结构与状态失败测试**

```tsx
it("keeps the approved home section order", () => {
  renderAuthenticatedHome();
  const page = screen.getByTestId("home-page");
  const sections = within(page)
    .getAllByTestId(/home-section-/)
    .map((element) => element.getAttribute("data-testid"));

  expect(sections).toEqual([
    "home-section-header",
    "home-section-hero",
    "home-section-service",
    "home-section-bounty",
    "home-section-classroom",
    "home-section-community",
  ]);
});

it("renders the prototype content density", () => {
  renderAuthenticatedHome();
  expect(screen.getAllByTestId("bounty-card")).toHaveLength(3);
  expect(screen.getAllByTestId("classroom-card")).toHaveLength(4);
  expect(screen.getAllByTestId("community-card")).toHaveLength(3);
});

it("uses switchTab for first-level destinations", () => {
  renderAuthenticatedHome();
  fireEvent.click(screen.getByRole("button", { name: "查看全部悬赏" }));
  expect(Taro.switchTab).toHaveBeenCalledWith({ url: "/pages/bounty/index" });
});
```

保留并适配现有 loading、guest、authenticated 测试；删除“首页退出登录”断言，因为退出入口属于“我的”页面，不出现在首页原型中。

在 `ServiceOverview.test.tsx` 中直接渲染组件，分别断言：

```tsx
it.each([
  ["loading", null, "正在恢复登录状态"],
  ["guest", null, "登录后管理照护计划"],
  ["authenticated", null, "暂无进行中的服务"],
] as const)("renders the %s service state", (status, service, expectedText) => {
  render(
    <ServiceOverview
      status={status}
      service={service}
      onLogin={jest.fn()}
      onPublish={jest.fn()}
      onViewService={jest.fn()}
      onContact={jest.fn()}
    />,
  );
  expect(screen.getByText(expectedText)).toBeInTheDocument();
});

it("renders the ongoing service progress and actions", () => {
  render(
    <ServiceOverview
      status="authenticated"
      service={HOME_ONGOING_SERVICE}
      onLogin={jest.fn()}
      onPublish={jest.fn()}
      onViewService={jest.fn()}
      onContact={jest.fn()}
    />,
  );
  expect(screen.getByText("上门喂养 · 第 2 次服务")).toBeInTheDocument();
  expect(screen.getByTestId("service-progress")).toHaveStyle({ width: "65%" });
});
```

- [ ] **Step 2: 运行首页测试并确认失败**

Run:

```bash
pnpm --filter @petcare/miniapp exec jest src/pages/index/index.test.tsx src/pages/index/components/ServiceOverview.test.tsx --runInBand
```

Expected: 新模块顺序、卡片数量和一级 Tab 路由断言 FAIL。

- [ ] **Step 3: 增加首页尺寸 token**

在 `app.css` 的 `@theme` 中加入：

```css
--spacing-avatar: 48px;
--spacing-icon-touch: 44px;
--spacing-service-avatar: 48px;
--spacing-progress: 8px;
--spacing-bounty-card: 256px;
--spacing-bounty-image: 64px;
--spacing-article-image: 84px;
--spacing-community-media: 200px;
--spacing-tab-badge: 16px;
--spacing-page-tab-offset: 96px;
--radius-pill: 999px;
--shadow-floating: 0 8px 24px rgb(31 41 55 / 8%);
```

将首页根容器改为 `px-page-x`，避免现有 `p-page` 的 40px 内边距压缩内容区域。

- [ ] **Step 4: 实现服务状态组件**

`ServiceOverview` 使用明确分支分别返回四种静态结构：

```tsx
if (status === "loading") {
  return (
    <View className="rounded-card bg-white p-compact shadow-card">
      <Text className="block text-subtitle font-semibold text-ink-strong">正在恢复登录状态</Text>
      <Text className="mt-note block text-base text-muted-brand">正在为你同步照护计划</Text>
    </View>
  );
}

if (status === "guest") {
  return (
    <View className="rounded-card bg-white p-compact shadow-card">
      <Text className="block text-subtitle font-semibold text-ink-strong">登录后管理照护计划</Text>
      <Text className="mt-note block text-base text-muted-brand">查看服务进度、照护记录和消息</Text>
      <Button
        className="mt-compact h-control rounded-button border-none bg-brand text-white"
        onClick={onLogin}
      >
        微信登录
      </Button>
    </View>
  );
}

if (!service) {
  return (
    <View className="rounded-card bg-white p-section shadow-card">
      <Text className="block text-subtitle font-semibold text-ink-strong">暂无进行中的服务</Text>
      <Text className="mt-note block text-base text-muted-brand">去悬赏大厅发布新的照护需求</Text>
      <Button
        className="mt-compact h-control rounded-button border-none bg-brand text-white"
        onClick={onPublish}
      >
        发布悬赏
      </Button>
    </View>
  );
}

return (
  <View className="rounded-card bg-brand p-compact shadow-floating">
    <Text className="block text-subtitle font-bold text-white">{service.serviceType}</Text>
    <Text className="mt-tab-label block text-base text-white">
      预计 {service.estimatedTime} 完成
    </Text>
    <View className="mt-compact h-progress w-full overflow-hidden rounded-pill bg-surface-brand">
      <View
        className="h-progress rounded-pill bg-care"
        style={{ width: `${service.progress}%` }}
        data-testid="service-progress"
      />
    </View>
    <View className="mt-compact flex gap-note">
      <Button
        className="h-control flex-1 rounded-button border-none bg-care text-white"
        onClick={onViewService}
      >
        查看实时
      </Button>
      <Button
        className="h-control flex-1 rounded-button border border-solid border-white bg-brand text-white"
        onClick={onContact}
      >
        联系宠托师
      </Button>
    </View>
  </View>
);
```

进度条宽度是业务数据，允许通过 `style={{ width: `${service.progress}%` }}` 设置；颜色和高度继续使用 `bg-care` 与 `h-progress` token 类。

- [ ] **Step 5: 实现三个内容模块并组合首页**

- `BountySection` 使用横向 `ScrollView`，卡片宽度固定为 `w-bounty-card`。
- `ClassroomSection` 渲染 4 条带本地缩略图的纵向列表。
- `CommunitySection` 渲染 3 张内容卡片，媒体缺失时不保留空白图片区。
- Emoji 不作为生产图标；宠物类型、位置、时间和互动信息使用文本或 Taro 原生图标。
- 尚未注册的详情路由不执行虚假跳转；卡片回调保留接口，首轮由首页传入空操作函数。

首页只负责状态和路由编排：

```tsx
const switchTab = (url: string): void => {
  void Taro.switchTab({ url });
};

<BountySection
  items={HOME_BOUNTIES}
  onViewAll={() => switchTab("/pages/bounty/index")}
  onSelect={() => undefined}
/>;
```

- [ ] **Step 6: 运行首页、样式与类型检查**

Run:

```bash
pnpm --filter @petcare/miniapp exec jest src/pages/index/index.test.tsx src/pages/index/components/ServiceOverview.test.tsx --runInBand
pnpm --filter @petcare/miniapp lint:styles
pnpm --filter @petcare/miniapp typecheck
```

Expected: 全部 PASS；样式策略不报告动态类名、任意值、变体或值编码类。

- [ ] **Step 7: 提交**

```bash
git add apps/miniapp/src/app.css apps/miniapp/src/pages/index
git commit -m "feat(miniapp): 完成品牌化首页内容布局"
```

---

### Task 5: 优化自定义底部导航

**Files:**

- Create: `apps/miniapp/src/assets/navigation/home-default.svg`
- Create: `apps/miniapp/src/assets/navigation/home-active.svg`
- Create: `apps/miniapp/src/assets/navigation/bounty-default.svg`
- Create: `apps/miniapp/src/assets/navigation/bounty-active.svg`
- Create: `apps/miniapp/src/assets/navigation/community-default.svg`
- Create: `apps/miniapp/src/assets/navigation/community-active.svg`
- Create: `apps/miniapp/src/assets/navigation/messages-default.svg`
- Create: `apps/miniapp/src/assets/navigation/messages-active.svg`
- Create: `apps/miniapp/src/assets/navigation/profile-default.svg`
- Create: `apps/miniapp/src/assets/navigation/profile-active.svg`
- Modify: `apps/miniapp/src/custom-tab-bar/index.tsx`
- Modify: `apps/miniapp/src/custom-tab-bar/index.test.tsx`
- Modify: `apps/miniapp/src/pages/index/index.tsx`

**Interfaces:**

- `TabItem`: `{ path: string; label: string; icon: string; activeIcon: string; badge?: number }`
- Invariant: 未选中图标使用 `#667085`，选中图标使用 `#4A6CF7`，SVG 均为 `24 × 24` 且 `viewBox="0 0 24 24"`。

- [ ] **Step 1: 写底部导航失败测试**

把测试中的 `Image` mock 映射为 `img`，新增：

```tsx
it("uses branded local icons and shows the message badge", () => {
  render(<CustomTabBar />);

  expect(screen.getByLabelText("首页")).toHaveAttribute("data-selected", "true");
  expect(screen.getByLabelText("消息未读 3 条")).toBeInTheDocument();
  expect(screen.getAllByRole("img")).toHaveLength(5);
});

it("keeps every tab touch target at the semantic control height", () => {
  render(<CustomTabBar />);
  for (const button of screen.getAllByRole("button")) {
    expect(button).toHaveClass("min-h-control");
  }
});
```

在 Taro mock 中加入 `getWindowInfo: jest.fn(() => ({ screenHeight: 844, safeArea: { bottom: 810 } }))`，并断言 TabBar 根节点的 `paddingBottom` 为 `34px`。

- [ ] **Step 2: 运行 TabBar 测试并确认失败**

Run:

```bash
pnpm --filter @petcare/miniapp exec jest src/custom-tab-bar/index.test.tsx --runInBand
```

Expected: 本地图标、未读角标和 `min-h-control` 断言 FAIL。

- [ ] **Step 3: 创建五项双状态 SVG 图标**

每个 SVG 使用以下统一外壳。default 文件的 `stroke` 固定为 `#667085`，active 文件固定为 `#4A6CF7`：

```svg
<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#667085" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
  <path d="M3 11.5 12 4l9 7.5" />
  <path d="M5 10.5V20h14v-9.5" />
  <path d="M9 20v-6h6v6" />
</svg>
```

五项图标分别使用以下完整路径体：

```text
home:
<path d="M3 11.5 12 4l9 7.5" />
<path d="M5 10.5V20h14v-9.5" />
<path d="M9 20v-6h6v6" />

bounty:
<circle cx="12" cy="12" r="9" />
<path d="m15.5 8.5-2 5-5 2 2-5 5-2Z" />

community:
<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
<circle cx="9" cy="7" r="4" />
<path d="M22 21v-2a4 4 0 0 0-3-3.87" />
<path d="M16 3.13a4 4 0 0 1 0 7.75" />

messages:
<path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" />
<path d="M13.73 21a2 2 0 0 1-3.46 0" />

profile:
<circle cx="12" cy="8" r="4" />
<path d="M4 21a8 8 0 0 1 16 0" />
```

active 文件同时把 `stroke-width` 改为 `2.2`。这些 SVG 直接保存为静态资源，不增加 `lucide-react` 运行时依赖，也不使用 Emoji。

- [ ] **Step 4: 重构 TabBar 渲染**

使用 `Image` 渲染 `selected ? item.activeIcon : item.icon`，按钮保留 `aria-label`，消息项增加 `badge: 3`。选中和未选中文案分别渲染为带静态类名的两个分支，避免动态 `className`：

```tsx
{
  selected ? (
    <Text className="mt-tab-label text-tab font-semibold text-brand">{item.label}</Text>
  ) : (
    <Text className="mt-tab-label text-tab font-normal text-muted-brand">{item.label}</Text>
  );
}
```

根容器继续固定在底部。通过 `Taro.getWindowInfo()` 计算 `screenHeight - safeArea.bottom`，并以内联 `paddingBottom` 应用真实底部安全区；不得把 `pb-note` 与 `pb-safe-bottom` 叠加。首页内容区使用独立的 `pb-page-tab-offset` token 预留 `96px`，避免最后一张卡片被 TabBar 遮挡。

- [ ] **Step 5: 运行 TabBar、样式和构建测试**

Run:

```bash
pnpm --filter @petcare/miniapp exec jest src/custom-tab-bar/index.test.tsx --runInBand
pnpm --filter @petcare/miniapp lint:styles
pnpm --filter @petcare/miniapp build:weapp
```

Expected: 测试和构建 PASS；产物策略不报告 SVG、WXSS 或不支持选择器问题。

- [ ] **Step 6: 提交**

```bash
git add apps/miniapp/src/assets/navigation apps/miniapp/src/custom-tab-bar apps/miniapp/src/pages/index/index.tsx
git commit -m "feat(miniapp): 优化品牌化底部导航"
```

---

### Task 6: 完整质量门禁与页面验收

**Files:**

- Modify only if verification exposes a defect in the files listed by Tasks 1–5.

**Interfaces:**

- Produces: 可在微信开发者工具中打开的 `apps/miniapp/dist`。
- Invariant: 不通过跳过测试、禁用规则或放宽样式策略来消除失败。

- [ ] **Step 1: 格式化本次 Miniapp 文件**

Run:

```bash
pnpm exec prettier --write apps/miniapp/src
```

Expected: 只格式化 Miniapp 源码和新增 SVG，不改动其他应用。

- [ ] **Step 2: 运行 Miniapp 完整检查**

Run:

```bash
pnpm --filter @petcare/miniapp format:check
pnpm --filter @petcare/miniapp lint
pnpm --filter @petcare/miniapp typecheck
pnpm --filter @petcare/miniapp test
pnpm --filter @petcare/miniapp build:weapp
```

Expected: 所有命令退出码为 0；构建产物通过 `style-output-policy.mjs miniapp dist`。

- [ ] **Step 3: 检查源码和构建产物的禁止项**

Run:

```bash
rg -n "https://images\.unsplash\.com|\[[^]]+\]|\b\d+(?:rem|rpx)\b|className=\{`" apps/miniapp/src
rg -n "\b\d+(?:rem|rpx)\b|process is not defined|NaN|\.\\\*" apps/miniapp/dist
```

Expected: 两条命令均无匹配；若 `rg` 以无匹配状态退出，这是成功结果。

- [ ] **Step 4: 在微信开发者工具中人工验收**

按以下固定清单检查：

1. 登录页和首页不显示微信原生标题栏。
2. 顶部内容不被状态栏或右上角胶囊遮挡。
3. 登录页拒绝授权时卡片高度不跳动，重新点击可以重试。
4. 首页模块顺序与用户截图一致，热门悬赏可横向滚动。
5. 长页面只滚动内容，底部导航固定且不遮挡最后一张社区卡片。
6. 五个 Tab 的选中态、未读角标和点击切换正确。
7. 轮播图片清晰，没有外部图片域名错误。
8. 不同屏幕宽度下无横向页面溢出。

- [ ] **Step 5: 检查最终差异**

Run:

```bash
git diff --check
git status --short
```

Expected: `git diff --check` 无输出；状态中只包含 Tasks 1–5 产生的 Miniapp 文件和本计划跟踪状态。

- [ ] **Step 6: 提交最终校验修正**

仅当本任务产生实际修正时执行：

```bash
git add apps/miniapp
git commit -m "fix(miniapp): 完善登录页与首页验收细节"
```
