# PetCare 项目官网与内容管理技术设计

## 目标

在现有 monorepo 中新增 PetCare 品牌官网，并让管理员通过现有 Admin 编辑官网预设区块中的图片、标题、正文、按钮和链接。管理员先保存草稿并预览，再按单个页面显式发布；未发布内容不得影响线上官网。

官网延续《PetCare Brand Book v1.0》的定位：解释“为什么值得托付”，而不是堆砌全部功能。首期不开放区块新增、删除、换型或排序，但数据模型和模块接口必须允许以后在不重建发布内核的前提下开放这些能力。

## 已确认的产品边界

- 当前只编辑代码预设的页面、全局内容和区块。
- 草稿保存与线上发布分离，发布前支持安全预览。
- 每个页面独立发布；导航、页脚和公共联系方式作为独立的全局内容发布。
- 发布后立即影响新的官网请求，不触发重新构建或部署。
- 图片使用现有阿里云 OSS，并在 Admin 提供轻量官网素材库。
- 查看、编辑和发布权限相互分离。
- 未来允许新增、归档和排序区块，但首期不实现相关命令和界面。

## 技术选型

| 领域       | 选型                           | 说明                                                 |
| ---------- | ------------------------------ | ---------------------------------------------------- |
| 官网工作区 | `apps/website`                 | pnpm 与 Turborepo 管理的独立应用                     |
| Web 框架   | Astro SSR                      | 服务端渲染最新发布内容，支持发布后立即生效           |
| 语言       | TypeScript                     | 与仓库工程约束保持一致                               |
| 样式       | Tailwind CSS v4 + 少量普通 CSS | 延续工具类习惯，但不共享 Admin 页面样式              |
| 内容服务   | Nest.js `WebsiteContentModule` | 草稿、预览、发布、历史、素材和公共读取               |
| 持久化     | PostgreSQL + Prisma            | 保存内容、不可变版本快照、区块、素材元数据和审计记录 |
| 缓存       | Redis + 进程内最近成功快照     | 加速发布版本读取，并在依赖短暂失败时提供有限回退     |
| 图片       | 阿里云 OSS                     | 保存稳定对象；内容只引用素材标识，不保存临时签名 URL |
| Admin      | React 19 + 现有组件体系        | 结构化编辑、素材选择、差异、预览、发布和历史         |
| 共享契约   | `@petcare/shared-types`        | 请求、响应、常量、区分联合类型和稳定错误码的唯一来源 |
| 测试       | Vitest + Playwright            | 覆盖领域规则、HTTP 契约、Admin 流程和官网端到端行为  |
| 部署       | Docker + Nginx                 | Nginx 代理 Astro SSR 与 Nest.js，并继续提供静态资源  |

首期不安装 React 或 Vue 作为 Astro 客户端运行时。移动导航、FAQ 和二维码弹层优先使用 Astro、CSS 与少量原生脚本；只有真实复杂交互出现时才增加局部框架岛屿。

## 模块与命名规范

### 目录、类与路由

| 层面         | 正式命名                                                |
| ------------ | ------------------------------------------------------- |
| Server 目录  | `apps/server/src/modules/website-content/`              |
| Nest 模块    | `WebsiteContentModule`                                  |
| 后台控制器   | `AdminWebsiteContentController`                         |
| 公共控制器   | `PublicWebsiteContentController`                        |
| Admin 页面   | `apps/admin/src/pages/WebsiteContent/`                  |
| Admin API    | `apps/admin/src/api/website-content/`                   |
| Admin 路由   | `/website-content`、`/website-content/:contentKey/edit` |
| 后台接口     | `/admin/website-content/*`                              |
| 公共内容接口 | `/website-content/*`                                    |
| 共享契约     | `packages/shared-types/src/api/website-content.ts`      |
| Website 页面 | `apps/website/src/pages/`                               |

