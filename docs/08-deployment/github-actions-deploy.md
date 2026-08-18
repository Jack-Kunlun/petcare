# GitHub Actions 手动部署指南（腾讯轻量云）

本文档说明如何通过 GitHub Actions **手动触发**构建，把 `server` / `admin` / `website` 三个服务以 Docker 镜像方式部署到腾讯轻量云服务器。

整体流程：

```
GitHub 网页点击 Run workflow
        │
        ▼
GitHub Actions 构建三个镜像 ──推送──▶ ghcr.io（GitHub Container Registry）
        │
        ▼ SSH
轻量云服务器：git 同步配置 → docker login ghcr.io
        → docker compose pull → docker compose up -d --no-build
        →（可选）prisma:push + prisma:seed
```

服务器上**不再执行构建**，只拉取现成镜像，因此低配轻量云也能流畅部署。

## HTTPS 域名架构（petcare-home.com）

`edge-gateway`（nginx 容器）是唯一公网入口（80/443），证书挂载自服务器 `/opt/petcare/certs`（不入 Git）：

| 域名                   | 服务                        | 证书文件                                     |
| ---------------------- | --------------------------- | -------------------------------------------- |
| petcare-home.com / www | website（官网）             | `petcare-home.com_bundle.crt` + `.key`       |
| admin.petcare-home.com | admin（后台 + `/api` 反代） | `admin.petcare-home.com_bundle.crt` + `.key` |

- HTTP 80 统一 301 到 HTTPS
- admin（8986）与 website-gateway（8080）仅绑定 `127.0.0.1`，不再暴露公网
- 官网页脚已内置备案号（工信部 + 公安），合规展示
- 证书续期：腾讯云 SSL 控制台重新下载 nginx 格式后，替换 `/opt/petcare/certs` 对应文件并执行 `docker compose --env-file .env restart edge-gateway`

> admin 子域名证书需单独申请（腾讯云免费证书，每年 20 张额度）；签发前可临时使用自签名证书（浏览器会告警但可访问）。

---

## 一、服务器初始化（全新服务器，执行一次）

### 1. 登录服务器

```bash
ssh root@<服务器公网IP>
```

### 2. 配置仓库访问（私有仓库需要）

如果仓库是私有的，需要为服务器生成一个只读 SSH deploy key：

```bash
# 在服务器上生成密钥（无口令）
ssh-keygen -t ed25519 -f ~/.ssh/id_ed25519 -N ""
cat ~/.ssh/id_ed25519.pub
```

把输出的公钥添加到 GitHub 仓库：**Settings → Deploy keys → Add deploy key**（不勾选写权限）。

### 3. 执行初始化脚本

```bash
# 上传 scripts/server-init.sh 到服务器后执行（或直接复制粘贴内容）
REPO_URL=git@github.com:<你的用户名>/petcare.git bash server-init.sh
```

脚本会自动完成：

- 安装 Docker、docker compose 插件、git
- 克隆仓库到 `/opt/petcare`
- 生成含随机强密钥的生产 `.env`（管理员密码会在执行结束时打印，注意保存）

### 4. 轻量云控制台放行防火墙端口

在腾讯云轻量应用服务器控制台 → **防火墙**，放行：

| 端口 | 用途                                                |
| ---- | --------------------------------------------------- |
| 22   | SSH（GitHub Actions 部署通道）                      |
| 8080 | 官网（website-gateway）                             |
| 8986 | 后台管理 + API（admin nginx 反代 `/api` 到 server） |

> 数据库和 Redis 端口**不要**放行（`.env` 中 `EXPOSE_DB_PORT` / `EXPOSE_REDIS_PORT` 保持为空）。

---

## 二、GitHub 仓库配置

### 1. 为 Actions 生成部署 SSH 密钥（本地执行）

GitHub Actions 需要一个能登录服务器的私钥：

```bash
# 本地生成专用密钥
ssh-keygen -t ed25519 -f ./deploy_key -N ""

# 把公钥追加到服务器（Ubuntu: /root/.ssh/authorized_keys）
ssh-copy-id -i ./deploy_key.pub root@<服务器公网IP>
```

### 2. 生成 GHCR 拉取令牌

Actions 推送镜像用的是自带的 `GITHUB_TOKEN`，但服务器拉取私有镜像需要单独的只读令牌：

GitHub → Settings → Developer settings → **Personal access tokens (classic)** → Generate new token：

- 勾选 `read:packages`
- 生成后复制令牌（只显示一次）

> 替代方案：把 package 设为 public 后服务器可以匿名拉取，此时 `GHCR_PULL_TOKEN` 可以不填（不推荐私有项目使用）。

### 3. 配置仓库 Secrets

GitHub 仓库 → **Settings → Secrets and variables → Actions → New repository secret**：

