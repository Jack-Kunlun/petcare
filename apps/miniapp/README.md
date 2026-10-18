# PetCare Miniapp

PetCare 跨端客户端，采用 UniApp、Vue 3、Wot UI 与 UnoCSS。页面基于 [PetCare Mobile Design System](https://www.figma.com/design/mwpHHcx0VAutpPTIhGYGqC) 的业务原稿实现；同页筛选、加载、空态及错误态共用路由。

## 页面与数据来源

| 页面                                                     | 数据与交互                                                                                             |
| -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| 首页、登录、个人资料、宠物档案                           | 真实内容、微信认证、本人资料和宠物 API；上传及删除沿用服务端权限与校验                                 |
| 社区、课堂、帖子详情与发布                               | 真实列表、筛选、点赞、评论、举报、媒体与审核流程；附近页为静态展示                                     |
| 消息、帮助、联系、协议                                   | 真实通知和已发布内容 API；关于页读取运行版本                                                           |
| 悬赏、三步发布、详情、订单、履约                         | 真实悬赏、资格、意向、候选确认、支付及 SOP API；订单复用本人悬赏和已确认服务意向，不调用历史订单接口   |
| 地图、服务监控                                           | 地图为位置示意；进度、履约证据和视频使用真实 SOP 数据，不伪造定位或直播                                |
| 收藏、关注、评价、优惠券、照护者／服务／门店／创作者详情 | 缺少对应业务 API，使用静态内容和本地交互；评价仅保留草稿，优惠券不抵扣真实订单，示例资料不代表真实资格 |
| 聊天                                                     | 静态会话与本页草稿；不持久化私人消息，不发送到服务端                                                   |
| 钱包                                                     | 使用真实服务者收入投影，不创建提现命令，不展示虚构余额或退款账单                                       |

商业构建共注册 39 个页面。开发环境沿用默认关闭的商业及资格开关；生产构建使用环境开关配置。客户端不自行开通真实资金能力；请求失败保留错误、重试或不可用态，不回退静态业务数据。

## 四端运行

```powershell
pnpm dev:miniapp:h5
pnpm dev:miniapp:mp-weixin
pnpm dev:miniapp:app-android
pnpm dev:miniapp:app-ios
```

## 微信开发者工具本地联调

长期本地 Compose 将 Server 暴露在 `http://127.0.0.1:3300`。使用该环境时，在不提交的
`apps/miniapp/.env.development.local` 中配置：

```bash
VITE_MINIAPP_API_BASE_URL=http://127.0.0.1:3300
```

然后运行 `pnpm dev:miniapp:mp-weixin`，并在微信开发者工具中导入
`apps/miniapp/dist/dev/mp-weixin`。不要把 `dist/build/mp-weixin` 当作默认本地联调产物：普通
`build:mp-weixin` 会加载 `.env.production` 并请求生产 API，生产 Server 若未同步发布最新路由就会返回 404。

H5 本地联调同样应使用本地 Server。当前生产 API 未允许 `http://localhost:5178` 跨域访问，本机静态预览会显示请求失败；不要用静态业务数据掩盖该错误，也不要为预览擅自扩大生产 CORS 允许源。

## 发布前配置

在 `manifest.config.ts` 中将 `__UNI__UNCONFIGURED__` 替换为项目 App ID，并填写用户自有的微信 App ID。Android 签名材料、Apple 证书和描述文件，以及各商店凭据必须保存在本地或受批准的 CI 密钥中，绝不提交到仓库。