项目继续使用目录和 REST 路径 `kebab-case`、TypeScript 类与共享类型 `PascalCase`、变量和 HTTP 字段 `camelCase`、常量键 `SCREAMING_SNAKE_CASE`、数据库列和业务值 `snake_case`。共享契约中的每个字段、业务值和公共函数必须包含说明用途的 JSDoc。

### 领域对象

`WebsiteContent` 表示一个独立草稿和发布单元，例如首页或全局内容。正式对象为：

```text
WebsiteContent
├── currentDraftVersionId
├── publishedVersionId
└── WebsiteContentVersion[]
    └── WebsiteContentSection[]
```

辅助对象：

- `WebsiteMediaAsset`：可被官网区块引用的 OSS 图片元数据。
- `WebsiteContentAuditLog`：草稿、预览、发布、恢复和素材操作审计记录。
- `WebsitePreviewToken`：短时草稿预览凭证的哈希与作用域。

Prisma 模型使用 `PascalCase`，表名映射为：

- `website_contents`
- `website_content_versions`
- `website_content_sections`
- `website_media_assets`
- `website_content_audit_logs`
- `website_preview_tokens`

关键字段统一命名：

- `contentKey`：稳定发布单元键，例如 `home`、`services`、`site_shell`。
- `contentType`：`page` 或 `global`。
- `sectionKey`：页面内稳定区块键，例如 `hero`、`trust_evidence`。
- `sectionType`：区块行为类型，例如 `hero`、`trust_grid`、`feature_split`。
- `sortOrder`：区块显示顺序。
- `isEnabled`：区块是否显示。
- `schemaVersion`：区块内容结构版本。
- `content`：通过区块类型校验的内容 JSON。
- `settings`：通过区块类型校验的有限展示配置 JSON。
- `revision`：草稿乐观锁修订号。
- `businessVersion`：同一 `contentKey` 内单调递增的发布版本号。
- `sourceVersionId`：恢复或复制草稿的来源版本。
- `changeSummary`：保存或发布时的业务变更说明。
- `idempotencyKey`：防止重复发布的业务幂等键。

`WebsiteContentVersion.status` 使用 `draft`、`published` 和 `superseded`。同一 `WebsiteContent` 只有 `currentDraftVersionId` 指向的版本是当前草稿；保存产生新草稿后，旧草稿变为 `superseded`，但在关联预览令牌仍有效时继续允许只读预览。`businessVersion`、发布人和发布时间仅对已发布或曾发布版本有值。

## 系统架构

```text
Admin 结构化编辑
        |
        v
Nest.js WebsiteContentModule
  ├── 草稿与不可变发布版本 -> PostgreSQL
  ├── 素材元数据 -----------> PostgreSQL
  ├── 图片对象 -------------> 阿里云 OSS
  ├── 发布版本缓存 ---------> Redis
  └── 预览令牌与审计 -------> PostgreSQL
        |
        +--> 管理接口 /admin/website-content/*
        +--> 公共接口 /website-content/*
                         |
                         v
                      Astro SSR
                         |
                         v
                       Nginx
```

- 官网浏览器不直接访问 PostgreSQL、Redis 或 OSS 管理接口。
- Astro SSR 只通过 Nest.js 公共接口读取已发布内容，通过预览接口读取指定草稿快照。
- Admin 只通过 `apps/admin/src/api/website-content/` 访问后台接口。
- Server DTO 负责运行时校验和 Swagger 元数据，并通过 `implements` 对齐共享请求契约。
- 官网拥有独立布局与展示模块，不把 Admin 的 shadcn/ui 提升为跨应用 UI 依赖。
- 宠物课堂文章继续属于现有 `ClassroomArticle` 领域，不复制进 `WebsiteContent`。

## 首期信息架构

### 发布单元

