# PetCare 生产部署与发布设计

## 1. 目标与边界

本轮将现有部署骨架收口为可手动触发、可验证、可回滚应用版本的生产发布流程，覆盖四个发布目标：Server、Admin、Website 和 Miniapp。

本轮包含：

- 通过 GitHub Actions 手动选择 Git ref 和 Server、Admin、Website 发布目标。
- 为三个 Docker 应用维护独立镜像标签，支持真正的单应用发布。
- 通过独立 GitHub Actions 工作流编译并上传微信小程序开发版/体验版。
- 为官网、后台和 API 提供统一 HTTPS 公网入口。
- 通过 GitHub Environment Secrets 安全安装 TLS 证书和私钥。
- 将空生产数据库初始化为版本化 Prisma migration，并建立安全的首次 seed。
- 增加依赖就绪检查、发布失败保护、异地数据库备份和恢复说明。
- 修正现有部署脚本、Compose、环境模板、安全清单和部署文档之间的冲突。

本轮不包含：

- 自动提交微信审核或自动发布小程序正式版。
- 自动提交阿里云短信签名、模板或 RAM 授权申请；这些控制台资源由用户预先创建并审核通过。
- 自动回滚数据库 migration。
- 引入 Kubernetes、自建 Prometheus/Grafana/ELK 或其他新部署平台。
- 引入腾讯云 CDN、负载均衡或 WAF；TLS 由当前服务器上的 edge Nginx 终结。

## 2. 已确认决策

- 生产 PostgreSQL 是全新空库，可以直接生成并应用初始 migration。
- 生产短信验证码使用阿里云国内短信 `SendSms`，模板变量固定为 `code`，不允许使用固定开发验证码兜底。
- TLS 证书和私钥保存为 GitHub `production` Environment 的 Base64 Secrets，由工作流自动安装到服务器。
- Docker 应用和小程序上传共用受保护的 `production` Environment；小程序公开 AppID 固定为 `wx3bdad4ab652f0d1d`，不是 Environment Variable。
- 微信代码上传 IP 白名单保持启用。只有出口 IP 已获准时才能使用 GitHub 托管 runner；否则使用固定出口 IP 的自托管 runner。
- 主应用保留 `all`、`server`、`admin`、`website` 四种选择性发布目标。
- Miniapp 使用独立手动工作流，不与 Docker 应用共享发布入口或密钥。
- 小程序发布终点是微信开发版/体验版上传成功；审核与正式发布由人工在微信后台完成。
- PostgreSQL 备份上传独立私有腾讯 COS Bucket，保留 30 天。

## 3. 发布架构

### 3.1 手动部署工作流

`.github/workflows/deploy.yml` 继续使用 `workflow_dispatch`，输入如下：

| 输入              | 类型    | 说明                                   |
| ----------------- | ------- | -------------------------------------- |
| `ref`             | string  | 分支、标签或 commit SHA，默认 `master` |
| `target`          | choice  | `all`、`server`、`admin`、`website`    |
| `initialize_data` | boolean | 仅首次全量部署使用，默认 `false`       |

工作流首先 checkout `inputs.ref`，再以 `git rev-parse HEAD` 得到唯一的完整 commit SHA。后续 checkout、镜像标签、服务器 checkout 和发布记录必须使用同一个 SHA，不得回退到触发工作流所在分支的 `github.sha`。

发布分为以下阶段：

1. 解析 ref、目标服务和镜像标签。
2. 确认该 SHA 的 CI 已成功。
3. 构建选中服务的镜像并推送 GHCR。
4. 进入 `production` Environment 审批与并发锁。
5. 安装并验证 TLS 证书。
6. Server 发布前执行数据库备份和 migration。
7. 更新选中服务并等待健康检查。
8. 重启依赖被替换容器地址的 Nginx 上游。
9. 执行公网 HTTPS smoke checks。
10. 成功后原子保存新的服务镜像标签。

`production` 并发组固定为 `petcare-production`，`cancel-in-progress` 为 `false`。任一时刻最多运行一个生产发布，后触发的发布等待前一个完成。

### 3.2 独立镜像标签

Compose 不再为三个应用共享单一 `IMAGE_TAG`，改为：

```text
SERVER_IMAGE_TAG
ADMIN_IMAGE_TAG
WEBSITE_IMAGE_TAG
```

三个镜像名固定为：

```text
ghcr.io/<owner>/server:<server-tag>
ghcr.io/<owner>/admin:<admin-tag>
ghcr.io/<owner>/website:<website-tag>
```

