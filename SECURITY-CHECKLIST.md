# 生产环境安全检查清单

生产发布只通过 GitHub `production` Environment 的手动 `deploy.yml` 执行。详细步骤见
[GitHub Actions 手动发布指南](docs/08-deployment/github-actions-deploy.md)。

## P0：首次发布前

- [ ] `petcare-home.com`、`www.petcare-home.com`、`admin.petcare-home.com` 的 DNS A/AAAA 记录均指向生产服务器。
- [ ] 两份 TLS 证书分别覆盖官网两个域名与 Admin 域名；私钥仅以 GitHub Environment Secret 临时传递，服务器
      `/opt/petcare/certs` 为 root-owned `0700`。
- [ ] 边缘防火墙只放行 `22`、`80`、`443`；数据库、Redis、`8986` 与 `8080` 不对公网开放。
- [ ] GitHub `production` Environment 已启用 required reviewers，并保存全部部署、TLS、GHCR、COS 和微信上传 Secret。
- [ ] `DEPLOY_USER` 是专用、仅密钥、非交互账号，不在 Docker 组；它的 passwordless sudo 与 Docker/root-run release
      实际上是 root-equivalent，必须按特权账号管理并定期轮换 SSH 密钥。
- [ ] `/opt/petcare` 和仓库只读 deploy key 均由 root 持有；部署账号不能直接写 checkout。
- [ ] `/opt/petcare/.env` 为 root-owned `0600`，已安全补全并轮换初始管理员密码、`WECHAT_APP_SECRET` 和四个
      `ALIYUN_SMS_*` 值；生产环境没有 `SMS_DEV_CODE`。
- [ ] `DEFAULT_ADMIN_PHONE` 是有效的中国大陆手机号，`JWT_SECRET` 至少 32 字符，数据库、Redis 和管理员密码均为独立强随机值。
- [ ] 阿里云短信签名和模板已审批，模板变量为 `code`；专用 RAM 用户仅有 `dysms:SendSms`，未授予
      `AliyunDysmsFullAccess`。
- [ ] GHCR classic PAT 仅有 `read:packages`，且 `GHCR_PULL_USER` 是该 PAT 所属用户名。

## P0：备份与恢复

- [ ] 备份 COS Bucket 独立于公开素材 Bucket，私有读写、只用 HTTPS，且对象启用 SSE-COS/AES256。
- [ ] 备份 CAM 凭据仅能对该 Bucket 的 `postgresql/*` 执行 `PutObject`、`GetObject`；没有列举、删除、管理、`cos:*` 或资源 `*`。
- [ ] `BACKUP_COS_*` 只存在 GitHub `production` Environment 和 root-owned `0600` 的 `/etc/petcare-backup.env`。
- [ ] `petcare-backup.timer` 已在首次成功发布后启用；已验证一次备份对象的时间、非零大小、加密元数据和临时数据库恢复演练。
- [ ] 为 backup service 失败配置外部告警；COS `postgresql/` 生命周期和非当前版本/delete marker 的 30 天保留策略已配置。

## P1：发布与运行验证

- [ ] 首次发布使用 `target=all`、`initialize_data=true`；日常完整发布使用 `all/false`；选择性发布使用
      `server`、`admin` 或 `website` 和 `false`。
- [ ] 发布提交已成功通过 `ci.yml`，不使用 `prisma:push`；理解 migration 是 forward-only，而镜像回滚不回滚数据库。
- [ ] 发布完成后验证三个 HTTP → HTTPS 重定向与以下 HTTPS 端点：官网根域、`www`、Admin、`/api/ready`。
- [ ] Server、Admin、Website 使用独立不可变 SHA 镜像标签，`/opt/petcare/.deploy-images.env` 只在完整验证后更新。
- [ ] 日志、工单和聊天中没有 `.env`、证书、私钥、Base64、PAT、COS、Aliyun 或 SSH 私钥内容。

## P2：持续维护

- [ ] 定期更新基础镜像和依赖；在 CI 中审查安全告警。
- [ ] 定期轮换部署 SSH key、GHCR PAT、TLS 证书、COS/阿里云凭据、数据库、Redis、JWT 和管理员密码。
- [ ] CDN 只缓存版本化静态资源与公开 COS 素材，不缓存 SSR HTML 或草稿预览。
- [ ] 小程序上传前核对 CI runner IP 白名单；上传工作流只创建开发/体验版，审核和正式发布在微信公众平台人工完成。

本地 HTTP 地址和 `docker-compose.dev.yml` 仅用于可丢弃的开发诊断，不能通过它们代替生产 HTTPS 发布。