| `contentKey` | 类型     | 官网用途                            |
| ------------ | -------- | ----------------------------------- |
| `site_shell` | `global` | 主导航、页脚和公共联系方式          |
| `home`       | `page`   | 首页 Hero、信任证据、服务模式与 CTA |
| `services`   | `page`   | C2C 悬赏与 B2C 平台定价场景         |
| `trust`      | `page`   | 认证、SOP、记录、评价与申诉机制     |
| `companions` | `page`   | 服务者加入条件、成长路径与公平机会  |
| `about`      | `page`   | 品牌使命、价值观和团队/项目介绍     |
| `contact`    | `page`   | 客服、商务合作与联系渠道            |

`privacy` 和 `terms` 首期也作为预设页面内容管理，但发布时必须通过相应必填字段校验。文章列表和详情消费 `ClassroomArticle` 的已发布公共接口。

### 官网路由

| 路由               | 数据来源                          |
| ------------------ | --------------------------------- |
| `/`                | `site_shell` + `home`             |
| `/services`        | `site_shell` + `services`         |
| `/trust`           | `site_shell` + `trust`            |
| `/companions`      | `site_shell` + `companions`       |
| `/about`           | `site_shell` + `about`            |
| `/contact`         | `site_shell` + `contact`          |
| `/privacy`         | `site_shell` + `privacy`          |
| `/terms`           | `site_shell` + `terms`            |
| `/articles`        | `site_shell` + 已发布课堂文章列表 |
| `/articles/[slug]` | `site_shell` + 单篇已发布课堂文章 |

## 区块类型注册

Server 的代码级 `WebsiteSectionTypeRegistry` 是区块业务规则的最终裁决者。每种 `sectionType` 定义：

- 稳定类型键与 `schemaVersion`。
- `content` 和 `settings` 的运行时校验规则。
- 默认内容。
- 允许出现的 `contentKey`。

共享契约使用 `WEBSITE_SECTION_TYPE` 常量对象及区分联合类型，例如 `HERO`、`TRUST_GRID`、`FEATURE_SPLIT` 和 `CTA`。Admin 维护从该共享类型到强类型编辑模块的穷尽映射，Website 维护从该共享类型到安全渲染模块的穷尽映射；两者不共享 React/Astro 可执行代码。TypeScript 穷尽检查和契约测试保证新增类型时三个应用都会显式处理。数据库不能指定任意模块路径，Admin 不能提交任意 HTML、CSS 或脚本，Astro 也不执行数据库内容。

每个 `contentKey` 另有代码级页面模板，约束必须存在的 `sectionKey`、允许的 `sectionType`、默认 `sortOrder`、是否允许停用及必填字段。首期保存草稿时，Server 拒绝新增、删除、换型或排序区块，即使请求绕过 Admin 也一样。

未来开放自由编排时，保留同一模型与发布流程，只新增区块创建、归档、批量排序命令，以及 Admin 区块选择器和拖拽界面。旧发布版本保持原始快照；字段结构升级通过显式迁移生成新草稿，不静默修改历史版本。

## 草稿与发布生命周期

### 草稿保存

`PUT /admin/website-content/:contentKey/draft`

- 使用 `revision` 乐观锁，修订不匹配返回稳定冲突错误码。
- 校验页面模板、区块内容、展示设置、链接及素材引用。
- 每次保存创建新的不可变草稿版本和完整区块快照，将 `currentDraftVersionId` 移到新版本；不原地覆盖旧草稿，也不修改已发布版本。
- 新草稿的 `revision` 比前一份当前草稿增加一；旧草稿保留供已签发预览固定读取。
- 保存成功记录编辑审计事件。
- 多个管理员并发编辑时不自动合并或覆盖；冲突界面展示服务器新修订。

### 后台接口

