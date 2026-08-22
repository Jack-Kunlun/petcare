#!/usr/bin/env bash
set -Eeuo pipefail
umask 077

[[ "$#" -eq 1 ]] || exit 1
OBJECT_KEY="${1:?请提供 COS 对象 Key}"
if [[ "$OBJECT_KEY" =~ ^postgresql/([a-zA-Z0-9_-]+)/[0-9]{4}/[0-9]{2}/([a-zA-Z0-9_-]+)-[0-9]{8}T[0-9]{6}Z\.dump$ ]]; then
  [[ "${BASH_REMATCH[1]}" == "${BASH_REMATCH[2]}" ]] || exit 1
else
  exit 1
fi

ROOT_DIR="/opt/petcare"
RELEASE_DIR="$ROOT_DIR/current"
ENV_FILE="$ROOT_DIR/.env"
STATE_FILE="$ROOT_DIR/.deploy-images.env"
RESTORE_DIR="/var/lib/petcare-restores"
BACKUP_ENV="/etc/petcare-backup.env"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
RESTORE_DB="petcare_restore_${STAMP,,}"
WORK_DIR=""
DUMP_PATH=""
CREATED_DB=false

cleanup() {
  local status=$?

  if [[ -n "$DUMP_PATH" ]]; then
    rm -f -- "$DUMP_PATH" || [[ "$status" -ne 0 ]] || status=1
  fi
  if [[ -n "$WORK_DIR" ]]; then
    rmdir -- "$WORK_DIR" || [[ "$status" -ne 0 ]] || status=1
  fi
  if [[ "$CREATED_DB" == true ]]; then
    docker compose --env-file "$ENV_FILE" exec -T postgres sh -lc \
      'dropdb -U "$POSTGRES_USER" --if-exists "$1"' sh "$RESTORE_DB" || [[ "$status" -ne 0 ]] || status=1
  fi

  return "$status"
}
trap cleanup EXIT

cd "$RELEASE_DIR"
test -r "$ENV_FILE"
test -r "$BACKUP_ENV"
test -r "$STATE_FILE"
install -d -m 700 "$RESTORE_DIR"

if grep -Ev '^$|^(IMAGE_REGISTRY|SERVER_IMAGE_TAG|ADMIN_IMAGE_TAG|WEBSITE_IMAGE_TAG)=[a-zA-Z0-9./:_-]+$' "$STATE_FILE" > /dev/null; then
  echo "Invalid .deploy-images.env" >&2
  exit 1
else
  status=$?
  [[ "$status" -eq 1 ]] || exit 1
fi
source "$STATE_FILE"
export IMAGE_REGISTRY SERVER_IMAGE_TAG ADMIN_IMAGE_TAG WEBSITE_IMAGE_TAG

SERVER_IMAGE="$(docker compose --env-file "$ENV_FILE" images -q server)"
test -n "$SERVER_IMAGE"
mkdir -m 700 "$RESTORE_DIR/$STAMP"
WORK_DIR="$RESTORE_DIR/$STAMP"
DUMP_PATH="$WORK_DIR/$STAMP.dump"
docker run --rm \
  --env-file "$BACKUP_ENV" \
  --mount "type=bind,src=$WORK_DIR,dst=/restore" \
  "$SERVER_IMAGE" \
  node apps/server/dist/operations/database-backup-cli.js \
  download "$OBJECT_KEY" "/restore/$STAMP.dump"

test -s "$DUMP_PATH"
docker compose --env-file "$ENV_FILE" exec -T postgres pg_restore --list < "$DUMP_PATH" > /dev/null
docker compose --env-file "$ENV_FILE" exec -T postgres sh -lc \
  'createdb -U "$POSTGRES_USER" "$1"' sh "$RESTORE_DB"
CREATED_DB=true
docker compose --env-file "$ENV_FILE" exec -T postgres sh -lc \
  'pg_restore -U "$POSTGRES_USER" -d "$1" --no-owner --exit-on-error' sh "$RESTORE_DB" < "$DUMP_PATH"
APPLICATION_TABLES="$(docker compose --env-file "$ENV_FILE" exec -T postgres sh -lc \
  'psql -U "$POSTGRES_USER" -d "$1" -v ON_ERROR_STOP=1 -Atc "SELECT COUNT(*) FROM information_schema.tables WHERE table_type = '\''BASE TABLE'\'' AND table_schema NOT IN ('\''pg_catalog'\'', '\''information_schema'\'');"' \
  sh "$RESTORE_DB")"
test "$APPLICATION_TABLES" -gt 0
docker compose --env-file "$ENV_FILE" run --rm --no-deps -e DB_NAME="$RESTORE_DB" server \
  pnpm --filter @petcare/server prisma:migrate:status

printf '恢复验证完成，临时数据库将删除：%s\n' "$RESTORE_DB"
printf '生产数据库未被修改。\n'
