# GitHub Actions 手动发布指南

生产环境只有两个受支持的手动工作流：

- `deploy.yml`：构建并发布 Server、Admin、Website 的 HTTPS 生产镜像；
- `miniapp-release.yml`：构建并上传微信小程序代码到开发版或体验版。

不要在服务器本地构建镜像、执行 `docker compose build`，也不要使用已删除的 tarball 发布脚本。

## 1. 上线前外部条件

- DNS 为 `petcare-home.com`、`www.petcare-home.com` 和 `admin.petcare-home.com` 配置指向服务器的 A/AAAA 记录。
- TLS 证书的 SAN 必须覆盖前两个官网域名，Admin 证书必须覆盖 `admin.petcare-home.com`。
- 腾讯云轻量服务器防火墙只放行 `22`、`80`、`443`；可运维时进一步限制 SSH 来源。
- 为 GitHub `production` Environment 启用 required reviewers。所有生产 Secret 都只放在这个 Environment。
- 为 GHCR 创建只带 `read:packages` 的 classic PAT。`GHCR_PULL_USER` 必须是该 PAT 的 GitHub 用户名，可能与仓库组织名不同。
- 为 Aliyun SMS 创建专用 RAM 用户，只授予 `dysms:SendSms`；短信签名和模板需已审批，模板变量名必须为 `code`。
- 为备份创建独立、私有、HTTPS 的 COS Bucket 和最小权限 CAM 凭据；不要复用官网素材 Bucket。

## 2. 初始化 Ubuntu 服务器（仅一次）

以 root 配置仓库只读 deploy key，并把公钥作为 GitHub repository deploy key（不要授予写权限）。该密钥属于 root，
因为 `/opt/petcare` 和其 Git checkout 始终由 root 持有：

```bash
sudo -i
install -d -m 700 /root/.ssh
ssh-keygen -t ed25519 -f /root/.ssh/petcare-readonly -N ""
cat /root/.ssh/petcare-readonly.pub
```

从可信的本地 checkout 只上传这个公开脚本（不要上传 `.env`、证书或任何私钥），然后以 root 运行它。它生成
root-owned、`0600` 的 `/opt/petcare/.env`，但不会输出其中任何值，不会启动应用，也不会启用备份 timer：

```bash
scp scripts/server-init.sh root@<服务器>:/root/server-init.sh
```

```bash
read -r -p "初始管理员手机号：" DEFAULT_ADMIN_PHONE
sudo REPO_URL=git@github.com:<owner>/petcare.git \
  DEFAULT_ADMIN_PHONE="$DEFAULT_ADMIN_PHONE" \
  bash /root/server-init.sh
unset DEFAULT_ADMIN_PHONE
```

首次发布前，root 必须通过安全终端编辑 `/opt/petcare/.env`，填写并安全轮换初始管理员密码、
`WECHAT_APP_SECRET` 和四个 `ALIYUN_SMS_*` 值。不要使用 `cat`、日志、聊天或工单回传该文件或其内容。
生产值固定为：

```dotenv
API_BASE_URL=https://admin.petcare-home.com/api
ALLOWED_ORIGINS=https://admin.petcare-home.com
WEBSITE_PUBLIC_URL=https://petcare-home.com
WEBSITE_CONTENT_API_BASE_URL=http://server:3000
WECHAT_APP_ID=wx3bdad4ab652f0d1d
```

`WEBSITE_PORT=8080` 只供服务器本机诊断；生产不会公开数据库、Redis、`8986` 或 `8080`。

### 部署 SSH 账号

`DEPLOY_USER` 是专用、仅密钥登录、非交互的自动化账号，不加入 Docker 组，也不能写 `/opt/petcare`。当前工作流必须用
无密码 `sudo` 执行 Docker、root-owned Git、证书、systemd 和 root-run release；这些能力本身已等同 root。
因此应明确把该账号视为受 `production` Environment 审批保护的特权账号，定期轮换 SSH 密钥；不要用脆弱的
命令级 sudo 白名单伪装为最小权限。

## 3. 配置 GitHub `production` Environment

在 **Settings → Environments → production → Environment secrets** 创建下列精确名称：

