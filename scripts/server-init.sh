#!/usr/bin/env bash
# PetCare Ubuntu 生产服务器首次初始化脚本
# 用途：准备 Docker、生产持久化目录和初始 .env。
# 注意：本脚本不获取代码、不启动应用；首次发布前必须由 root 安全补全 .env。
#
# 用法（在服务器上以 root 执行）：
#   sudo bash server-init.sh
set -Eeuo pipefail

INSTALL_DIR="/opt/petcare"

log() { echo -e "\033[36m[init]\033[0m $*"; }
ok() { echo -e "\033[32m[ok]\033[0m $*"; }
err() { echo -e "\033[31m[err]\033[0m $*" >&2; }

if [[ $EUID -ne 0 ]]; then
  if sudo -n true 2>/dev/null; then
    exec sudo bash "$0" "$@"
  fi
  err "请用 sudo 执行：sudo bash $0"
  exit 1
fi

umask 077
apt-get update -y
if ! apt-get install -y ca-certificates curl openssl python3 docker.io docker-compose-v2; then
  err "当前 Ubuntu APT 源无法提供 Docker Engine 与 Compose v2；请先修复系统软件源"
  exit 1
fi
systemctl enable --now docker
docker --version
docker compose version

install -d -o root -g root -m 755 "$INSTALL_DIR"
install -d -o root -g root -m 755 "$INSTALL_DIR/releases"
install -d -o root -g root -m 700 "$INSTALL_DIR/certs"
install -d -o root -g root -m 755 "$INSTALL_DIR/logs"
cd "$INSTALL_DIR"

if [[ -f .env ]]; then
  chown root:root .env
  chmod 600 .env
  ok ".env 已存在，跳过生成（如需重置请先手动备份删除）"
else
  DEFAULT_ADMIN_PHONE="${DEFAULT_ADMIN_PHONE:-}"
  if [[ -z "$DEFAULT_ADMIN_PHONE" && -t 0 ]]; then
    read -r -p "初始管理员手机号：" DEFAULT_ADMIN_PHONE
  fi
  : "${DEFAULT_ADMIN_PHONE:?请提供初始管理员中国大陆手机号}"
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
echo "持久化根目录：$INSTALL_DIR"
echo "配置文件：    $INSTALL_DIR/.env（root:root，chmod 600）"
echo "发布目录：    $INSTALL_DIR/releases"
echo "证书目录：    $INSTALL_DIR/certs（root:root，chmod 700）"
echo "日志目录：    $INSTALL_DIR/logs"
echo
echo "下一步："
echo "  1. root 安全补全并轮换 .env 中管理员、微信和 Aliyun SMS 配置；不要打印或回传其值"
echo "  2. 在轻量云控制台只放行端口：22、80、443"
echo "  3. 配置 GitHub production Environment（见 docs/08-deployment/github-actions-deploy.md）"
echo "  4. 通过受控发布流程上传并部署代码"
echo "================================================"
