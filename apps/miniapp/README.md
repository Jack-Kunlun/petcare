# PetCare Miniapp

此工作区是 PetCare 的最小业务壳，仅保留单页入口、Wot UI 与 UnoCSS。

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

## 发布前配置

在 `manifest.config.ts` 中将 `__UNI__UNCONFIGURED__` 替换为项目 App ID，并填写用户自有的微信 App ID。Android 签名材料、Apple 证书和描述文件，以及各商店凭据必须保存在本地或受批准的 CI 密钥中，绝不提交到仓库。