服务器使用 Git 忽略的 `/opt/petcare/.deploy-images.env` 持久化当前三个标签。首次部署必须选择 `all`，由同一 SHA 初始化全部标签。状态文件不存在或缺少任一标签时，局部发布必须拒绝执行。

局部发布只改变对应标签：

- `server`：构建和替换 Server；完成后重启 Admin Nginx 与 Website Gateway，使其重新解析 Server 容器地址。
- `admin`：构建和替换 Admin；完成后重启 Edge Gateway，使其重新解析 Admin 容器地址。
- `website`：构建和替换 Website；完成后重启 Website Gateway，使其重新解析 Website 容器地址。
- `all`：构建和替换三个应用，并在完成后依次刷新内部网关和 Edge Gateway。

发布过程先在临时环境变量中使用新标签。只有健康检查和公网 smoke checks 全部成功后，才原子替换 `.deploy-images.env`。失败时保留旧标签，并尝试恢复旧应用镜像；数据库 migration 不自动回滚。

### 3.3 CI 门禁

CI 增加 `workflow_dispatch`，允许对准备发布的 ref 手动运行。生产部署只接受同一完整 SHA 已成功完成 CI 的版本。

CI 必须覆盖：

- 格式、Lint、类型检查和现有单元测试。
- Server、Admin、Website 生产构建。
- `docker compose config`。
- Server、Admin、Website Docker 镜像构建。
- Miniapp `build:mp-weixin` 非敏感构建验证。
- GitHub Actions 语法检查和部署策略测试。

## 4. Miniapp 编译与上传

`.github/workflows/miniapp-release.yml` 保持独立 `workflow_dispatch`，输入如下：

| 输入      | 类型   | 说明                                    |
| --------- | ------ | --------------------------------------- |
| `ref`     | string | 已通过 CI 的分支、标签或完整 commit SHA |
| `version` | string | 上传版本号，例如 `2.0.0`                |
| `desc`    | string | 微信后台显示的版本备注                  |

工作流使用同一个受保护的 `production` Environment，只保存：

- Secret `MP_UPLOAD_PRIVATE_KEY_B64`。

公开 AppID 固定为 `wx3bdad4ab652f0d1d`，以 Job 级 `WECHAT_APP_ID` 提供给构建和上传 CLI；不得使用额外的 AppID Variable。`WECHAT_APP_SECRET` 只保存在 Server 生产环境，不得进入 Miniapp 构建或上传工作流。

工作流执行顺序：

1. checkout `inputs.ref` 并解析为完整的 40 位 commit SHA。
2. 要求该精确 SHA 至少有一次成功完成的 `ci.yml`；未通过不得进入上传 Job。
3. 使用该 SHA checkout 并构建，固定 `WECHAT_APP_ID=wx3bdad4ab652f0d1d`。
4. 使用 pnpm lockfile 中固定的官方 `miniprogram-ci@2.1.31`，通过 `pnpm --dir apps/miniapp exec` 调用；不得运行 `npx`、`@latest` 或运行时下载。
5. 执行 `pnpm build:miniapp:mp-weixin`，验证 `app.json` 和 `project.config.json` 存在且非空，再用 Node 标准库解析 `project.config.json`，要求其 `appid` 精确等于 Job 级 `WECHAT_APP_ID`。
6. 版本号必须为 SemVer 形状，备注非空且不含换行；私钥仅在解码步骤暴露，并在 runner 临时目录以目录 `700`、文件 `600` 权限解码。
7. 使用 `miniprogram-ci upload`、robot `1` 和 `--use-project-config true` 上传开发版/体验版。
8. 无论成功或失败，始终删除且只删除该次运行的临时密钥目录。

微信代码上传 IP 白名单必须保持启用。GitHub 托管 runner 仅在其出口 IP 已加入白名单时可运行；否则此工作流必须改由固定出口 IP 的自托管 runner 执行，不能以关闭白名单作为替代。

上传成功只表示代码已到达微信公众平台，不表示审核通过或正式版上线。正式审核与发布继续由人工操作。

Miniapp 未来访问 API 时使用 `https://admin.petcare-home.com/api`。微信后台登记的 request 合法域名为 `https://admin.petcare-home.com`，不得包含 `/api` 路径。

## 5. HTTPS 与密钥生命周期

### 5.1 公网路由

公网只开放 80 和 443：

- 80 将所有请求 301 重定向到 HTTPS。
- `petcare-home.com` 和 `www.petcare-home.com` 代理 Website Gateway。
- `admin.petcare-home.com` 代理 Admin；Admin 的 `/api` 继续代理 Server。
- PostgreSQL、Redis 和 Server 不发布宿主机端口。
- Admin 8986 与 Website Gateway 8080 仅绑定 `127.0.0.1`，用于服务器本机诊断。

