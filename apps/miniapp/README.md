# PetCare Miniapp

此工作区是 PetCare 的最小业务壳，仅保留单页入口、Wot UI 与 UnoCSS。

## 四端运行

```powershell
pnpm dev:miniapp:h5
pnpm dev:miniapp:mp-weixin
pnpm dev:miniapp:app-android
pnpm dev:miniapp:app-ios
```

## 发布前配置

在 `manifest.config.ts` 中将 `__UNI__UNCONFIGURED__` 替换为项目 App ID，并填写用户自有的微信 App ID。Android 签名材料、Apple 证书和描述文件，以及各商店凭据必须保存在本地或受批准的 CI 密钥中，绝不提交到仓库。
