#!/usr/bin/env bash
# PetCare 轻量云服务器首次初始化脚本（Ubuntu，全新服务器一键执行）
# 用途：为 GitHub Actions 手动部署流水线（.github/workflows/deploy.yml）准备服务器环境
# 完成：安装 Docker + git → 克隆仓库到 /opt/petcare → 生成生产 .env
# 注意：本脚本不启动任何容器；首次部署请在 GitHub 网页上手动触发「手动部署」workflow
#
# 用法（在服务器上以 root 执行）：
#   REPO_URL=git@github.com:your-name/petcare.git bash server-init.sh
#   # 私有仓库请先配置 SSH deploy key（见 docs/08-deployment/github-actions-deploy.md）
set -euo pipefail

REPO_URL="${REPO_URL:?请通过 REPO_URL 环境变量指定仓库地址}"
SERVER_IP="${SERVER_IP:-$(curl -fsS --max-time 5 https://ifconfig.me || curl -fsS --max-time 5 https://api.ipify.org)}"
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

if [[ -n "${SUDO_USER:-}" ]]; then
  usermod -aG docker "$SUDO_USER" || true
fi

# ---------- 2. 克隆代码 ----------
if [[ -d "$INSTALL_DIR/.git" ]]; then
  ok "代码已存在：$INSTALL_DIR"
else
  log "克隆 $REPO_URL 到 $INSTALL_DIR ..."
  mkdir -p "$INSTALL_DIR"
  git clone "$REPO_URL" "$INSTALL_DIR"
  ok "代码克隆完成"
fi

# ---------- 3. 生成生产 .env ----------
cd "$INSTALL_DIR"

chmod 0755 scripts/database-backup.sh scripts/database-restore.sh
install -m 0644 deploy/systemd/petcare-backup.service /etc/systemd/system/petcare-backup.service
install -m 0644 deploy/systemd/petcare-backup.timer /etc/systemd/system/petcare-backup.timer
systemctl daemon-reload

if [[ -f .env ]]; then
  ok ".env 已存在，跳过生成（如需重置请先手动备份删除）"
else
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
DEFAULT_ADMIN_PHONE=13800138000
DEFAULT_ADMIN_PASSWORD=$ADMIN_PASSWORD
SMS_DEV_CODE=
SMS_CODE_TTL_SECONDS=300
SMS_SEND_COOLDOWN_SECONDS=60
SMS_HOURLY_LIMIT=5
SMS_MAX_ATTEMPTS=5
CAPTCHA_TTL_SECONDS=300
CAPTCHA_MAX_ATTEMPTS=5

# ===== API / CORS =====
API_BASE_URL=http://$SERVER_IP:8986/api
ALLOWED_ORIGINS=http://$SERVER_IP:8986,http://$SERVER_IP:8080,http://$SERVER_IP

# ===== 官网 =====
WEBSITE_PUBLIC_URL=http://$SERVER_IP:8080
WEBSITE_CONTENT_API_BASE_URL=http://server:3000
WEBSITE_LAST_SUCCESS_TTL_SECONDS=300
WEBSITE_PREVIEW_TTL_SECONDS=600
WEBSITE_CONTENT_CACHE_TTL_SECONDS=86400
WEBSITE_PORT=8080

# ===== 端口（生产不暴露 DB/Redis 到公网）=====
EXPOSE_DB_PORT=
EXPOSE_REDIS_PORT=

# ===== 第三方（可选，按需填写）=====
WECHAT_APP_ID=
WECHAT_APP_SECRET=
TENCENT_COS_SECRET_ID=
TENCENT_COS_SECRET_KEY=
TENCENT_COS_BUCKET=
TENCENT_COS_REGION=
TENCENT_COS_PUBLIC_BASE_URL=
EOF
  chmod 600 .env
  ok ".env 已生成（含随机强密钥），管理员密码：$ADMIN_PASSWORD"
fi

echo
echo "================================================"
echo "  服务器初始化完成"
echo "================================================"
echo "代码目录：   $INSTALL_DIR"
echo "配置文件：   $INSTALL_DIR/.env（chmod 600）"
echo
echo "下一步："
echo "  1. 在轻量云控制台防火墙放行端口：22, 8080, 8986"
echo "  2. 在 GitHub 仓库配置 Secrets（见 docs/08-deployment/github-actions-deploy.md）"
echo "  3. GitHub → Actions → 手动部署 → Run workflow"
echo "================================================"