| Secret 名称       | 值                                     |
| ----------------- | -------------------------------------- |
| `DEPLOY_HOST`     | 服务器公网 IP                          |
| `DEPLOY_USER`     | SSH 用户（一般为 `root` 或 `ubuntu`）  |
| `DEPLOY_SSH_KEY`  | 上一步 `deploy_key` 私钥的**完整内容** |
| `GHCR_PULL_TOKEN` | 只读拉取令牌（上一步生成）             |

可选：在 **Variables** 中添加 `DEPLOY_PORT`（SSH 端口，默认 22）。

---

## 三、日常使用

GitHub 仓库 → **Actions → 手动部署 → Run workflow**，按提示选择：

| 参数          | 说明                                                                                     |
| ------------- | ---------------------------------------------------------------------------------------- |
| `ref`         | 要部署的分支 / 标签 / commit SHA，默认 `master`                                          |
| `target`      | `all`（全部）/ `server` / `admin` / `website`                                            |
| `sync_schema` | 部署后执行 `prisma:push` + `prisma:seed`；**首次部署必须勾选**，日常只改前端代码时可不勾 |

镜像标签格式为 `sha-<短哈希>`（例如 `sha-1a2b3c4`），每次部署精确对应一个 commit，回滚时只需重新以旧 commit 触发一次 workflow。

部署完成后验证：

```bash
ssh root@<服务器IP>
cd /opt/petcare
docker compose --env-file .env ps        # 所有服务应为 healthy
curl http://127.0.0.1:8986/api/health    # API 健康检查
```

### 访问地址

- 后台管理：`http://<服务器IP>:8986`
- 官网：`http://<服务器IP>:8080`
- API：`http://<服务器IP>:8986/api`

> 生产环境建议后续绑定域名并配置 HTTPS（可用轻量云免费证书 + nginx），届时同步更新 `.env` 中的 `ALLOWED_ORIGINS`、`API_BASE_URL`、`WEBSITE_PUBLIC_URL`。

---

## 四、镜像标签机制

`docker-compose.yml` 中三个自有服务的镜像名由环境变量驱动：

```yaml
image: ${IMAGE_REGISTRY:-petcare}/server:${IMAGE_TAG:-local}
```

- 本地开发 `docker compose build` → 打标签为 `petcare/server:local`
- 部署流水线中 → `IMAGE_REGISTRY=ghcr.io/<owner>`、`IMAGE_TAG=sha-<短哈希>`

服务器上执行 `docker compose up -d --no-build` 时不会触发构建，只使用拉取下来的镜像。

---

## 五、小程序（miniapp）一键构建说明

小程序与上述三个服务不同：它**不部署到你的服务器**，而是构建后上传到**微信公众平台**，用户通过微信访问。一键构建方案为 GitHub Actions + [miniprogram-ci](https://developers.weixin.qq.com/miniprogram/dev/devtools/ci.html)：

1. 微信公众平台（mp.weixin.qq.com）→ 开发管理 → 开发设置 → **小程序代码上传** → 生成上传密钥（`.key` 文件）
2. 把密钥文件内容存为仓库 Secret `MP_UPLOAD_PRIVATE_KEY`
3. 关闭或配置 **IP 白名单**：GitHub Actions runner IP 不固定，建议关闭白名单或改为在服务器上跑上传脚本
4. 触发 workflow：`pnpm --filter @petcare/miniapp build:mp-weixin` 后用 miniprogram-ci 的 `upload` API 上传 `dist/build/mp-weixin`

> 注意：上传前需把 miniapp 中的 API 地址指向服务器正式地址（`http://<IP>:8986/api`），且微信小程序正式版要求 HTTPS 域名，开发调试阶段可在微信开发者工具中勾选「不校验合法域名」。

需要时可以为 miniapp 单独添加一个 `miniapp-release.yml` workflow（同样是手动触发），拿到上传密钥后即可接入。

---

## 六、常见问题

| 问题                | 处理                                                                                 |
| ------------------- | ------------------------------------------------------------------------------------ |
| 部署时 SSH 连接超时 | 检查轻量云防火墙是否放行 22 端口；检查 `DEPLOY_HOST` / `DEPLOY_PORT`                 |
| 服务器拉取镜像 401  | `GHCR_PULL_TOKEN` 过期或缺少 `read:packages` 权限，重新生成                          |
| `git clone` 失败    | 私有仓库未配置 deploy key，或密钥未关联到服务器                                      |
| 服务反复重启        | `cd /opt/petcare && docker compose --env-file .env logs -f server` 查看日志          |
| 首次部署数据库报错  | 确认 `sync_schema` 已勾选；`postgres` 容器需先健康，compose 已通过 `depends_on` 保证 |
