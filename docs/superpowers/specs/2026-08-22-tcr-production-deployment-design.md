# PetCare TCR 生产发布迁移设计

## 1. 背景

当前生产部署方案将三个应用镜像推送到 GHCR，并要求 Ubuntu 服务器从 GitHub 拉取部署代码、从 GHCR 拉取镜像。实际连通性检查表明：

- 服务器可以正常访问腾讯云和百度 HTTPS。
- `github.com:22`、`ssh.github.com:443`、`github.com:443` 和 `ghcr.io:443` 均超时。
- `https://ccr.ccs.tencentyun.com/v2/` 返回 HTTP `401`，且 `curl` 退出码为 `0`。这说明服务器到腾讯云容器镜像服务的网络和 TLS 正常，返回值仅表示尚未登录。

因此，生产服务器不能继续依赖 GitHub 或 GHCR。部署控制面保留在 GitHub Actions，镜像分发迁移到腾讯云容器镜像服务 TCR 个人版，部署文件通过现有 SSH 通道传输。

本设计是现有[生产部署与发布设计](./2026-08-20-production-deployment-release-design.md)的增量替代方案。除本文件明确修改的 GitHub/GHCR、服务器源码交付和镜像地址外，原设计中的 HTTPS、数据库备份、forward-only migration、选择性发布及 Miniapp 发布边界继续有效。

## 2. 目标与非目标

### 2.1 目标

- 继续通过 GitHub Actions 手动触发 `all`、`server`、`admin`、`website` 生产发布。
- 将 Server、Admin、Website 镜像推送到 TCR，并由服务器通过 HTTPS 拉取。
- 将 PostgreSQL、Redis、Nginx 运行时镜像镜像到 TCR，使服务器不依赖 Docker Hub。
- 服务器不再访问 GitHub，也不再保存 GitHub Deploy Key。
- 通过 SSH 只传输明确允许的部署文件，不覆盖服务器上的生产配置和数据。
- 保留不可变 SHA 镜像标签、选择性发布、健康检查、应用镜像自动回退和数据库 forward-only 约束。
- 保持官网、Admin 和 API 全部使用 HTTPS。
- 保持 Miniapp 独立手动构建上传，不将 Miniapp 放入 Docker 或 TCR。

### 2.2 非目标

- 不在生产服务器安装 VPN、代理或第三方桌面客户端。
- 不通过 `/etc/hosts` 固定 GitHub IP。
- 不自建 Harbor 或其他镜像仓库。
- 不引入 Kubernetes、额外发布平台或新监控系统。
- 不自动提交微信审核或自动发布小程序正式版。
- 不自动回滚数据库 migration。
- 不在本轮迁移 TCR 企业版。个人版不承诺 SLA；当共享实例稳定性、配额或审计能力不能满足生产要求时，再迁移企业版。

## 3. 已确认的总体架构

```text
GitHub Actions
  ├─ checkout + CI 门禁
  ├─ 构建 Server / Admin / Website
  ├─ 使用 push 子账号推送 TCR
  ├─ 通过 SSH 发送部署白名单、证书和临时 pull 凭据
  └─ 触发服务器发布事务

TCR 个人版
  ├─ server / admin / website
  └─ postgres / redis / nginx

Ubuntu 生产服务器
  ├─ 不访问 GitHub、GHCR、Docker Hub
  ├─ 使用临时 Docker 配置从 TCR 拉取
  ├─ Docker Compose 运行 7 个容器
  └─ Edge Nginx 统一提供 HTTP 跳转与 HTTPS

Miniapp GitHub Actions
  └─ 独立构建并上传微信开发版/体验版
```

GitHub Actions 是唯一同时接触 GitHub 源码和 TCR 推送凭据的组件。生产服务器只接收已解析为完整 SHA 的部署材料和 TCR 只读凭据，不再持有源码仓库访问能力。

## 4. TCR 资源设计

