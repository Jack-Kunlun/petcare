#!/usr/bin/env bash
# PetCare Ubuntu 生产服务器首次初始化脚本
# 用途：为 GitHub Actions 的 deploy.yml 准备服务器；生产发布只由该工作流执行。
# 注意：本脚本不启动应用或备份 timer；首次发布前必须由 root 安全补全 .env。
#
# 用法（在服务器上以 root 执行）：
#   read -r -p "初始管理员手机号：" DEFAULT_ADMIN_PHONE
#   sudo REPO_URL=git@github.com:your-name/petcare.git \
#     DEFAULT_ADMIN_PHONE="$DEFAULT_ADMIN_PHONE" bash server-init.sh
#   # 私有仓库的只读 deploy key 必须属于 root（见 docs/08-deployment/github-actions-deploy.md）。
set -euo pipefail

REPO_URL="${REPO_URL:?请通过 REPO_URL 环境变量指定仓库地址}"
INSTALL_DIR="/opt/petcare"

log()  { echo -e "\033[36m[init]\033[0m $*"; }
ok()   { echo -e "\033[32m[ok]\033[0m $*"; }
err()  { echo -e "\033[31m[err]\033[0m $*" >&2; }

if [[ $EUID -ne 0 ]]; then
  if sudo -n true 2>/dev/null; then
    exec sudo bash "$0" "$@"
  else
    err "请用 sudo 执行：sudo REPO_URL=... bash $0"
    exit 1
  fi
fi

umask 077

# ---------- 1. 安装基础软件与 Docker ----------
apt-get update -y
apt-get install -y ca-certificates curl gnupg lsb-release git openssl

if ! command -v docker &>/dev/null; then
  log "安装 Docker..."
  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
  chmod a+r /etc/apt/keyrings/docker.gpg
  echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" \
    > /etc/apt/sources.list.d/docker.list
  apt-get update -y
  apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
  systemctl enable --now docker
  ok "Docker 安装完成：$(docker --version)"
else
  ok "Docker 已存在：$(docker --version)"
fi

# ---------- 2. 克隆代码 ----------
if [[ -d "$INSTALL_DIR/.git" ]]; then
  ok "代码已存在：$INSTALL_DIR"
else
  log "克隆仓库到 $INSTALL_DIR ..."
  install -d -o root -g root -m 755 "$INSTALL_DIR"
  if [[ -f /root/.ssh/petcare-readonly ]]; then
    export GIT_SSH_COMMAND="ssh -i /root/.ssh/petcare-readonly -o IdentitiesOnly=yes"
  fi
  git clone "$REPO_URL" "$INSTALL_DIR"
  ok "代码克隆完成"
fi

# deploy.yml 使用 sudo -H git 操作本目录；不把 checkout 交给部署 SSH 用户。
chown -R root:root "$INSTALL_DIR"

# ---------- 3. 生成生产 .env ----------
cd "$INSTALL_DIR"

install -d -o root -g root -m 700 "$INSTALL_DIR/certs"
chmod 0755 scripts/release-production.sh
chmod 0755 scripts/database-backup.sh scripts/database-restore.sh
install -m 0644 deploy/systemd/petcare-backup.service /etc/systemd/system/petcare-backup.service
install -m 0644 deploy/systemd/petcare-backup.timer /etc/systemd/system/petcare-backup.timer
systemctl daemon-reload

if [[ -f .env ]]; then
  chown root:root .env
  chmod 600 .env
  ok ".env 已存在，跳过生成（如需重置请先手动备份删除）"
else
  DEFAULT_ADMIN_PHONE="${DEFAULT_ADMIN_PHONE:?请通过 DEFAULT_ADMIN_PHONE 提供初始管理员中国大陆手机号}"
  if [[ ! "$DEFAULT_ADMIN_PHONE" =~ ^1[3-9][0-9]{9}$ ]]; then
    err "DEFAULT_ADMIN_PHONE 必须是有效的中国大陆手机号"
    exit 1
  fi

  DB_PASSWORD=$(openssl rand -base64 32 | tr -d '/+=' | head -c 32)
  REDIS_PASSWORD=$(openssl rand -base64 24 | tr -d '/+=' | head -c 24)
  JWT_SECRET=$(openssl rand -base64 48 | tr -d '/+=' | head -c 48)
  ADMIN_PASSWORD=$(openssl rand -base64 24 | tr -d '/+=' | head -c 20)

  cat > .env <<EOF