- `GET /admin/website-content`：查询全部发布单元概览。
- `GET /admin/website-content/:contentKey/draft`：读取当前草稿。
- `PUT /admin/website-content/:contentKey/draft`：保存新草稿快照。
- `GET /admin/website-content/:contentKey/diff`：比较当前草稿与已发布版本。
- `GET /admin/website-content/:contentKey/history`：分页读取已发布历史。
- `GET /admin/website-content/:contentKey/history/:versionId`：读取历史版本。
- `POST /admin/website-content/:contentKey/previews`：为当前草稿创建预览令牌和带 fragment 的预览 URL。
- `POST /admin/website-content/:contentKey/publish`：显式发布当前草稿。
- `POST /admin/website-content/:contentKey/restore`：从历史版本创建新草稿。
- `GET /admin/website-content/media-assets`：分页查询官网素材。
- `POST /admin/website-content/media-assets`：上传并登记官网图片。
- `POST /admin/website-content/media-assets/:assetId/archive`：归档未被阻止的素材。

列表查询参数、请求正文、响应数据与稳定错误码全部定义在 `@petcare/shared-types`；分页继续使用项目统一的 `list`、`total`、`page`、`pageSize` 结构。

### 显式发布

`POST /admin/website-content/:contentKey/publish`

发布分为事务前预检和单个数据库事务。事务前完成页面模板、区块类型、链接以及 OSS 对象存在性与可读取性检查；任何预检失败都不会改变线上指针。

数据库事务完成：

1. 锁定并确认草稿 ID 与 `revision`。
2. 再次通过页面模板和 `WebsiteSectionTypeRegistry` 完整校验草稿。
3. 再次确认全部 `WebsiteMediaAsset` 数据库记录仍处于可发布状态；事务中不发起 OSS 网络请求。
4. 将当前不可变草稿版本发布，分配新的 `businessVersion` 与发布时间。
5. 将原发布版本标记为 `superseded`。
6. 更新 `WebsiteContent.publishedVersionId`。
7. 从新发布版本复制下一份不可变草稿快照，并设为 `currentDraftVersionId`；后续编辑仍通过创建新草稿版本完成。
8. 写入发布审计事件。

发布请求必须包含 `idempotencyKey`、`revision` 和 `changeSummary`。每个页面与 `site_shell` 独立发布，不支持一次发布整个官网。

### 历史恢复

恢复历史版本不会直接影响线上内容。Server 将指定历史版本复制为新草稿，管理员重新预览并显式发布；已发布快照永不原地修改。

## 公共读取与 Astro SSR

公共接口：

- `GET /website-content/:contentKey`：返回当前已发布完整快照。
- `GET /website-content/previews/:contentKey`：从脱敏请求头读取预览令牌并返回固定草稿快照；响应禁止公共缓存和索引。
- 课堂文章另由现有内容领域提供已发布列表和详情接口。

公共内容响应包括内容键、发布版本、发布时间、SEO 元数据和有序区块。绝不返回草稿、管理员身份、审计信息或 OSS 管理凭据。

Astro SSR 请求 `site_shell` 和页面发布快照，根据 `sectionType` 选择代码中注册的渲染模块。未知类型或不支持的 `schemaVersion` 不执行动态代码：Server 在发布前拒绝，Astro 在读取异常数据时记录错误并使用安全失败状态。

## Redis 缓存与即时生效

公共读取先从 PostgreSQL 查询很小的 `publishedVersionId`，再以不可变版本 ID 访问 Redis：

```text
website_content:version:<versionId>
```

- Redis 命中时返回完整发布快照。
- 未命中时从 PostgreSQL读取版本与区块，并写入 Redis。
- 新版本发布后 `publishedVersionId` 立即变化，自然使用新缓存键，无需删除旧缓存才能保证正确性。
- 发布事务提交后尝试预热新版本缓存；预热失败不回滚数据库发布，但必须记录告警。
- 旧版本缓存使用有限 TTL 自动回收，不承担当前版本指针职责。

该设计以一次轻量数据库指针读取换取明确的一致性，不提前引入消息总线或复杂分布式失效协议。

## 草稿预览

### 流程

