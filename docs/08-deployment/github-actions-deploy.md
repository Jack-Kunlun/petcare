# GitHub Actions 手动发布指南

生产环境只有两个受支持的手动工作流：

- `deploy.yml`：构建并发布 Server、Admin、Website 及其固定运行时镜像；
- `miniapp-release.yml`：构建并上传微信小程序代码到开发版或体验版。

生产服务器是无源码运行节点：不在服务器本地构建镜像，也不执行 `docker compose build`，只从私有 TCR 拉取已通过 CI 的镜像。

## 生产前提

- DNS 为 `petcare-home.com`、`www.petcare-home.com` 和 `admin.petcare-home.com` 配置指向服务器的 A/AAAA 记录。
- TLS 证书的 SAN 覆盖两个官网域名，Admin 证书覆盖 `admin.petcare-home.com`；公网只放行 `22`、`80`、`443`，数据库、Redis、`8986` 与 `8080` 不对公网开放。
- GitHub `production` Environment 启用 required reviewers；所有生产 Environment Variables 和 Secrets 只保存在这里。
- Aliyun SMS 使用专用 RAM 身份，仅允许 `dysms:SendSms`，不使用 `AliyunDysmsFullAccess`；签名、模板和变量 `code` 已审批。
- 备份使用独立、私有、HTTPS 的 COS Bucket 和最小权限 CAM 凭据，不复用官网素材 Bucket。

## 1. 创建私有 TCR 命名空间

在 TCR 个人版创建一个全局唯一的**私有**命名空间。记录选择的名称，稍后作为 GitHub Environment Variable 的
`TCR_NAMESPACE`；文档、命令示例和日志都不填写真实账号或密码。

## 2. 创建六个私有仓库

在该命名空间中只创建以下六个私有仓库：

```text
server
admin
website
postgres
redis
nginx
```

Compose 项目名固定为 `petcare`。所有六个镜像族均来自同一私有 TCR 命名空间：应用镜像使用不可变完整 SHA 标签，
`postgres`、`redis` 和 `nginx` 使用已验证的固定运行时标签；生产服务器不从公共镜像仓库拉取。

## 3. 配置标签清理

为每个仓库配置标签清理，保留最新 30 个标签，低于个人版每仓库 100 个标签的上限。固定运行时标签不能被普通应用发布
静默覆盖；升级它们必须先经过单独验证。

## 4. 配置最小权限 TCR 子用户

创建两个不供人员日常使用的 CAM 子用户，权限资源限定到该命名空间及其六个仓库：

| 子用户             | 用途                          | 允许能力             | 不允许能力           |
| ------------------ | ----------------------------- | -------------------- | -------------------- |
| `petcare-tcr-push` | GitHub Actions 构建与镜像同步 | describe、pull、push | 删除或管理仓库       |
| `petcare-tcr-pull` | 生产服务器运行时拉取          | describe、pull       | push、删除或管理仓库 |

不要猜测或复制未核验的策略 ARN；以这些能力边界配置权限即可。

## 5. 初始化 Registry 登录身份

分别为两个子用户初始化 TCR Registry 登录密码，记录各自的 UIN 作为 Registry 用户名。初始化时如必须临时授予
密码管理能力，完成后立即移除；随后关闭两个子用户的控制台登录，但不要禁用子用户本身。

TCR Registry 的用户名和密码不是 CAM API `SecretId`/`SecretKey`。绝不在示例、终端历史、Issue、日志或文档中放入真实凭据。

## 6. 在保存凭据前验证权限

先以临时测试镜像验证：`petcare-tcr-push` 可以 push 和 pull、不能删除；`petcare-tcr-pull` 可以 pull、不能 push。
任一验证失败都不得将凭据保存到 GitHub `production` Environment。

## 7. 配置 GitHub Environment Variables

在 GitHub `production` Environment 添加：

```text
TCR_REGISTRY=ccr.ccs.tencentyun.com
TCR_NAMESPACE=<所选全局唯一私有命名空间>
```

保留 `DEPLOY_PORT=22` 和 production required reviewers。`deploy.yml` 只接受已通过 `ci.yml` 的完整提交 SHA，并用
不可变 `sha-<40 位 SHA>` 标签发布应用镜像。

## 8. 配置 GitHub Environment Secrets

添加以下四个 TCR Secrets：

```text
TCR_PUSH_USERNAME
TCR_PUSH_PASSWORD
TCR_PULL_USERNAME
TCR_PULL_PASSWORD
```

同时保留既有的 `DEPLOY_HOST`、`DEPLOY_USER`、`DEPLOY_SSH_KEY`、`DEPLOY_HOST_FINGERPRINT`、TLS、`BACKUP_COS_*`、
Aliyun SMS 与 `MP_UPLOAD_PRIVATE_KEY_B64` 配置。Aliyun SMS 生产值仍只在 root-owned、`0600` 的服务器 `.env` 中保存，
不进入镜像或工作流。

构建 job 只使用 `TCR_PUSH_*`，部署 job 只使用 `TCR_PULL_*`。TCR 密码只可出现在 runner 和远端的本次临时目录，
并只通过 `--password-stdin` 写入临时 Docker config；发布结束或失败时立即清理，绝不写入 `.env`、镜像、发布归档、日志或缓存。
TLS Base64、SSH 私钥和小程序上传 key 同样只在受保护临时位置解码，不能粘贴进 shell history、Issue 或聊天。