Docker 内部的 `http://server:3000`、`http://website:4321` 等地址保留为容器私网 HTTP，不对公网暴露，不重复增加容器间 TLS。

Edge Nginx 保留 TLS 1.2/1.3，移除 3DES cipher，并为 HTTPS 响应增加不含 `includeSubDomains` 的 HSTS。内部 Nginx 必须保留 Edge 传入的 `X-Forwarded-Proto: https`。

### 5.2 TLS Secrets

`production` Environment 保存：

```text
TLS_WEBSITE_CERT_B64
TLS_WEBSITE_KEY_B64
TLS_ADMIN_CERT_B64
TLS_ADMIN_KEY_B64
```

当前证书映射为：

| Secret                 | 服务器文件                          |
| ---------------------- | ----------------------------------- |
| `TLS_WEBSITE_CERT_B64` | `petcare-home.com_bundle.crt`       |
| `TLS_WEBSITE_KEY_B64`  | `petcare-home.com.key`              |
| `TLS_ADMIN_CERT_B64`   | `admin.petcare-home.com_bundle.crt` |
| `TLS_ADMIN_KEY_B64`    | `admin.petcare-home.com.key`        |

主域证书覆盖 `petcare-home.com` 与 `www.petcare-home.com`；后台证书覆盖 `admin.petcare-home.com`。API 使用后台域名 `/api`，不增加第三张证书。

部署 job 必须：

1. 在输出任何内容前验证四个 Secret 非空。
2. 只在 runner 临时目录解码文件，不写入 checkout。
3. 使用 `DEPLOY_HOST_FINGERPRINT` 验证 SSH 主机身份。
4. 将文件上传到服务器临时目录。
5. 以原子方式安装到 `/opt/petcare/certs`。
6. 设置目录 `700`、证书 `644`、私钥 `600`。
7. 校验证书有效期并启动 Edge Gateway。
8. 无论成功或失败，清理 runner 与服务器临时文件。

### 5.3 本地密钥保护

仓库根目录现有 TLS 文件移动到 `certs/`，小程序上传密钥移动到 `.secrets/wechat/`。两个目录及所有常见密钥、证书和 CSR 扩展名同时加入 `.gitignore` 与 `.dockerignore`：

```text
certs/
.secrets/
*.key
*.pem
*.crt
*.csr
*.p12
*.pfx
```

私钥文件的 Windows ACL 收紧为当前用户、Administrators 和 SYSTEM。任何私钥都不得进入 Git 索引、Git 历史、Docker build context、镜像层、构建参数或日志。

## 6. 数据库与初始数据

### 6.1 版本化 migration

生产数据库为空，因此使用 Prisma CLI 从当前 schema 生成初始 migration，并提交 `apps/server/prisma/migrations/`。`.gitignore` 不再忽略 migration。

Server 发布顺序固定为：

1. 启动并等待 PostgreSQL、Redis healthy。
2. 发布前备份现有数据库；首次空库允许没有历史数据。
3. 使用待发布 Server 镜像执行 `prisma migrate deploy`。
4. 当且仅当 `initialize_data=true` 且目标为 `all` 时执行 seed。
5. 更新 Server 并等待 `/ready` 成功。

生产部署不得执行 `prisma db push`。

### 6.2 Seed 安全

默认管理员的密码、状态、用户名和昵称只在用户不存在时写入。管理员已经存在时，seed 不得重置密码、重新激活账号或覆盖人工资料。

角色、权限、系统设置和官网初始内容继续使用可重复执行的 upsert，但不得覆盖已经由后台编辑的生产内容。首次 seed 成功后，日常部署默认不再执行 seed。

## 7. 运行时健康与短信策略

### 7.1 短信验证码

生产环境注册阿里云短信发送器，继续复用现有 `SmsSender` 接口；开发环境保留本地发送器。阿里云客户端在 Nest 生命周期内只创建一次，固定使用中国站 `dysmsapi.aliyuncs.com` Endpoint，并通过已审核的签名和模板调用 `SendSms`。

- 生产启动必须同时具备 `ALIYUN_SMS_ACCESS_KEY_ID`、`ALIYUN_SMS_ACCESS_KEY_SECRET`、`ALIYUN_SMS_SIGN_NAME` 和 `ALIYUN_SMS_TEMPLATE_CODE`；缺少任一项都使 Server 启动和发布健康检查失败。
- 模板参数只发送 `{"code":"<六位验证码>"}`；只有响应 `Code=OK` 才视为发送成功。
- `SendSms` 不具备幂等能力，应用层不得自动重试，避免网络结果不明时重复发送和计费。
- SDK 异常或非 `OK` 响应统一转换为 `503 SMS_DELIVERY_FAILED`；客户端、日志和异常堆栈不得包含手机号、验证码、AccessKey 或完整供应商请求。
- 发送失败后清除刚生成的 OTP 和发送冷却状态；不得记录伪造成功，也不得使用 `SMS_DEV_CODE` 兜底。

