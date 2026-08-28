#!/usr/bin/env bash
set -Eeuo pipefail
umask 077

TARGET="${TARGET:?TARGET is required}"
IMAGE_REGISTRY="${IMAGE_REGISTRY:?IMAGE_REGISTRY is required}"
RELEASE_SHA="${RELEASE_SHA:?RELEASE_SHA is required}"
NEW_IMAGE_TAG="${NEW_IMAGE_TAG:?NEW_IMAGE_TAG is required}"
INITIALIZE_DATA="${INITIALIZE_DATA:-false}"
RESET_DATA="${RESET_DATA:-false}"
APPLICATION_IMAGES_PRELOADED="${APPLICATION_IMAGES_PRELOADED:-false}"
PUBLIC_MEDIA_ENV_FILE="${PUBLIC_MEDIA_ENV_FILE:-}"
ROOT_DIR="/opt/petcare"
RELEASE_DIR="$ROOT_DIR/current"
ENV_FILE="$ROOT_DIR/.env"
STATE_FILE="$ROOT_DIR/.deploy-images.env"
STATE_KEYS=(IMAGE_REGISTRY SERVER_IMAGE_TAG ADMIN_IMAGE_TAG WEBSITE_IMAGE_TAG)
INFRA_SERVICES=(postgres redis website-gateway edge-gateway)
HAD_STATE=false
DEPLOYMENT_STARTED=false
STATE_PERSISTED=false
ROLLBACK_RUNNING=false
CANDIDATE_STATE=""
ENV_BACKUP=""
ENV_UPDATED=false
OLD_IMAGE_REGISTRY=""
OLD_SERVER_IMAGE_TAG=""
OLD_ADMIN_IMAGE_TAG=""
OLD_WEBSITE_IMAGE_TAG=""

cleanup() {
  local status=$?

  if [[ -n "$CANDIDATE_STATE" && "$STATE_PERSISTED" != true ]]; then
    rm -f -- "$CANDIDATE_STATE" || [[ "$status" -ne 0 ]] || status=1
  fi
  if [[ -n "$ENV_BACKUP" ]]; then
    rm -f -- "$ENV_BACKUP" || [[ "$status" -ne 0 ]] || status=1
  fi

  return "$status"
}
trap cleanup EXIT

on_error() {
  local status=$?

  trap - ERR
  set +e
  if [[ "$ENV_UPDATED" == true && -n "$ENV_BACKUP" ]]; then
    if mv -f -- "$ENV_BACKUP" "$ENV_FILE"; then
      ENV_BACKUP=""
      ENV_UPDATED=false
      printf '%s\n' "生产运行配置已恢复。" >&2
    else
      printf '%s\n' "生产运行配置恢复失败，保留备份：$ENV_BACKUP" >&2
      ENV_BACKUP=""
      status=1
    fi
  fi
  if [[ "$HAD_STATE" == true && "$DEPLOYMENT_STARTED" == true && "$ROLLBACK_RUNNING" == false ]]; then
    ROLLBACK_RUNNING=true
    IMAGE_REGISTRY="$OLD_IMAGE_REGISTRY"
    SERVER_IMAGE_TAG="$OLD_SERVER_IMAGE_TAG"
    ADMIN_IMAGE_TAG="$OLD_ADMIN_IMAGE_TAG"
    WEBSITE_IMAGE_TAG="$OLD_WEBSITE_IMAGE_TAG"
    export IMAGE_REGISTRY SERVER_IMAGE_TAG ADMIN_IMAGE_TAG WEBSITE_IMAGE_TAG
    docker compose --env-file "$ENV_FILE" up -d --no-build "${APP_SERVICES[@]}" "${RESTART_SERVICES[@]}"
    docker compose --env-file "$ENV_FILE" restart "${RESTART_SERVICES[@]}"
    printf '%s\n' "应用镜像回滚已尝试；数据库 migration 未回滚（forward-only）。" >&2
  fi

  exit "$status"
}
trap on_error ERR