1. Admin 保存草稿后请求创建预览。
2. Server 为 `contentKey`、草稿 ID 和当前 `revision` 生成高熵随机令牌。
3. 数据库只保存令牌哈希、管理员、作用域、过期时间和吊销状态。
4. Admin 在新窗口打开 `https://<website>/preview#token=<token>`；fragment 不会随初始 HTTP 请求发送。
5. 预览引导页用同源 POST 将 fragment 中的令牌交换为官网域的 `HttpOnly`、`Secure`、`SameSite=Lax` 短时 Cookie，立即从地址栏删除 fragment 并重新加载。
6. Astro SSR 从 Cookie 读取令牌，通过被日志脱敏的 `X-Website-Preview-Token` 请求头调用 Nest.js，读取固定修订的草稿快照。
7. 令牌默认十分钟失效；普通继续编辑不会吊销旧修订预览，发布或主动撤销时立即吊销对应令牌。

预览固定到生成时的草稿版本 ID 和 `revision`。管理员继续编辑后，旧草稿快照仍保留，因此旧链接继续展示旧修订，不悄悄切换到新内容。

### 安全边界

- 预览令牌是短期能力凭证；获得链接的人可在过期前查看，因此不得宣传为严格绑定原管理员会话。
- 令牌不编码管理员或内容数据，不记录明文，不可跨页面或修订使用。
- 令牌不得出现在 URL 路径或查询参数；预览 Cookie 与 `X-Website-Preview-Token` 必须加入日志脱敏规则。
- 预览接口设置 `Cache-Control: private, no-store`。
- 预览页面输出 `noindex, nofollow`，不得进入 Redis 或公共 CDN 缓存。
- 预览页面不包含保存、发布等管理操作。
- 创建与使用预览均记录审计事件，但不记录明文令牌。

只有未来确实要求“必须是当前登录的原管理员本人”时，才升级为 Admin 同源代理或二次认证。

## Admin 内容管理

### 页面结构

- `/website-content`：发布单元概览，展示草稿修订、当前发布版本、最后编辑人、发布时间及未发布差异。
- `/website-content/:contentKey/edit`：预设区块编辑。
- `/website-content/:contentKey/history/:versionId`：历史版本详情。

页面遵循项目“模块目录 + `index.tsx` / `Edit.tsx` / `Detail.tsx`”结构，通过 `React.lazy` 延迟加载，并在 `apps/admin/src/routes/registry.ts` 集中注册权限。

编辑页按 `sortOrder` 展示预设区块，对每种类型提供强类型表单：

- 标题、正文和辅助文案。
- 按钮文字与链接。
- 素材选择、上传、替换和使用场景的替代文本。
- 允许修改的有限展示参数。
- 模板允许时启用或停用区块。

当前不显示新增、删除、换型和拖拽排序入口。离开未保存页面时提示；发布前展示草稿与线上版本的字段级差异，要求填写 `changeSummary` 并二次确认。

### 权限目录

权限遵循现有 `menu -> button -> api` 目录：

| 权限码                   | 类型     | 用途                              |
| ------------------------ | -------- | --------------------------------- |
| `website.view`           | `menu`   | 打开官网内容管理并查看版本与历史  |
| `website.read`           | `api`    | 读取后台官网内容                  |
| `website.edit`           | `button` | 显示草稿编辑、素材管理与预览操作  |
| `website.edit_action`    | `api`    | 保存草稿、上传/归档素材和创建预览 |
| `website.publish`        | `button` | 显示发布与历史恢复操作            |
| `website.publish_action` | `api`    | 发布内容和从历史版本创建恢复草稿  |

`website.view` 隐含 `website.read`；按钮权限分别通过 `impliedApiCodes` 隐含对应接口权限。Admin 使用 `PermissionRoute` 和 `PermissionGate` 改善界面与可访问性，Server 使用 `AccessTokenGuard`、`PermissionGuard` 和 `RequirePermissions` 逐请求重新授权。