## 9. 初始化 Ubuntu 与部署 SSH

先通过带外可信渠道取得服务器 SSH host key 指纹；不要只信任 `ssh-keyscan`。在已验证的服务器控制台读取公钥指纹，
并将完整 `SHA256:...` 值保存为 `DEPLOY_HOST_FINGERPRINT`：

```bash
ssh-keygen -lf /etc/ssh/ssh_host_ed25519_key.pub -E sha256
```

创建仅供工作流使用的非交互 `DEPLOY_USER`，不加入 Docker 组，也不能直接写 `/opt/petcare`。`authorized_keys` 只放与
`DEPLOY_SSH_KEY` 配对的公钥；不要将 Actions 私钥传到服务器。实际发布需要 Docker、root-owned release、证书和 systemd，
因此下列无密码 sudo 是 root 等价权限：将该账号、其 `authorized_keys` 和 production Environment 审批视作同一特权边界，
而不是用脆弱的命令白名单伪装最小权限。

```bash
DEPLOY_USER=petcare-deploy
adduser --disabled-password --gecos "" "$DEPLOY_USER"
install -d -o "$DEPLOY_USER" -g "$DEPLOY_USER" -m 700 "/home/$DEPLOY_USER/.ssh"
sudoedit "/home/$DEPLOY_USER/.ssh/authorized_keys"
chown "$DEPLOY_USER:$DEPLOY_USER" "/home/$DEPLOY_USER/.ssh/authorized_keys"
chmod 600 "/home/$DEPLOY_USER/.ssh/authorized_keys"
cat > /etc/ssh/sshd_config.d/70-petcare-deploy.conf <<EOF
Match User $DEPLOY_USER
    PubkeyAuthentication yes
    PasswordAuthentication no
    KbdInteractiveAuthentication no
    AuthenticationMethods publickey
EOF
sshd -t && systemctl reload ssh
printf '%s\n' "$DEPLOY_USER ALL=(root) NOPASSWD: ALL" > "/etc/sudoers.d/$DEPLOY_USER"
chmod 440 "/etc/sudoers.d/$DEPLOY_USER"
visudo -cf "/etc/sudoers.d/$DEPLOY_USER"
```

使用已有的、由 `DEPLOY_HOST_FINGERPRINT` 固定的 SSH 连接传输 `scripts/server-init.sh`，然后以 root 运行它。初始化脚本
仅使用已配置的 Ubuntu APT 源安装 Docker 与 Compose v2，并要求 `docker compose version` 成功；它创建持久目录和根 `.env`，
不会获取仓库、不克隆代码、不会启动应用。服务器布局为：

```text
/opt/petcare/
├─ current -> releases/<SHA>
├─ releases/<SHA>/              # 只含发布归档白名单内容
├─ .env
├─ .deploy-images.env
├─ certs/
└─ logs/
```

`/opt/petcare/current` 始终指向不可变 release；`.env`、`.deploy-images.env`、`certs`、`logs` 和 PostgreSQL/Redis named volumes
都在 release 之外持久保存。发布归档允许的顶层内容只有 `docker-compose.yml`、`docker/`、`scripts/`、`deploy/`。

## 10. 首次发布、演练与迁移收尾

按以下顺序运行：

1. 触发首次发布：`target=all`、`initialize_data=true`，确认三个 HTTP → HTTPS 跳转和官网、`www`、Admin、`/api/ready` 的 HTTPS。
2. 触发第二次成功发布：`target=all`、`initialize_data=false`，确认不可变镜像状态和 `current` release 已更新。
3. 选择此前成功 SHA 执行回退演练，确认应用镜像和 `current` release 恢复；数据库 migration 保持 forward-only，绝不自动回退。
4. 执行备份与仅临时数据库的恢复演练，核对 COS 对象、加密与非零大小；不得以删除数据库 volume 代替恢复。
5. 在以上项均成功并获得迁移验收前，保留旧 `GHCR_PULL_USER`、`GHCR_PULL_TOKEN` 和服务器 GitHub Deploy Key；验收后删除
   `GHCR_PULL_USER`、`GHCR_PULL_TOKEN` 和服务器 GitHub Deploy Key，再运行一次不涉及数据库的选择性发布，证明旧访问已不再需要。

迁移验收后删除 GHCR_PULL_USER、GHCR_PULL_TOKEN 和服务器 GitHub Deploy Key。

Miniapp 始终单独使用 `miniapp-release.yml` 上传微信开发版或体验版，不构建 Docker 镜像、不进入 TCR，也不部署到 Ubuntu。
提交审核和正式发布仍由人工在微信公众平台完成。小程序后台必须允许 CI runner 的出口 IP；GitHub-hosted runner 的 IP
不稳定，如不能维护白名单，应使用固定出口 IP 的 self-hosted runner，而不是关闭该限制。

备份、数据库边界、TLS 证书和故障处理的细节见[部署指南](./deployment.md)与
[生产环境安全检查清单](../../SECURITY-CHECKLIST.md)。