parse_state_file() {
  local file="$1"
  local line=""
  local key=""
  local value=""
  local -A seen=()

  PARSED_IMAGE_REGISTRY=""
  PARSED_SERVER_IMAGE_TAG=""
  PARSED_ADMIN_IMAGE_TAG=""
  PARSED_WEBSITE_IMAGE_TAG=""

  while IFS= read -r line || [[ -n "$line" ]]; do
    if [[ ! "$line" =~ ^([A-Z_]+)=([a-zA-Z0-9./:_-]+)$ ]]; then
      echo "镜像状态文件格式无效" >&2
      return 1
    fi

    key="${BASH_REMATCH[1]}"
    value="${BASH_REMATCH[2]}"
    case "$key" in
      IMAGE_REGISTRY|SERVER_IMAGE_TAG|ADMIN_IMAGE_TAG|WEBSITE_IMAGE_TAG) ;;
      *)
        echo "镜像状态文件包含未知键" >&2
        return 1
        ;;
    esac

    if [[ -n "${seen[$key]+x}" ]]; then
      echo "镜像状态文件键重复" >&2
      return 1
    fi
    seen["$key"]=1

    case "$key" in
      IMAGE_REGISTRY) PARSED_IMAGE_REGISTRY="$value" ;;
      SERVER_IMAGE_TAG) PARSED_SERVER_IMAGE_TAG="$value" ;;
      ADMIN_IMAGE_TAG) PARSED_ADMIN_IMAGE_TAG="$value" ;;
      WEBSITE_IMAGE_TAG) PARSED_WEBSITE_IMAGE_TAG="$value" ;;
    esac
  done < "$file"

  for key in "${STATE_KEYS[@]}"; do
    if [[ -z "${seen[$key]+x}" ]]; then
      echo "镜像状态文件缺少键: $key" >&2
      return 1
    fi
  done
}

if [[ ! "$TARGET" =~ ^(all|server|admin|website)$ ]]; then
  echo "TARGET 必须是 all、server、admin 或 website" >&2
  exit 1
fi
if [[ ! "$IMAGE_REGISTRY" =~ ^[a-zA-Z0-9./:_-]+$ ]]; then
  echo "IMAGE_REGISTRY 格式无效" >&2
  exit 1
fi
if [[ ! "$RELEASE_SHA" =~ ^[0-9a-f]{40}$ ]]; then
  echo "RELEASE_SHA 必须是 40 位小写 SHA" >&2
  exit 1
fi
if [[ "$NEW_IMAGE_TAG" != "sha-$RELEASE_SHA" ]]; then
  echo "NEW_IMAGE_TAG 必须等于 sha-\$RELEASE_SHA" >&2
  exit 1
fi
if [[ "$INITIALIZE_DATA" != true && "$INITIALIZE_DATA" != false ]]; then
  echo "INITIALIZE_DATA 必须是 true 或 false" >&2
  exit 1
fi
if [[ "$RESET_DATA" != true && "$RESET_DATA" != false ]]; then
  echo "RESET_DATA 必须是 true 或 false" >&2
  exit 1
fi
if [[ "$APPLICATION_IMAGES_PRELOADED" != true && "$APPLICATION_IMAGES_PRELOADED" != false ]]; then
  echo "APPLICATION_IMAGES_PRELOADED 必须是 true 或 false" >&2
  exit 1
fi
if [[ "$INITIALIZE_DATA" == true && "$TARGET" != all ]]; then
  echo "initialize_data=true 只允许 target=all" >&2
  exit 1
fi
if [[ "$RESET_DATA" == true && "$TARGET" != all ]]; then
  echo "reset_data=true 只允许 target=all" >&2
  exit 1
fi
if [[ "$RESET_DATA" == true && "$INITIALIZE_DATA" == true ]]; then
  echo "reset_data=true 不能与 initialize_data=true 同时使用" >&2
  exit 1
fi
if [[ "$TARGET" == all || "$TARGET" == server ]]; then
  if [[ ! "$PUBLIC_MEDIA_ENV_FILE" =~ ^/tmp/petcare-release-[0-9]+-[0-9]+/petcare-public-media\.env$ ]]; then
    echo "PUBLIC_MEDIA_ENV_FILE 路径无效" >&2
    exit 1
  fi
  [[ -f "$PUBLIC_MEDIA_ENV_FILE" && ! -L "$PUBLIC_MEDIA_ENV_FILE" && -r "$PUBLIC_MEDIA_ENV_FILE" ]] || {
    echo "PUBLIC_MEDIA_ENV_FILE 不可读取" >&2
    exit 1
  }
fi

cd "$RELEASE_DIR"
test -r "$ENV_FILE"

