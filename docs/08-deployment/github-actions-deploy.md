# GitHub Actions 手动发布指南

生产环境只有两个受支持的手动工作流：

- `deploy.yml`：构建并发布 Server、Admin、Website 及其固定运行时镜像；
- `miniapp-release.yml`：构建并上传微信小程序代码到开发版或体验版。

生产服务器是无源码运行节点：不在服务器本地构建镜像，也不执行 `docker compose build`。应用镜像由 GitHub-hosted runner
构建并作为不可变产物传入，固定运行时镜像从私有 TCR 拉取。

## 生产前提

- DNS 为 `petcare-home.com`、`www.petcare-home.com` 和 `admin.petcare-home.com` 配置指向服务器的 A/AAAA 记录。
- TLS 证书的 SAN 覆盖两个官网域名，Admin 证书覆盖 `admin.petcare-home.com`；公网只放行 `22`、`80`、`443`，数据库、Redis、`8986` 与 `8080` 不对公网开放。
- GitHub `production` Environment 启用 required reviewers；部署、TLS、TCR、备份 COS 和小程序上传配置只保存在这里。
- 阿里云短信认证使用专用 RAM 身份，仅允许 `dypns:SendSmsVerifyCode`，不使用 `AliyunDypnsFullAccess`；使用当前可用且相互配套的系统赠送签名和模板。
- 备份使用独立、私有、HTTPS 的 COS Bucket 和最小权限 CAM 凭据，不复用官网素材 Bucket。

### 专用生产部署 runner

`resolve`、应用镜像构建和固定运行时镜像同步继续使用 GitHub-hosted runner；应用镜像先保存为保留 1 天的不可变 Actions
Artifact。只有 `deploy` job 使用标签
`self-hosted`、`linux`、`x64`、`petcare-deploy` 的仓库级专用 runner。当前 runner 名为 `petcare-wsl-deploy`，运行在隔离的
Ubuntu WSL 中，不挂载 Windows 磁盘、不安装 Docker，也不以 root 或常驻服务运行。它只校验并转发镜像产物和部署材料；生产
服务器在 release 切换前加载并核对所选镜像。

每次手动发布前，在 Ubuntu 中按需启动 runner 并保持终端开启，直到 `deploy` job 完成：

```bash
cd ~/actions-runner
./run.sh
```

看到 `Listening for Jobs` 后再触发工作流；发布结束后使用 `Ctrl+C` 停止 runner。runner 离线时，`deploy` job 会等待而不是回退到
GitHub-hosted runner。

## 1. 创建私有 TCR 命名空间

在 TCR 个人版创建一个全局唯一的**私有**命名空间。记录选择的名称，稍后作为 GitHub Environment Variable 的
`TCR_NAMESPACE`；文档、命令示例和日志都不填写真实账号或密码。

## 2. 创建三个私有运行时仓库

在该命名空间中创建以下三个私有仓库：

```text
postgres
redis
nginx
```

Compose 项目名固定为 `petcare`。`postgres`、`redis` 和 `nginx` 使用已验证的固定运行时标签；生产服务器不从公共镜像仓库
拉取。Server、Admin、Website 不要求 TCR 仓库：它们使用完整 SHA 标签，在 GitHub-hosted runner 构建后以镜像产物传入并
直接加载。

## 3. 配置标签清理

固定运行时标签不能被普通应用发布静默覆盖；升级它们必须先经过单独验证。应用镜像产物保留 1 天，每次发布或回退都会按
所选提交重新构建，不依赖长期保存的 Actions Artifact。

## 4. 配置最小权限 TCR 子用户

创建两个不供人员日常使用的 CAM 子用户，权限资源限定到该命名空间及三个运行时仓库：

| 子用户             | 用途                          | 允许能力             | 不允许能力           |
| ------------------ | ----------------------------- | -------------------- | -------------------- |
| `petcare-tcr-push` | GitHub Actions 运行时镜像同步 | describe、pull、push | 删除或管理仓库       |
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

保留 `DEPLOY_PORT=22` 和 production required reviewers。`deploy.yml` 接受分支、标签或 commit SHA/ref，并在构建/发布前将其
解析为不可变 40 字符完整 SHA。所选提交必须既通过 `ci.yml`，又包含内容严格为单行 `tcr-source-free-v1` 的
`deploy/production-release-contract`；缺失或不匹配会在任何镜像工作前被 `resolve` 拒绝。应用镜像使用不可变
`sha-<40 位 SHA>` 标签发布。

## 8. 配置 GitHub Environment Secrets

添加以下四个 TCR Secrets：

```text
TCR_PUSH_USERNAME
TCR_PUSH_PASSWORD
TCR_PULL_USERNAME
TCR_PULL_PASSWORD
```

同时保留既有的 `DEPLOY_HOST`、`DEPLOY_USER`、`DEPLOY_SSH_KEY`、`DEPLOY_HOST_FINGERPRINT`、TLS、`BACKUP_COS_*`
与 `MP_UPLOAD_PRIVATE_KEY_B64` 配置。阿里云短信认证生产值只在 root-owned、`0600` 的服务器 `.env` 中保存，
不进入镜像或工作流。