现有图形验证码、账号存在性响应、OTP 摘要存储、发送冷却和小时限额保持不变。管理员密码登录和微信登录不受该策略影响。

### 7.2 健康检查

- `/health` 是 liveness，只证明 Nest 进程可响应。
- `/ready` 是 readiness，必须验证 PostgreSQL 查询和 Redis ping。
- Server 容器健康检查使用 `/ready`。
- Admin、Website、内部网关和 Edge Gateway 保留各自 HTTP/HTTPS 健康检查。
- 部署使用 `docker compose up --wait --wait-timeout 180`，不再使用固定 `sleep` 后只打印状态。

公网发布完成后检查：

```text
https://petcare-home.com
https://www.petcare-home.com
https://admin.petcare-home.com
https://admin.petcare-home.com/api/ready
```

任一请求失败、TLS 验证失败或 readiness 非成功状态，发布不得标记成功。

## 8. PostgreSQL 异地备份

### 8.1 存储与凭据

数据库备份使用独立私有腾讯 COS Bucket，不复用官网素材 Bucket 或其凭据。服务器使用以下配置：

```text
BACKUP_COS_SECRET_ID
BACKUP_COS_SECRET_KEY
BACKUP_COS_BUCKET
BACKUP_COS_REGION
```

COS 账号仅拥有指定 Bucket 数据库备份前缀所需的最小读写权限。Bucket 开启 COS 服务端加密，并配置 30 天生命周期删除规则。传输只使用 HTTPS。

生产部署 job 将四个备份 Secret 原子写入服务器 `/etc/petcare-backup.env`。该文件归 root 所有、权限为 `600`，systemd service 通过 `EnvironmentFile=` 读取；凭据不写入仓库 checkout、应用 `.env` 或命令行参数。

### 8.2 备份流程

- 服务器安装 systemd timer，每日调用仓库内 `scripts/database-backup.sh`。
- 脚本通过 PostgreSQL 容器执行 `pg_dump --format=custom`，不在宿主机额外安装 PostgreSQL 客户端。
- 上传步骤使用 Server 镜像中已经安装的 `cos-nodejs-sdk-v5` 和专用 Node CLI；配置仍通过 Server `ConfigService` 读取。
- Server 生产发布在 migration 前执行一次相同备份。
- dump 文件以仅 root 可读权限写入服务器临时目录。
- 上传前执行完整性检查；检查或上传失败返回非零。
- 上传成功后立即删除本地临时 dump。
- 备份对象键包含 UTC 时间、数据库名和 schema，避免覆盖历史备份。
- 首次空库部署可以在 PostgreSQL 初始化后直接 migration，不要求存在历史备份。

Server 发布前备份失败必须阻止 migration 和应用替换。每日 timer 失败记录到 systemd journal，并由腾讯云或 GitHub 外部告警配置监测。

### 8.3 恢复

仓库提供恢复文档和脚本参数约定，恢复流程必须显式指定备份对象，不允许默认选择“最新”后直接覆盖生产库。恢复演练步骤包括：

1. 下载指定 COS 对象。
2. 校验 dump 可读取。
3. 恢复到独立临时数据库。
4. 运行关键表和 migration 状态检查。
5. 删除临时数据库和本地 dump。

生产恢复属于人工确认的破坏性操作，不放入日常部署工作流。

## 9. 错误处理与回滚

- 所有 Secret 和 Variable 在使用前验证；缺失时以名称明确报错，不打印值。
- 镜像构建失败时不进入生产 Environment。
- TLS 安装失败时不修改运行中的 Edge Gateway。
- 备份失败或 migration 失败时不替换 Server。
- 应用健康检查失败时保留旧标签，并尝试恢复旧应用镜像。
- `.deploy-images.env` 只在全部发布验证成功后原子更新。
- 小程序构建或上传失败时删除临时密钥并返回失败，不影响 Docker 应用。
- 应用回滚通过重新选择旧 ref 构建和部署；数据库 migration 不自动回滚。

未来 schema migration 必须采用向后兼容的扩展—迁移—收缩顺序，确保旧应用在发布故障时仍可暂时运行。

## 10. 验证策略

### 10.1 自动验证