## 官网素材库

`WebsiteMediaAsset` 至少保存：

- `storageKey`
- `originalName`
- `mimeType`
- `sizeBytes`
- `width`、`height`
- `checksum`
- `status`
- `createdById`、`createdAt`

规则：

- OSS `storageKey` 由 Server 生成，Admin 不能提交任意对象路径。
- 上传时校验文件真实类型、扩展名、大小、尺寸和图片完整性。
- 区块 `content` 只保存 `assetId`；使用场景的 `altText` 保存在区块内容中。
- 裁切焦点和宽高比等展示参数保存在区块 `settings`。
- 已被草稿或发布版本引用的素材不能物理删除，只能归档。
- 发布版本引用稳定 OSS 对象；Server 按 `assetId` 生成公共资源地址。

首期只实现图片上传、选择、预览、归档和引用检查，不实现文件夹、复杂标签、AI 处理或图片编辑器。

## SEO、性能与可访问性

- 每个发布页面保存并输出唯一标题、描述、canonical 与 Open Graph 元数据。
- Astro 生成 `robots.txt` 和 sitemap；发布页面的动态路由由 sitemap 生成逻辑读取当前发布内容。
- 页面主体由 SSR 输出语义化 HTML，不依赖客户端 JavaScript 阅读主要内容或完成主要导航。
- 图片提供明确尺寸、响应式格式和有意义的 `altText`；非首屏图片延迟加载。
- 所有交互可用键盘操作，具有清晰焦点样式和足够色彩对比度。
- 动效遵循 `prefers-reduced-motion`，自动轮播不得成为读取内容的唯一方式。
- 公共响应允许针对不可变版本缓存，但当前页面 HTML 的缓存策略必须保证发布后新的请求可看到新版本。

## 错误处理与故障回退

- Redis 不可用时，Nest.js 直接读取 PostgreSQL。
- Nest.js 内容接口短暂失败时，Astro 使用进程内最近一次成功读取的已发布快照。
- 没有任何已发布快照时返回品牌一致的 `503` 页面，不回退到草稿。
- 单个非关键图片失败时显示品牌占位图和替代文本。
- `site_shell` 失败但页面内容有最近成功快照时，使用代码内最小安全导航和页脚，不使用未发布数据。
- 外部链接缺失或不合法时发布校验失败，线上不渲染无效 CTA。
- Astro 提供品牌一致的 `404` 与 `503` 页面。

稳定错误码至少区分：修订冲突、内容校验失败、内容或版本不存在、素材无效、预览令牌无效/过期、发布持久化失败和权限不足。客户端不得以中文消息文本判断错误类型。

Astro 的进程内回退只保存公共已发布快照，按 `contentKey` 设五分钟最长陈旧窗口；预览内容永不进入该缓存。超过窗口仍无法读取公共接口时返回 `503`，避免无限期展示旧内容。

## 审计

`WebsiteContentAuditLog` 记录：

- 保存草稿。
- 创建和使用预览。
- 发布版本。
- 从历史版本创建恢复草稿。
- 上传和归档素材。
- 重要校验失败及权限拒绝。

记录操作人、操作类型、目标内容、版本、修订、请求 ID、时间与必要结果，不记录预览明文令牌、图片内容、密钥或完整请求正文。

## 验证

### Server

- 草稿保存、`revision` 冲突和字段级校验。
- 首期无法新增、删除、换型或排序区块。
- 素材引用、OSS 对象和链接校验。
- 单页面发布的事务一致性、不可变快照与幂等性。
- 公共接口只返回已发布版本。
- 历史查询与恢复只生成草稿。
- 预览令牌作用域、固定修订、过期、吊销与无明文存储。
- Redis 命中、未命中和不可用回退。
- 未知 `sectionType`、旧 `schemaVersion` 和权限拒绝。
- DTO、共享契约、稳定错误码和 Swagger 响应。

