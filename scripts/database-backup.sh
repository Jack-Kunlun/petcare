#!/usr/bin/env bash
set -Eeuo pipefail
umask 077

INSTALL_DIR="/opt/petcare"
BACKUP_DIR="/var/lib/petcare-backups"
BACKUP_ENV="/etc/petcare-backup.env"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
YEAR="${STAMP:0:4}"
MONTH="${STAMP:4:2}"
DUMP_PATH=""

cleanup() {
  if [[ -n "$DUMP_PATH" ]]; then
    rm -f -- "$DUMP_PATH"
  fi
}
trap cleanup EXIT

cd "$INSTALL_DIR"
test -r .env
test -r "$BACKUP_ENV"
install -d -m 700 "$BACKUP_DIR"

if [[ -r .deploy-images.env ]]; then
  if grep -Ev '^$|^(IMAGE_REGISTRY|SERVER_IMAGE_TAG|ADMIN_IMAGE_TAG|WEBSITE_IMAGE_TAG)=[a-zA-Z0-9./:_-]+$' .deploy-images.env > /dev/null; then
    echo "Invalid .deploy-images.env" >&2
    exit 1
  else
    status=$?
    [[ "$status" -eq 1 ]] || exit 1
  fi
  source .deploy-images.env
  export IMAGE_REGISTRY SERVER_IMAGE_TAG ADMIN_IMAGE_TAG WEBSITE_IMAGE_TAG
fi

SERVER_IMAGE="${BACKUP_RUNNER_IMAGE:-$(docker compose --env-file .env images -q server)}"
test -n "$SERVER_IMAGE"
DATABASE_ID="$(docker run --rm --env-file .env "$SERVER_IMAGE" node -e '
  const { ConfigService } = require("./apps/server/dist/config/config.service.js");
  const config = new ConfigService();
  const value = `${config.databaseName}-${config.databaseSchema}`;
  if (!/^[a-zA-Z0-9_-]+$/.test(value)) process.exit(1);
  process.stdout.write(value);
')"
test -n "$DATABASE_ID"
DUMP_PATH="$BACKUP_DIR/$DATABASE_ID-$STAMP.dump"
OBJECT_KEY="postgresql/$DATABASE_ID/$YEAR/$MONTH/$DATABASE_ID-$STAMP.dump"

docker compose --env-file .env exec -T postgres sh -lc \
  'exec pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" --format=custom' > "$DUMP_PATH"
test -s "$DUMP_PATH"
docker compose --env-file .env exec -T postgres pg_restore --list < "$DUMP_PATH" > /dev/null

docker run --rm \
  --env-file "$BACKUP_ENV" \
  --mount "type=bind,src=$DUMP_PATH,dst=/backup/database.dump,readonly" \
  "$SERVER_IMAGE" \
  node apps/server/dist/operations/database-backup-cli.js \
  upload /backup/database.dump "$OBJECT_KEY"
