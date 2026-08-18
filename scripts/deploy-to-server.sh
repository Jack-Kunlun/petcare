#!/usr/bin/env bash
# PetCare 一键部署脚本（Ubuntu，无需预装 Docker）
# 用法：
#   1. 在本地用 tarball 命令打包项目（排除 node_modules/.git 等）
#   2. scp 上传 petcare.tar.gz 和本脚本到服务器
#   3. 在服务器执行：bash deploy-to-server.sh
#
# 本脚本完成：安装 Docker → 解压代码 → 生成生产 .env → docker compose up
# 部署范围：postgres + redis + server + website + website-gateway（不含 admin）
set -euo pipefail

SERVER_IP="${SERVER_IP:-58.249.86.210}"
INSTALL_DIR="/opt/petcare"
TARBALL="${TARBALL:-petcare.tar.gz}"

# 颜色输出
log()  { echo -e "\033[36m[deploy]\033[0m $*"; }
ok()   { echo -e "\033[32m[ok]\033[0m $*"; }
err()  { echo -e "\033[31m[err]\033[0m $*" >&2; }

# 必须用 sudo/root 操作 /opt
if [[ $EUID -ne 0 ]]; then
  if sudo -n true 2>/dev/null; then
    exec sudo bash "$0" "$@"
  else
    err "请用 sudo 执行：sudo bash $0"
    exit 1
  fi
fi

# ---------- 1. 安装 Docker ----------
if ! command -v docker &>/dev/null; then
  log "安装 Docker..."
  apt-get update -y
  apt-get install -y ca-certificates curl gnupg lsb-release
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

# 把当前用户加入 docker 组（非 root 场景）
if [[ -n "${SUDO_USER:-}" ]]; then
  usermod -aG docker "$SUDO_USER" || true
fi

# ---------- 2. 准备代码目录 ----------
mkdir -p "$INSTALL_DIR"
cd "$INSTALL_DIR"

if [[ ! -f "$TARBALL" ]]; then
  err "未找到 $TARBALL，请先上传代码包到 $(pwd)/ 或通过 TARBALL=xxx 指定路径"
  exit 1
fi

log "解压 $TARBALL 到 $INSTALL_DIR ..."
tar -xzf "$TARBALL" -C "$INSTALL_DIR" --strip-components=1
ok "代码解压完成"

if [[ ! -f docker-compose.yml ]]; then
  err "解压后未发现 docker-compose.yml，请检查 tarball 是否是项目根目录打包"
  exit 1
fi

# ---------- 3. 生成生产 .env ----------
if [[ -f .env ]]; then
  log "检测到已存在 .env，备份为 .env.bak.$(date +%s)"
  cp .env ".env.bak.$(date +%s)"
fi

DB_PASSWORD=$(openssl rand -base64 32 | tr -d '/+=' | head -c 32)
REDIS_PASSWORD=$(openssl rand -base64 24 | tr -d '/+=' | head -c 24)
JWT_SECRET=$(openssl rand -base64 48 | tr -d '/+=' | head -c 48)
ADMIN_PASSWORD=$(openssl rand -base64 24 | tr -d '/+=' | head -c 20)

cat > .env <<EOF
# ===== 由 deploy-to-server.sh 生成的生产环境配置 =====
# 生成时间：$(date '+%Y-%m-%d %H:%M:%S %Z')

# ===== 服务器配置 =====
PORT=3000
NODE_ENV=production
LOG_LEVEL=info
LOG_DIR=/app/logs

# ===== 数据库 =====
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
API_BASE_URL=http://$SERVER_IP:3000/api
ALLOWED_ORIGINS=http://$SERVER_IP:8986,http://$SERVER_IP:8080,http://$SERVER_IP

# ===== 官网 =====
WEBSITE_PUBLIC_URL=http://$SERVER_IP:8080
WEBSITE_CONTENT_API_BASE_URL=http://server:3000
WEBSITE_LAST_SUCCESS_TTL_SECONDS=300
WEBSITE_PREVIEW_TTL_SECONDS=600
WEBSITE_CONTENT_CACHE_TTL_SECONDS=86400

# ===== 端口（生产不暴露 DB/Redis 到公网）=====
EXPOSE_DB_PORT=
EXPOSE_REDIS_PORT=
WEBSITE_PORT=8080

# ===== 第三方（可选，留空）=====
WECHAT_APP_ID=
WECHAT_APP_SECRET=
TENCENT_COS_SECRET_ID=
TENCENT_COS_SECRET_KEY=
TENCENT_COS_BUCKET=
TENCENT_COS_REGION=
TENCENT_COS_PUBLIC_BASE_URL=
EOF
chmod 600 .env
ok ".env 已生成（含随机强密钥）"

# ---------- 4. 构建并启动 ----------
log "开始 docker compose 构建并启动（首次构建约 5-10 分钟）..."
docker compose --env-file .env up -d --build postgres redis server website website-gateway

ok "所有服务已启动"
echo
echo "================================================"
echo "  PetCare 部署完成"
echo "================================================"
echo "官网：       http://$SERVER_IP:8080"
echo "API：        http://$SERVER_IP:3000"
echo "健康检查：   http://$SERVER_IP:3000/health"
echo
echo "管理员账号： admin"
echo "管理员密码： $ADMIN_PASSWORD"
echo "（首次登录后请立即修改）"
echo
echo "配置文件：   $INSTALL_DIR/.env"
echo "日志目录：   $INSTALL_DIR/logs/"
echo
echo "常用命令："
echo "  cd $INSTALL_DIR"
echo "  docker compose ps              # 查看服务状态"
echo "  docker compose logs -f server  # 查看后端日志"
echo "  docker compose restart server  # 重启后端"
echo "  docker compose down            # 停止所有服务"
echo "================================================"