- 使用 actionlint 校验所有 workflow 的 YAML、表达式和 job 依赖。
- 部署策略测试覆盖 ref 解析、JSON matrix、镜像命名、独立标签、Environment、并发锁、TLS Secret、migration 顺序和 `--wait`。
- Miniapp 发布策略测试覆盖构建产物 AppID 与上传 AppID 的精确一致性、固定 `miniprogram-ci` 版本、Secret 非空检查和临时密钥清理。
- Server 单元测试覆盖阿里云请求映射、生产/开发发送器选择、配置缺失、供应商失败清理、readiness 和 seed 不覆盖管理员。
- Compose 策略测试覆盖生产 DB/Redis 无宿主机端口、唯一公网 80/443、证书只读挂载和独立镜像标签。
- CI 构建三个 Docker 镜像和 Miniapp 微信产物。

### 10.2 生产验证

- `docker compose config` 成功。
- PostgreSQL、Redis、Server、Admin、Website、Website Gateway、Edge Gateway 均 healthy。
- 四个 HTTPS smoke checks 成功，HTTP 自动跳转 HTTPS。
- 两张证书的 SAN 与域名匹配，证书未过期。
- 首次 migration 和 seed 成功，重复运行 migration 不产生变更。
- Miniapp 上传结果在微信后台出现正确 AppID、版本号和备注。
- 手动备份可上传 COS，并至少完成一次恢复到临时数据库的演练。

## 11. 外部配置清单

### 11.1 GitHub `production` Environment Secrets

```text
DEPLOY_HOST
DEPLOY_USER
DEPLOY_SSH_KEY
DEPLOY_HOST_FINGERPRINT
GHCR_PULL_TOKEN
TLS_WEBSITE_CERT_B64
TLS_WEBSITE_KEY_B64
TLS_ADMIN_CERT_B64
TLS_ADMIN_KEY_B64
BACKUP_COS_SECRET_ID
BACKUP_COS_SECRET_KEY
BACKUP_COS_BUCKET
BACKUP_COS_REGION
MP_UPLOAD_PRIVATE_KEY_B64
```

Environment Variable：

```text
DEPLOY_PORT=22
```

### 11.2 服务器生产环境

服务器 `.env` 使用最终 HTTPS 值：

```text
API_BASE_URL=https://admin.petcare-home.com/api
ALLOWED_ORIGINS=https://admin.petcare-home.com
WEBSITE_PUBLIC_URL=https://petcare-home.com
WEBSITE_CONTENT_API_BASE_URL=http://server:3000
WECHAT_APP_ID=wx3bdad4ab652f0d1d
ALIYUN_SMS_ACCESS_KEY_ID=<RAM AccessKey ID>
ALIYUN_SMS_ACCESS_KEY_SECRET=<RAM AccessKey Secret>
ALIYUN_SMS_SIGN_NAME=<已审核短信签名>
ALIYUN_SMS_TEMPLATE_CODE=<已审核验证码模板 Code>
```

`WECHAT_APP_SECRET`、阿里云短信 AccessKey、数据库密码、Redis 密码、JWT Secret 和初始管理员凭据由用户安全录入或由服务器初始化脚本生成，不进入 Git。阿里云 AccessKey 必须属于专用 RAM 用户，权限限定为发送短信所需操作。

### 11.3 控制台配置

- DNS：`petcare-home.com`、`www.petcare-home.com`、`admin.petcare-home.com` 指向 Edge 服务器。
- 腾讯云防火墙：只开放 22、80、443。
- 微信公众平台：保持代码上传 IP 白名单启用；仅允许获准的 GitHub 托管 runner 出口 IP，或固定出口 IP 的自托管 runner；登记 `https://admin.petcare-home.com` 为 request 合法域名。
- 阿里云短信：签名和验证码模板均已审核通过，模板变量名为 `code`，专用 RAM 用户具备 `dysms:SendSms` 权限。
- COS：创建独立私有备份 Bucket，启用服务端加密和 30 天生命周期。
- GitHub：为唯一的 `production` Environment 配置全部 Environment Secrets、`DEPLOY_PORT=22` Variable 和适用的审批规则。

## 12. 文档与维护

实现时同步更新：

- `.env.example` 与 `docs/environment-variables.md`。
- `docs/08-deployment/deployment.md`。
- `docs/08-deployment/github-actions-deploy.md`。
- `SECURITY-CHECKLIST.md`。
- `docker/README.md`。

删除或明确废弃未被正式流程引用的 `scripts/deploy-to-server.sh`，只保留 `server-init.sh` 加两条 GitHub Actions 手动工作流作为受支持的发布路径。服务器初始化文档必须只要求开放 22、80、443，并在首次发布前完成 GitHub Environment、COS 和微信后台配置。