if [[ "$TARGET" == all || "$TARGET" == server ]]; then
  [[ "$(stat -c '%U:%G %a' -- "$ENV_FILE")" == "root:root 600" ]] || {
    echo "生产运行配置权限无效" >&2
    exit 1
  }
  ENV_BACKUP="$(mktemp "$ROOT_DIR/.env.rollback.XXXXXX")"
  install -o root -g root -m 600 "$ENV_FILE" "$ENV_BACKUP"
  ENV_UPDATED=true
  python3 "$RELEASE_DIR/scripts/update-public-media-env.py" "$ENV_FILE" "$PUBLIC_MEDIA_ENV_FILE"
  [[ "$(stat -c '%U:%G %a' -- "$ENV_FILE")" == "root:root 600" ]]
fi

if [[ -e "$STATE_FILE" ]]; then
  [[ -f "$STATE_FILE" && -r "$STATE_FILE" ]] || {
    echo "镜像状态文件不可读取" >&2
    exit 1
  }
  HAD_STATE=true
  parse_state_file "$STATE_FILE"
  OLD_IMAGE_REGISTRY="$PARSED_IMAGE_REGISTRY"
  OLD_SERVER_IMAGE_TAG="$PARSED_SERVER_IMAGE_TAG"
  OLD_ADMIN_IMAGE_TAG="$PARSED_ADMIN_IMAGE_TAG"
  OLD_WEBSITE_IMAGE_TAG="$PARSED_WEBSITE_IMAGE_TAG"

  if [[ "$TARGET" != all && "$IMAGE_REGISTRY" != "$OLD_IMAGE_REGISTRY" ]]; then
    echo "选择性发布必须使用当前镜像仓库" >&2
    exit 1
  fi

  SERVER_IMAGE_TAG="$OLD_SERVER_IMAGE_TAG"
  ADMIN_IMAGE_TAG="$OLD_ADMIN_IMAGE_TAG"
  WEBSITE_IMAGE_TAG="$OLD_WEBSITE_IMAGE_TAG"
elif [[ "$TARGET" != all ]]; then
  echo "首次部署必须选择 target=all" >&2
  exit 1
fi

case "$TARGET" in
  server)
    SERVER_IMAGE_TAG="$NEW_IMAGE_TAG"
    APP_SERVICES=(server)
    RESTART_SERVICES=(admin website-gateway)
    CHECK_SERVICES=(server admin website-gateway)
    ;;
  admin)
    ADMIN_IMAGE_TAG="$NEW_IMAGE_TAG"
    APP_SERVICES=(admin)
    RESTART_SERVICES=(edge-gateway)
    CHECK_SERVICES=(admin edge-gateway)
    ;;
  website)
    WEBSITE_IMAGE_TAG="$NEW_IMAGE_TAG"
    APP_SERVICES=(website)
    RESTART_SERVICES=(website-gateway)
    CHECK_SERVICES=(website website-gateway)
    ;;
  all)
    SERVER_IMAGE_TAG="$NEW_IMAGE_TAG"
    ADMIN_IMAGE_TAG="$NEW_IMAGE_TAG"
    WEBSITE_IMAGE_TAG="$NEW_IMAGE_TAG"
    APP_SERVICES=(server admin website)
    RESTART_SERVICES=(website-gateway edge-gateway)
    CHECK_SERVICES=(postgres redis server admin website website-gateway edge-gateway)
    ;;
esac

CANDIDATE_STATE="$(mktemp "$ROOT_DIR/.deploy-images.XXXXXX")"
chmod 600 "$CANDIDATE_STATE"
printf '%s\n' \
  "IMAGE_REGISTRY=$IMAGE_REGISTRY" \
  "SERVER_IMAGE_TAG=$SERVER_IMAGE_TAG" \
  "ADMIN_IMAGE_TAG=$ADMIN_IMAGE_TAG" \
  "WEBSITE_IMAGE_TAG=$WEBSITE_IMAGE_TAG" > "$CANDIDATE_STATE"
export IMAGE_REGISTRY SERVER_IMAGE_TAG ADMIN_IMAGE_TAG WEBSITE_IMAGE_TAG

docker compose --env-file "$ENV_FILE" config --quiet
if [[ "$APPLICATION_IMAGES_PRELOADED" == true ]]; then
  for service in "${APP_SERVICES[@]}"; do
    case "$service" in
      server) image_tag="$SERVER_IMAGE_TAG" ;;
      admin) image_tag="$ADMIN_IMAGE_TAG" ;;
      website) image_tag="$WEBSITE_IMAGE_TAG" ;;
    esac
    docker image inspect "$IMAGE_REGISTRY/$service:$image_tag" > /dev/null
  done
else
  docker compose --env-file "$ENV_FILE" pull "${APP_SERVICES[@]}"