| Secret                      | 用途                                     |
| --------------------------- | ---------------------------------------- |
| `DEPLOY_HOST`               | 服务器公网主机名或 IP                    |
| `DEPLOY_USER`               | 上述专用特权 SSH 账号                    |
| `DEPLOY_SSH_KEY`            | 该账号的 Actions 私钥完整内容            |
| `DEPLOY_HOST_FINGERPRINT`   | 服务器 SSH host key 的 SHA256 指纹       |
| `GHCR_PULL_USER`            | classic PAT 所属 GitHub 用户名           |
| `GHCR_PULL_TOKEN`           | 仅 `read:packages` 的 classic PAT        |
| `TLS_WEBSITE_CERT_B64`      | `petcare-home.com` 证书 bundle 的 Base64 |
| `TLS_WEBSITE_KEY_B64`       | `petcare-home.com` 私钥的 Base64         |
| `TLS_ADMIN_CERT_B64`        | Admin 证书 bundle 的 Base64              |
| `TLS_ADMIN_KEY_B64`         | Admin 私钥的 Base64                      |
| `BACKUP_COS_SECRET_ID`      | 专用备份 COS 凭据                        |
| `BACKUP_COS_SECRET_KEY`     | 专用备份 COS 凭据                        |
| `BACKUP_COS_BUCKET`         | 私有备份 Bucket                          |
| `BACKUP_COS_REGION`         | 备份 Bucket 区域                         |
| `MP_UPLOAD_PRIVATE_KEY_B64` | 微信小程序代码上传私钥的 Base64          |

在同一 Environment 的 **Variables** 创建 `DEPLOY_PORT=22`。

每次只执行一条 PowerShell 命令，将剪贴板内容保存到对应 Secret 后立刻继续下一条：

```powershell
[Convert]::ToBase64String([IO.File]::ReadAllBytes("D:\projects\petcare\certs\petcare-home.com_bundle.crt")) | Set-Clipboard
[Convert]::ToBase64String([IO.File]::ReadAllBytes("D:\projects\petcare\certs\petcare-home.com.key")) | Set-Clipboard
[Convert]::ToBase64String([IO.File]::ReadAllBytes("D:\projects\petcare\certs\admin.petcare-home.com_bundle.crt")) | Set-Clipboard
[Convert]::ToBase64String([IO.File]::ReadAllBytes("D:\projects\petcare\certs\admin.petcare-home.com.key")) | Set-Clipboard
[Convert]::ToBase64String([IO.File]::ReadAllBytes("D:\projects\petcare\.secrets\wechat\private.wx3bdad4ab652f0d1d.key")) | Set-Clipboard
```

不要把 Base64 值粘贴进 shell history、issue、日志、commit 或文档。每保存一个 Secret 后清空剪贴板：

```powershell
Set-Clipboard -Value ""
```

## 4. 发布主应用

在 **Actions → 手动部署 → Run workflow** 选择已通过 `ci.yml` 的 ref。工作流会解析完整 SHA 并拒绝未成功 CI 的提交。

| 场景         | `target`                       | `initialize_data` |
| ------------ | ------------------------------ | ----------------- |
| 首次发布     | `all`                          | `true`            |
| 日常完整发布 | `all`                          | `false`           |
| 选择性发布   | `server`、`admin` 或 `website` | `false`           |

```text
First deploy: target=all, initialize_data=true
Daily full deploy: target=all, initialize_data=false
Selective deploy: target=server|admin|website, initialize_data=false
```

每个服务使用独立、不可变的 SHA 镜像标签；当前状态原子写入 `/opt/petcare/.deploy-images.env`。Server 变更会在
migration 前执行可恢复的备份，然后使用 forward-only `prisma:migrate:deploy`；应用镜像失败会尝试回滚，数据库 migration
不会自动回滚。工作流使用 `docker compose --wait --wait-timeout 180`，并验证以下 HTTPS 终点：

- `https://petcare-home.com`
- `https://www.petcare-home.com`
- `https://admin.petcare-home.com`
- `https://admin.petcare-home.com/api/ready`

它同时验证三个 HTTP → HTTPS 重定向。发布成功后才持久化镜像状态，并安装备份凭据、启用 `petcare-backup.timer`。

## 5. 上传微信小程序代码

在 **Actions → 小程序上传 → Run workflow** 输入一个已通过 `ci.yml` 的 ref、三段式版本号和备注。该工作流只上传到
微信公众平台的开发版或体验版；提交审核和面向用户的正式发布仍须在微信公众平台人工完成。

小程序后台必须允许 CI runner 的出口 IP。GitHub-hosted runner 的 IP 不稳定；如不能维护白名单，请改用具有固定出口 IP 的
self-hosted runner 后再执行上传。不要关闭该限制而不评估风险。

## 6. 验收与故障边界

发布后访问上述四个 HTTPS 地址，并确认浏览器证书链和域名匹配。服务器上的证书位于 root-owned
`/opt/petcare/certs`（目录 `0700`）；`.env` 与 `/etc/petcare-backup.env` 均为 root-owned `0600`。备份与恢复演练、
COS 生命周期和更细的本地诊断说明见[部署指南](./deployment.md)与[环境变量配置指南](../environment-variables.md)。

Linux Bash、Docker、systemd、真实 DNS/TLS、GitHub Environment、GHCR、COS、Aliyun 和微信上传都是外部运行门槛；
在真实账户和服务器上通过前，不应把静态配置当作已上线验证。