# ===== 由 server-init.sh 生成的生产环境配置 =====
# 生成时间：$(date '+%Y-%m-%d %H:%M:%S %Z')

PORT=3000
NODE_ENV=production
LOG_LEVEL=info
LOG_DIR=/app/logs

# ===== 数据库（容器内网，容器名即主机名）=====
DB_HOST=postgres
DB_PORT=5432
DB_USERNAME=petcare
DB_PASSWORD=$DB_PASSWORD
DB_NAME=petcare
DB_SCHEMA=public

# ===== Redis =====
REDIS_HOST=redis
REDIS_PORT=6379
REDIS_PASSWORD=$REDIS_PASSWORD

# ===== 异步任务 =====
QUEUE_PREFIX=petcare
WORKER_CONCURRENCY=5
OUTBOX_POLL_INTERVAL_MS=1000
ORDER_TIMEOUT_DELAY_MS=172800000

# ===== JWT =====
JWT_SECRET=$JWT_SECRET
JWT_EXPIRES_IN=7d
JWT_ACCESS_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d
REFRESH_TOKEN_TTL_SECONDS=604800

# ===== 管理员初始化 =====
DEFAULT_ADMIN_USERNAME=admin
DEFAULT_ADMIN_PHONE=$DEFAULT_ADMIN_PHONE
DEFAULT_ADMIN_PASSWORD=$ADMIN_PASSWORD
SMS_DEV_CODE=
SMS_CODE_TTL_SECONDS=300
SMS_SEND_COOLDOWN_SECONDS=60
SMS_HOURLY_LIMIT=5
SMS_MAX_ATTEMPTS=5
CAPTCHA_TTL_SECONDS=300
CAPTCHA_MAX_ATTEMPTS=5

# ===== API / CORS =====
API_BASE_URL=https://admin.petcare-home.com/api
ALLOWED_ORIGINS=https://admin.petcare-home.com

# ===== 官网 =====
WEBSITE_PUBLIC_URL=https://petcare-home.com
WEBSITE_CONTENT_API_BASE_URL=http://server:3000
WEBSITE_LAST_SUCCESS_TTL_SECONDS=300
WEBSITE_PREVIEW_TTL_SECONDS=600
WEBSITE_CONTENT_CACHE_TTL_SECONDS=86400
WEBSITE_PORT=8080

# ===== 第三方（首次发布前由 root 安全填写必填项）=====
WECHAT_APP_ID=wx3bdad4ab652f0d1d
WECHAT_APP_SECRET=
ALIYUN_SMS_ACCESS_KEY_ID=
ALIYUN_SMS_ACCESS_KEY_SECRET=
ALIYUN_SMS_SIGN_NAME=
ALIYUN_SMS_TEMPLATE_CODE=
TENCENT_COS_SECRET_ID=
TENCENT_COS_SECRET_KEY=
TENCENT_COS_BUCKET=
TENCENT_COS_REGION=
TENCENT_COS_PUBLIC_BASE_URL=
EOF
  chown root:root .env
  chmod 600 .env
  ok ".env 已生成（包含随机强密钥；未输出任何配置值）"
fi

echo
echo "================================================"
echo "  服务器初始化完成"
echo "================================================"
echo "代码目录：   $INSTALL_DIR"
echo "配置文件：   $INSTALL_DIR/.env（chmod 600）"
echo "证书目录：   $INSTALL_DIR/certs（chmod 700）"
echo
echo "下一步："
echo "  1. root 安全补全并轮换 .env 中管理员、微信和 Aliyun SMS 配置；不要打印或回传其值"
echo "  2. 在轻量云控制台只放行端口：22、80、443"
echo "  3. 配置 GitHub production Environment（见 docs/08-deployment/github-actions-deploy.md）"
echo "  4. GitHub → Actions → 手动部署 → Run workflow"
echo "================================================"