fi
DEPLOYMENT_STARTED=true
if [[ "$HAD_STATE" == false && "$TARGET" == all ]]; then
  docker compose --env-file "$ENV_FILE" pull "${INFRA_SERVICES[@]}"
fi
docker compose --env-file "$ENV_FILE" up -d --no-build --wait --wait-timeout 180 postgres redis

if [[ "$TARGET" == all || "$TARGET" == server ]]; then
  APPLICATION_TABLES="$(docker compose --env-file "$ENV_FILE" exec -T postgres sh -lc \
    'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Atc "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema NOT IN ('\''pg_catalog'\'', '\''information_schema'\'');"')"
  [[ "$APPLICATION_TABLES" =~ ^[0-9]+$ ]] || {
    echo "无法确认数据库表数量" >&2
    exit 1
  }
  if [[ "$INITIALIZE_DATA" == true && ( "$HAD_STATE" != false || "$APPLICATION_TABLES" != 0 ) ]]; then
    echo "initialize_data=true 仅允许首次空库部署" >&2
    exit 1
  fi
  if [[ "$RESET_DATA" == true && ( "$HAD_STATE" != true || "$APPLICATION_TABLES" == 0 ) ]]; then
    echo "reset_data=true 仅允许重置已部署的非空数据库" >&2
    exit 1
  fi
  if [[ "$RESET_DATA" == true ]]; then
    docker compose --env-file "$ENV_FILE" stop server
  fi
  if [[ "$HAD_STATE" == false && "$APPLICATION_TABLES" == 0 ]]; then
    echo "首次部署确认数据库为空，跳过无历史意义的备份"
  else
    BACKUP_RUNNER_IMAGE="$IMAGE_REGISTRY/server:$SERVER_IMAGE_TAG" \
      "$RELEASE_DIR/scripts/database-backup.sh"
  fi

  if [[ "$RESET_DATA" == true ]]; then
    echo "数据库备份已完成，开始全量重置生产数据。"
    docker compose --env-file "$ENV_FILE" run --rm --no-deps \
      --workdir /app/apps/server server \
      node --env-file-if-exists=../../.env node_modules/prisma/build/index.js migrate reset --force
    docker compose --env-file "$ENV_FILE" run --rm --no-deps \
      --workdir /app/apps/server server \
      node --env-file-if-exists=../../.env node_modules/tsx/dist/cli.mjs prisma/seed.ts
    docker compose --env-file "$ENV_FILE" exec -T redis sh -lc \
      'redis-cli --no-auth-warning -a "$REDIS_PASSWORD" FLUSHDB'
  else
    echo "数据库 migration 为 forward-only，失败时不会自动回滚。"
    docker compose --env-file "$ENV_FILE" run --rm --no-deps \
      --workdir /app/apps/server server \
      node --env-file-if-exists=../../.env node_modules/prisma/build/index.js migrate deploy
    if [[ "$INITIALIZE_DATA" == true ]]; then
      docker compose --env-file "$ENV_FILE" run --rm --no-deps \
        --workdir /app/apps/server server \
        node --env-file-if-exists=../../.env node_modules/tsx/dist/cli.mjs prisma/seed.ts
    fi
  fi
fi

docker compose --env-file "$ENV_FILE" up -d --no-build "${APP_SERVICES[@]}" "${RESTART_SERVICES[@]}"
docker compose --env-file "$ENV_FILE" restart "${RESTART_SERVICES[@]}"
docker compose --env-file "$ENV_FILE" up -d --no-build --wait --wait-timeout 180 "${CHECK_SERVICES[@]}"

for host in petcare-home.com www.petcare-home.com admin.petcare-home.com; do
  redirect="$(curl --silent --show-error --head --max-redirs 0 --proto '=http' --connect-timeout 10 --max-time 30 --output /dev/null --write-out '%{http_code} %{redirect_url}' "http://$host/")"
  [[ "$redirect" == "301 https://$host/" ]]
done

for url in \
  https://petcare-home.com \
  https://www.petcare-home.com \
  https://admin.petcare-home.com \
  https://admin.petcare-home.com/api/ready
do
  curl --fail --silent --show-error --location \
    --proto '=https' --tlsv1.2 \
    --connect-timeout 10 --max-time 30 \
    --retry 6 --retry-all-errors --retry-delay 5 \
    --output /dev/null "$url"
done

mv -f -- "$CANDIDATE_STATE" "$STATE_FILE"
STATE_PERSISTED=true
trap - ERR