### 4.1 命名空间与仓库

创建一个全局唯一的私有命名空间，由 GitHub Environment Variable `TCR_NAMESPACE` 保存。命名空间下预先创建六个私有仓库：

```text
server
admin
website
postgres
redis
nginx
```

Registry 固定为：

```text
ccr.ccs.tencentyun.com
```

工作流对命名空间使用保守校验：长度 2–30，只允许小写字母、数字和单个分隔符 `.`、`_`、`-`，不得以分隔符开头、结尾或连续出现。实际名称仍以个人版控制台创建成功的值为准。

完整应用镜像地址为：

```text
ccr.ccs.tencentyun.com/<TCR_NAMESPACE>/server:sha-<40位SHA>
ccr.ccs.tencentyun.com/<TCR_NAMESPACE>/admin:sha-<40位SHA>
ccr.ccs.tencentyun.com/<TCR_NAMESPACE>/website:sha-<40位SHA>
```

### 4.2 运行时镜像

GitHub Actions 保证以下镜像存在于 TCR：

| 上游镜像             | TCR 仓库   | TCR 标签    |
| -------------------- | ---------- | ----------- |
| `postgres:15-alpine` | `postgres` | `15-alpine` |
| `redis:7-alpine`     | `redis`    | `7-alpine`  |
| `nginx:alpine`       | `nginx`    | `alpine`    |

每次生产发布只检查这些 TCR 标签是否存在；仅在缺失时从上游拉取并推送，已存在时不得覆盖。这样，首次同步后生产发布不再依赖 Docker Hub，运行时标签在 TCR 内保持稳定。若要升级运行时镜像，必须显式修改版本或先经过单独验证，不能在普通应用发布中静默更新。

### 4.3 标签生命周期

应用镜像只使用 `sha-<40位SHA>`，不得使用 `latest` 或短 SHA。TCR 个人版启用全局镜像清理，保留每个仓库最近推送的 30 个版本，避免达到单仓库 100 个版本的默认上限。运行时仓库只有固定标签，不会被该规则全部清空。

被清理的旧应用镜像仍可通过 GitHub Actions 对对应 Git SHA 重新构建并推送，但只允许部署已经成功通过 CI 且包含本迁移发布契约的提交。

## 5. 身份、权限与 Secret

### 5.1 两个专用 CAM 子用户

创建两个不供人员日常使用的 CAM 子用户：

| 子用户             | 用途                    | 长期权限                                         |
| ------------------ | ----------------------- | ------------------------------------------------ |
| `petcare-tcr-push` | GitHub Actions 推送镜像 | 指定命名空间的描述、拉取和推送；无删除和管理权限 |
| `petcare-tcr-pull` | 生产服务器拉取镜像      | 指定命名空间的描述和拉取；无推送、删除和管理权限 |

权限资源限定为 `<TCR_NAMESPACE>` 及其下属仓库，不授予 `tcr:*` 全局权限。推送账号需要 `tcr:PushRepositoryPersonal` 和拉取能力；拉取账号只需要 `tcr:PullRepositoryPersonal` 及官方只读示例要求的描述能力。

两个子用户分别初始化自己的 TCR 个人版登录密码，Registry 用户名使用对应子用户的账号 ID（UIN）。初始化阶段可临时授予创建或修改个人版登录密码所需权限；完成后立即移除临时权限，并关闭子用户的控制台登录能力。只关闭控制台登录，不禁用子用户本身。

关闭控制台登录后，必须分别执行一次真实的最小权限验证：push 子用户能够推送和拉取测试镜像但不能删除，pull 子用户能够拉取但不能推送。任何一项不符合预期都阻止把凭据写入 GitHub；不得假定控制台设置与 Registry 凭据相互独立。

本方案不创建、保存或使用 CAM API `SecretId`/`SecretKey`。GitHub 保存的是 Docker Registry 的 UIN 和 TCR 登录密码。