固定运行时镜像同步 job 只使用 `TCR_PUSH_*`，部署 job 只使用 `TCR_PULL_*`；应用构建 job 不读取生产 Secret。TCR 密码只可
出现在 runner 和远端的本次临时目录，
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

使用已有的、由 `DEPLOY_HOST_FINGERPRINT` 固定的 SSH 连接将 `scripts/server-init.sh` 传输为
`/tmp/petcare-server-init.sh`，然后以 root 运行它。初始化脚本仅使用已配置的 Ubuntu APT 源安装 Docker 与 Compose v2，
并要求 `docker compose version` 成功；它创建持久目录和根 `.env`，不会获取仓库、不克隆代码、不会启动应用。服务器布局为：

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

### 9.1 首次发布前完成 `.env`

首次 workflow dispatch 前，必须使用 `sudoedit /opt/petcare/.env` 安全补全所有必需生产字段，包括 WeChat 和 Aliyun SMS 值；
不得打印、回显或粘贴任何凭据。只核验 `.env` 元数据：

```bash
sudo stat -c '%U:%G %a' /opt/petcare/.env
# 预期输出：root:root 600
```

确认初始化成功且 `.env` 已补全后，才删除已传输的初始化脚本：

```bash
sudo rm -- /tmp/petcare-server-init.sh
```

## 10. 首次发布、演练与迁移收尾

按以下顺序运行：

1. 触发首次发布：`target=all`、`initialize_data=true`，确认三个 HTTP → HTTPS 跳转和官网、`www`、Admin、`/api/ready` 的 HTTPS。
2. 触发第二次成功发布：`target=all`、`initialize_data=false`，确认不可变镜像状态和 `current` release 已更新。
3. 选择此前成功 SHA 执行回退演练，确认应用镜像和 `current` release 恢复；数据库 migration 保持 forward-only，绝不自动回退。
4. 执行备份与仅临时数据库的恢复演练，核对 COS 对象、加密与非零大小；不得以删除数据库 volume 代替恢复。
5. 在以上项均成功并获得迁移验收前，保留旧 `GHCR_PULL_USER`、`GHCR_PULL_TOKEN` 和服务器 GitHub Deploy Key。
6. 只有验收后才执行以下破坏性清理；不得提前执行，不得打印私钥或凭据，也不得删除整个 `/root/.ssh` 或 `/opt/petcare`。
7. 在 GitHub 仓库设置中删除旧 GitHub Deploy Key，并从 `production` Environment 删除旧 `GHCR_PULL_USER`、`GHCR_PULL_TOKEN` Secrets。
8. 在服务器只删除旧 Deploy Key 的两个明确文件：

   ```bash
   sudo test ! -e /root/.ssh/petcare-readonly || sudo rm -- /root/.ssh/petcare-readonly
   sudo test ! -e /root/.ssh/petcare-readonly.pub || sudo rm -- /root/.ssh/petcare-readonly.pub
   ```

9. `/root/.ssh/known_hosts` 不存在时跳过本步；存在时先检查其非注释行的首字段，确认它是否仍是旧流程创建的 GitHub 专用文件；
   任何无法确认的条目都按混合文件处理：

   ```bash
   sudo awk '!/^[[:space:]]*(#|$)/ { print $1 }' /root/.ssh/known_hosts
   ```

   仅在确认全部条目都属于 `github.com`/`ssh.github.com` 后，才删除整个专用文件：

   ```bash
   sudo rm -- /root/.ssh/known_hosts
   ```

   如果文件包含其他主机或无法确认，保留文件及无关条目，只移除 GitHub 条目和 `ssh-keygen` 生成的临时备份：

   ```bash
   sudo ssh-keygen -R github.com -f /root/.ssh/known_hosts
   sudo ssh-keygen -R "[github.com]:22" -f /root/.ssh/known_hosts
   sudo ssh-keygen -R ssh.github.com -f /root/.ssh/known_hosts
   sudo ssh-keygen -R "[ssh.github.com]:443" -f /root/.ssh/known_hosts
   sudo rm -f -- /root/.ssh/known_hosts.old
   ```

10. 只删除旧仓库元数据目录并验证它已不存在：

    ```bash
    sudo test ! -e /opt/petcare/.git || sudo rm -rf -- /opt/petcare/.git
    sudo test ! -e /opt/petcare/.git
    ```

11. 清理后以 `target=admin` 或 `target=website`、`initialize_data=false` 再运行一次不涉及数据库的选择性发布，证明旧访问已不再需要。

Miniapp 始终单独使用 `miniapp-release.yml` 上传微信开发版或体验版，不构建 Docker 镜像、不进入 TCR，也不部署到 Ubuntu。
提交审核和正式发布仍由人工在微信公众平台完成。小程序后台必须允许 CI runner 的出口 IP；GitHub-hosted runner 的 IP
不稳定，如不能维护白名单，应使用固定出口 IP 的 self-hosted runner，而不是关闭该限制。

备份、数据库边界、TLS 证书和故障处理的细节见[部署指南](./deployment.md)与
[生产环境安全检查清单](../../SECURITY-CHECKLIST.md)。