### Admin

- 发布单元概览、区块编辑表单和素材选择。
- 未保存修改离开提示和乐观锁冲突展示。
- 差异、预览、发布、历史和恢复流程。
- `PermissionRoute`、`PermissionGate` 和三层权限目录。
- 当前没有新增、删除、换型或排序入口。

### Website

- 已发布页面与 `site_shell` 的 SSR 渲染。
- 每种区块类型的合法与异常数据。
- SEO、语义结构、键盘操作、响应式图片与移动导航。
- 草稿预览禁止索引和缓存。
- Nest.js、Redis 与图片失败时的规定回退。
- Playwright 验证发布前线上不变，发布后新请求立即生效。

### 工程门禁

- `apps/website` 格式、ESLint、TypeScript、Vitest 和生产构建。
- Admin 与 Server 相关定向检查及测试。
- Prisma 格式、校验和迁移策略检查。
- 根级工作区、依赖、提交范围、CI、Docker 与 Nginx 策略测试。
- `git diff --check`，以及生产容器中官网、公共 API 和健康检查冒烟测试。

## 工程与部署

- 根脚本补充官网定向 `dev`、`build`、`typecheck`、`lint` 和 `test` 命令，并让 Turborepo 生命周期发现官网工作区。
- 官网接入共享 ESLint、Prettier、TypeScript、lint-staged 和提交范围检查。
- 官网样式规则与 Admin 分作用域检查，不能复用 Admin 唯一入口文件假设。
- 新增 Astro SSR 生产镜像；Nginx 反向代理官网 SSR 和 Nest.js 公共接口，不覆盖 Admin 静态产物。
- 新增或修改环境变量时同步 `.env.example` 与 `docs/environment-variables.md`；Server 继续只通过 `ConfigService` 访问配置。
- 生产域名、TLS、OSS 公共域名和缓存头在部署实施中配置，不把凭据写入构建产物。

## 实施分解

该功能跨越 Server、Admin、Website 和部署，按依赖拆分为五个连续里程碑：

1. 内容领域基础：Prisma、共享契约、权限、页面模板、区块注册、草稿、发布、历史和公共读取。
2. 素材与预览：OSS 图片、轻量素材库、短时预览令牌和审计。
3. Admin 内容管理：概览、编辑、差异、预览、发布和历史。
4. Astro SSR 官网：页面外壳、区块渲染、SEO、缓存与故障回退。
5. 工程与部署：Docker、Nginx、环境变量、CI、质量门禁和部署文档。

宠物课堂文章的编辑与发布能力若不足，应另立需求，不混入官网预设区块实施。

## 非目标

- 不把官网实现为 Miniapp H5 的皮肤或 Admin SPA 的公开路由。
- 不实现区块新增、删除、换型和拖拽排序，但保留模型演进接缝。
- 不允许自由 HTML、CSS、JavaScript 或页面代码编辑。
- 不构建可视化低代码建站器。
- 不实现多人实时协同、字段级锁、审批流、定时发布或多语言版本。
- 不实现 OSS 文件夹、复杂标签、AI 图片处理或图片编辑器。
- 不接入外部 Headless CMS，不新增独立后端、数据库或权限系统。
- 不在官网实现账户认证、下单、支付、订单查询、个性化推荐或在线客服系统。
- 不重做已经批准的 Logo、Hero 和品牌元素。

## 后续升级触发条件

- 运营确需组合页面时，开放现有模型上的区块创建、归档和批量排序命令。
- 页面模板允许自由组合后，增加 Admin 区块选择器、数量限制和拖拽排序。
- 严格限制预览必须由原管理员本人查看时，增加同源代理或二次认证。
- 多语言市场出现持续翻译流程时，再建设按语言独立发布的内容版本。
- 多实例 Astro 的进程内回退不再满足可用性目标时，再评估集中式最后成功快照或边缘缓存。