### 5.2 GitHub `production` Environment

新增 Environment Secrets：

```text
TCR_PUSH_USERNAME
TCR_PUSH_PASSWORD
TCR_PULL_USERNAME
TCR_PULL_PASSWORD
```

新增 Environment Variables：

```text
TCR_REGISTRY=ccr.ccs.tencentyun.com
TCR_NAMESPACE=<全局唯一私有命名空间>
```

沿用现有 SSH、TLS 和备份 Secrets。构建 job 必须显式绑定 `production` Environment 才能读取 push 凭据；部署 job 只引用 pull 凭据。`TCR_PUSH_PASSWORD` 不得进入部署 job，`TCR_PULL_PASSWORD` 不得进入构建 job。

登录统一通过 `--password-stdin` 或官方 Docker 登录 Action 完成。Secret 不得出现在命令行参数、日志、构建参数、镜像层、Artifact 或缓存中。

首次 TCR 发布成功并验证回退前，暂时保留：

```text
GHCR_PULL_USER
GHCR_PULL_TOKEN
```

迁移验收完成后删除这两个旧 Secret。

## 6. GitHub Actions 发布流程

### 6.1 解析与门禁

`.github/workflows/deploy.yml` 保留现有 `workflow_dispatch` 输入：

- `ref`
- `target=all|server|admin|website`
- `initialize_data`

工作流必须：

1. checkout `inputs.ref` 并解析完整 40 位 SHA。
2. 确认该精确 SHA 已成功完成 `ci.yml`。
3. 生成不可变标签 `sha-<SHA>`。
4. 验证 Registry 精确等于 `ccr.ccs.tencentyun.com`，命名空间符合 TCR 命名约束。
5. 使用并发组 `petcare-production` 且 `cancel-in-progress: false`，禁止两个生产发布重叠。

### 6.2 构建和推送

选中的 Server、Admin、Website 继续使用矩阵并行构建。构建 job：

- 只保留 `contents: read`，移除 GHCR 所需的 `packages: write`。
- 使用 `TCR_PUSH_USERNAME` 和 `TCR_PUSH_PASSWORD` 登录 TCR。
- 推送到 `${TCR_REGISTRY}/${TCR_NAMESPACE}/<service>:sha-<SHA>`。
- 保留现有 GitHub Actions BuildKit 缓存。

运行时镜像检查 job 与应用构建并行执行。所有应用镜像和必需运行时镜像准备成功后，部署 job 才能开始 SSH 操作。构建、登录或推送失败时，服务器完全不受影响。

### 6.3 部署文件包

部署 job 从同一个已解析 SHA 创建只包含下列内容的归档：

```text
docker-compose.yml
docker/
scripts/
deploy/
```

归档不得包含 `.git`、`.env`、证书、日志、数据库数据、node_modules 或应用源码。上传前和服务器解压前都要检查归档条目：禁止绝对路径、`..` 路径穿越以及白名单之外的顶层路径。

归档、TLS 文件、备份配置和 TCR pull 密码文件通过已验证主机指纹的现有 SSH 连接传输到本次运行专用的远端临时目录。无论成功或失败，runner 和服务器临时目录都必须清理。

## 7. 服务器文件布局与初始化

服务器使用以下布局：

```text
/opt/petcare/
├─ current -> releases/<SHA>
├─ releases/
│  └─ <SHA>/
│     ├─ docker-compose.yml
│     ├─ docker/
│     ├─ scripts/
│     ├─ deploy/
│     ├─ .env -> /opt/petcare/.env
│     ├─ certs -> /opt/petcare/certs
│     └─ logs -> /opt/petcare/logs
├─ .env
├─ .deploy-images.env
├─ certs/
└─ logs/
```

`.env`、`.deploy-images.env`、证书和日志是持久数据，永远不从 GitHub 归档覆盖。PostgreSQL 和 Redis 使用 Docker named volumes，也不位于发布目录。

Compose 设置固定项目名 `petcare`，确保切换 `current` 符号链接时容器网络和 named volumes 名称不变。systemd 备份服务固定调用 `/opt/petcare/current/scripts/database-backup.sh`。

`server-init.sh` 改为：

- 不再要求 `REPO_URL`、GitHub Deploy Key 或 GitHub `known_hosts`。
- 不安装或使用 Git。
- 使用服务器已配置的 Ubuntu APT 来源准备 Docker Engine 和 Compose v2，并在写入 `/opt/petcare` 前验证 `docker compose version`。
- 不依赖 `download.docker.com`；若当前 Ubuntu 来源不能提供可用 Docker/Compose，则初始化明确失败，不自动添加未知镜像源。
- 创建持久目录、生产 `.env` 和所需权限，但不启动应用。

备份 systemd unit 不由初始化脚本凭空生成。首次部署切换到有效的 `current` release 后，再从该 release 的 `deploy/systemd/` 安装并启用备份 service 和 timer。

## 8. 远端发布事务

远端部署按以下顺序执行：

1. 验证所有参数、远端临时路径和 TCR pull 用户名格式。
2. 在远端临时目录创建权限为 `700` 的临时 `DOCKER_CONFIG`。
3. 通过 `--password-stdin` 登录 TCR，随后立即删除明文密码文件。
4. 校验归档并完整解压到新的 `/opt/petcare/releases/<SHA>`。
5. 创建指向持久 `.env`、证书和日志目录的符号链接。
6. 使用生产 `.env` 执行 `docker compose config --quiet`。
7. 记录旧 `current` 目标，并以临时符号链接加原子重命名切换到新 release。
8. 原子安装已验证的 TLS 证书和备份配置。
9. 执行 `release-production.sh`。
10. 全部健康检查成功后保存 `.deploy-images.env` 并保留当前及上一份 release。
11. 删除远端临时目录和临时 Docker 配置。

`release-production.sh` 继续负责：

- 首次部署必须为 `target=all`。
- 只拉取目标应用所需镜像；首次全量部署同时显式拉取基础设施镜像。
- 启动 PostgreSQL 和 Redis 并等待 healthy。
- 非空数据库在 migration 前完成 COS 备份。
- 使用候选 Server 镜像执行 `prisma migrate deploy`。
- 仅在获准的首次初始化中执行幂等 seed。
- 更新目标应用及相关 Nginx 网关。
- 等待所有相关容器 healthy。
- 验证三个 HTTP 入口精确 301 跳转到 HTTPS。
- 验证官网、Admin 和 API readiness 的 HTTPS 请求。
- 只有全部通过后才原子保存新镜像状态。

## 9. 失败处理与回退

### 9.1 尚未修改服务器的失败

以下失败不会切换 `current` 或启动候选容器；已经完整传输或解压的候选目录可以安全删除：

- 所选 SHA 没有成功 CI。
- 应用构建失败。
- TCR 登录、镜像检查或推送失败。
- SSH 主机指纹不匹配。
- 归档传输不完整或条目不符合白名单。
- TLS 证书与私钥不匹配或域名校验失败。
- 候选 Compose 配置无效。

### 9.2 已开始发布后的失败

已有至少一次成功发布时：

1. `release-production.sh` 使用 `.deploy-images.env` 恢复上一组应用镜像标签。
2. 远端包装事务将 `current` 原子恢复到上一 release。
3. `.deploy-images.env` 保持旧值。
4. TCR 临时凭据和远端临时目录仍按 trap 清理。

TLS 证书是独立且已验证的持久配置，不随应用回退恢复旧证书，避免把有效续期证书换回即将过期的证书。

首次发布没有旧镜像或旧 release 可恢复。首次失败不得删除 PostgreSQL/Redis volumes 或生产 `.env`；工作流停止并保留数据供人工检查。若 migration 已执行，数据库仍遵循 forward-only，禁止自动删除表、还原 volume 或执行反向 migration。

### 9.3 数据库边界

数据库 migration 永远不自动回滚。所有生产 migration 必须使用扩展—迁移—收缩方式并兼容上一应用版本。应用健康检查失败可以回退镜像，但已经成功执行的 schema 变化保留。

首次 `initialize_data=true` 只允许数据库经确认为空且没有成功发布状态时启动。若首次事务在 migration 或幂等 seed 后失败，必须先检查数据库和日志，再按恢复手册继续；不得通过删除 volume 重新开始。

手动应用回退通过重新运行工作流并选择一个此前成功发布、仍满足 TCR 发布契约的完整 SHA 完成。被生命周期规则清理的镜像由工作流重新构建。

## 10. HTTPS 与 Miniapp 边界

HTTPS 继续沿用现有 Edge Nginx 设计：

- 公网仅开放 80、443 和运维 SSH 端口。
- 80 精确 301 跳转到相同主机的 HTTPS。
- `petcare-home.com`、`www.petcare-home.com` 使用官网证书。
- `admin.petcare-home.com` 及其 `/api` 使用 Admin 证书。
- 数据库、Redis、Server 和内部网关不直接暴露公网。

TLS Secrets 仍只保存在 GitHub `production` Environment，并在 runner 和服务器临时目录中解码、验证及清理。TCR 迁移不改变证书文件名或域名映射。

Miniapp 保持独立 `.github/workflows/miniapp-release.yml`：

- 手动选择已通过 CI 的 ref、版本号和备注。
- 从 `MP_UPLOAD_PRIVATE_KEY_B64` 临时解码上传 key。
- 构建 `apps/miniapp` 的 `mp-weixin` 产物并校验 AppID。
- 上传微信开发版/体验版。
- 无论成功失败均删除临时 key。
- 审核提交和正式发布仍由人工在微信公众平台完成。

Miniapp 不构建 Docker 镜像，不进入 TCR，也不部署到 Ubuntu 服务器。

## 11. 验证策略

### 11.1 自动验证

优先扩展现有 `scripts/deploy-policy.test.mjs`，不新增重复测试框架。测试必须证明：

- workflow 不再引用 `ghcr.io`、`GHCR_PULL_*` 或服务器 Git 操作。
- build job 使用 TCR push Secrets，deploy job 只使用 TCR pull Secrets。
- Registry、命名空间和完整 SHA 标签经过校验。
- 归档顶层路径只有允许的四项。
- 服务器使用临时 `DOCKER_CONFIG` 且总会清理。
- `.env`、证书、日志和 `.deploy-images.env` 不从归档覆盖。
- `current` 在验证后原子切换，失败时恢复上一 release。
- 备份、migration、健康检查和状态持久化顺序保持不变。
- Miniapp 工作流仍独立且不引用 TCR。

实现验证至少包括：

```text
bash -n scripts/server-init.sh
bash -n scripts/release-production.sh
bash -n scripts/database-backup.sh
bash -n scripts/database-restore.sh
node --test scripts/deploy-policy.test.mjs
pnpm test:tooling
docker compose config --quiet
git diff --check
```

CI 继续构建 Server、Admin、Website 三个生产镜像。由于本轮修改 CI/部署基础设施，最终候选提交必须完整通过 `ci.yml` 后才能用于真实发布。

### 11.2 首次生产验收

首次发布使用：

```text
target=all
initialize_data=true
```

验收项：

- TCR 六个仓库均为私有。
- 三个应用仓库存在本次完整 SHA 标签。
- PostgreSQL、Redis、Server、Admin、Website、Website Gateway、Edge Gateway 共 7 个容器 healthy。
- 三个 HTTP 域名精确跳转 HTTPS。
- 官网、Admin 和 `/api/ready` 均通过公开可信证书访问成功。
- migration 与首次 seed 成功，生产 `.env`、证书和数据 volume 未被部署归档替换。
- 服务器不存在 Git 仓库依赖，系统 Docker 配置目录没有持久 TCR 密码。
- 备份 timer 已启用，并完成一次 COS 备份及临时数据库恢复演练。
- Miniapp 独立工作流在微信后台产生正确的开发版/体验版。

至少完成第二次成功应用发布后，再选择上一份成功 SHA 做一次人工回退演练，确认应用镜像、`current` release 和健康状态恢复。

## 12. 迁移收尾

首次 TCR 发布和回退演练全部通过后：

1. 删除 GitHub Repository Deploy Key 中的服务器只读 key。
2. 删除服务器 `/root/.ssh/petcare-readonly` 和对应公钥文件。
3. 删除不再使用的 GitHub `known_hosts` GitHub 条目或整个专用文件。
4. 删除 GitHub `production` Environment 的 `GHCR_PULL_USER`、`GHCR_PULL_TOKEN`。
5. 确认 `/opt/petcare` 不含 `.git`，部署 workflow 不执行 `git fetch`、`git checkout` 或 `git clone`。
6. 再执行一次不涉及数据库的选择性发布，证明服务器在没有 GitHub 凭据时仍可正常发布。

在上述验收前不得提前删除旧 Deploy Key，避免迁移中途失去已有恢复路径。

## 13. 预计修改范围

实现阶段预计修改：

- `.github/workflows/deploy.yml`
- `docker-compose.yml`
- `scripts/server-init.sh`
- `scripts/release-production.sh`
- `scripts/database-backup.sh`
- `scripts/database-restore.sh`
- `scripts/deploy-policy.test.mjs`
- `deploy/systemd/petcare-backup.service`
- `docs/08-deployment/deployment.md`
- `docs/08-deployment/github-actions-deploy.md`
- `docker/README.md`
- `SECURITY-CHECKLIST.md`

`.github/workflows/miniapp-release.yml` 的既有安全上传实现不因 TCR 迁移而改造；只有文档或策略测试需要同步说明时才修改。

## 14. 验收标准

满足以下条件才算迁移完成：

1. GitHub Actions 可以手动构建并发布全部或单个 Docker 应用。
2. Server、Admin、Website 和三种运行时镜像只从 TCR 拉取。
3. 生产服务器不访问 GitHub、GHCR 或 Docker Hub。
4. TCR push 与 pull 使用两个最小权限子用户，凭据不长期落盘。
5. 所有公网入口通过 HTTPS，HTTP 只做跳转。
6. Miniapp 可以通过独立手动工作流上传微信开发版/体验版。
7. 应用发布失败可恢复上一应用镜像和部署 release；数据库明确保持 forward-only。
8. `.env`、TLS 私钥、Miniapp 上传 key、数据库数据和日志均不进入 Git、镜像或部署归档。
9. 旧 GHCR Secrets 和 GitHub Deploy Key 已在迁移验收后删除。
10. `master` 历史保持线性，不产生 merge commit。

## 15. 官方参考

- [TCR 个人版快速入门](https://cloud.tencent.com/document/product/1141/63910)
- [TCR 创建个人版命名空间](https://cloud.tencent.com/document/product/1141/41598)
- [TCR 个人版授权方案示例](https://cloud.tencent.com/document/product/1141/41409)
- [TCR 个人版接入 CAM 的 API 列表](https://cloud.tencent.com/document/product/1141/41415)
- [TCR 个人版资源配额与服务边界](https://cloud.tencent.com/document/faq/1141/57780)
- [TCR 个人版镜像清理](https://cloud.tencent.com/document/product/1141/63914)
- [TCR 个人版凭据格式说明](https://cloud.tencent.com/document/product/1141/52292)
- [CAM 更新子用户控制台访问](https://cloud.tencent.com/document/product/598/34583)
