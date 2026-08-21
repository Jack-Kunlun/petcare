import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";

const root = resolve(import.meta.dirname, "..");

function position(script, fragment) {
  const index = script.indexOf(fragment);

  assert.notEqual(index, -1, "Expected backup script to contain: " + fragment);

  return index;
}

test("数据库备份使用容器工具、校验转储并通过 Server 镜像上传", async () => {
  const script = await readFile(resolve(root, "scripts/database-backup.sh"), "utf8");

  assert.match(script, /^set -Eeuo pipefail$/m);
  assert.match(script, /^umask 077$/m);
  assert.match(script, /^INSTALL_DIR="\/opt\/petcare"$/m);
  assert.deepEqual(script.match(/^cd .+$/gm), ['cd "$INSTALL_DIR"']);

  assert.match(script, /^BACKUP_ENV="\/etc\/petcare-backup\.env"$/m);
  assert.match(script, /^test -r \.env$/m);
  assert.match(script, /^test -r "\$BACKUP_ENV"$/m);
  assert.doesNotMatch(script, /^(?:source|\.) \.env$/m);
  assert.doesNotMatch(script, /^(?:source|\.) "\$BACKUP_ENV"$/m);
  assert.doesNotMatch(script, /(?:^|\n)\s*cat\s+(?:\.env|"\$BACKUP_ENV")/m);

  const deployValidation = position(
    script,
    [
      "if grep -Ev '^$|^(IMAGE_REGISTRY|SERVER_IMAGE_TAG|ADMIN_IMAGE_TAG|WEBSITE_IMAGE_TAG)=[a-zA-Z0-9./:_-]+$' .deploy-images.env > /dev/null; then",
      '    echo "Invalid .deploy-images.env" >&2',
      "    exit 1",
      "  else",
      "    status=$?",
      '    [[ "$status" -eq 1 ]] || exit 1',
      "  fi",
    ].join("\n"),
  );
  const deploySource = position(script, "source .deploy-images.env");
  assert.match(script, /^if \[\[ -r \.deploy-images\.env \]\]; then$/m);
  assert.equal((script.match(/^[ \t]*source \.deploy-images\.env$/gm) ?? []).length, 1);
  assert.doesNotMatch(script, /grep -Ev [^\n]*\|\s*grep\b/);
  assert.doesNotMatch(script, /if ! grep -Ev/);
  assert.ok(deployValidation < deploySource);

  assert.match(
    script,
    /^SERVER_IMAGE="\$\{BACKUP_RUNNER_IMAGE:-\$\(docker compose --env-file \.env images -q server\)\}"$/m,
  );
  assert.match(
    script,
    /DATABASE_ID="\$\(docker run --rm --env-file \.env "\$SERVER_IMAGE" node -e '/,
  );
  assert.match(script, /require\("\.\/apps\/server\/dist\/config\/config\.service\.js"\)/);
  assert.match(script, /config\.databaseName/);
  assert.match(script, /config\.databaseSchema/);
  assert.match(script, /if \(!\/\^\[a-zA-Z0-9_-\]\+\$\/\.test\(value\)\) process\.exit\(1\);/);
  assert.match(script, /^STAMP="\$\(date -u \+%Y%m%dT%H%M%SZ\)"$/m);
  assert.match(script, /^YEAR="\$\{STAMP:0:4\}"$/m);
  assert.match(script, /^MONTH="\$\{STAMP:4:2\}"$/m);
  assert.equal((script.match(/\bdate -u\b/g) ?? []).length, 1);
  assert.match(
    script,
    /^OBJECT_KEY="postgresql\/\$DATABASE_ID\/\$YEAR\/\$MONTH\/\$DATABASE_ID-\$STAMP\.dump"$/m,
  );

  const dumpInitialization = position(script, 'DUMP_PATH=""');
  const cleanupTrap = position(script, "trap cleanup EXIT");
  assert.ok(dumpInitialization < cleanupTrap);
  assert.match(
    script,
    /cleanup\(\) \{\n {2}if \[\[ -n "\$DUMP_PATH" \]\]; then\n {4}rm -f -- "\$DUMP_PATH"\n {2}fi\n\}/,
  );
  assert.equal((script.match(/rm -f -- "\$DUMP_PATH"/g) ?? []).length, 1);

  const dump = position(
    script,
    [
      "docker compose --env-file .env exec -T postgres sh -lc \\",
      '  \'exec pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" --format=custom\' > "$DUMP_PATH"',
    ].join("\n"),
  );
  const nonEmpty = position(script, 'test -s "$DUMP_PATH"');
  const restorable = position(
    script,
    'docker compose --env-file .env exec -T postgres pg_restore --list < "$DUMP_PATH" > /dev/null',
  );
  assert.ok(dump < nonEmpty && nonEmpty < restorable);

  const upload = position(
    script,
    [
      "docker run --rm \\",
      '  --env-file "$BACKUP_ENV" \\',
      '  --mount "type=bind,src=$DUMP_PATH,dst=/backup/database.dump,readonly" \\',
      '  "$SERVER_IMAGE" \\',
      "  node apps/server/dist/operations/database-backup-cli.js \\",
      '  upload /backup/database.dump "$OBJECT_KEY"',
    ].join("\n"),
  );
  assert.ok(restorable < upload);

  for (const forbidden of [
    /BACKUP_COS_SECRET_(?:ID|KEY)=/,
    /^[ \t]*(?:pg_dump|pg_restore|aws|coscmd|coscli)\b/m,
    /^[ \t]*(?:set -x|printenv)\b/m,
    /\bdocker (?:inspect|image inspect)\b/,
  ]) {
    assert.doesNotMatch(script, forbidden);
  }
});

test("工具测试包含数据库备份策略", async () => {
  const packageJson = JSON.parse(await readFile(resolve(root, "package.json"), "utf8"));

  assert.match(
    packageJson.scripts["test:tooling"],
    /\bscripts\/database-operations-policy\.test\.mjs\b/,
  );
});

test("恢复流程要求显式对象并只写入临时数据库", async () => {
  const script = await readFile(resolve(root, "scripts/database-restore.sh"), "utf8");

  assert.match(script, /^\[\[ "\$#" -eq 1 \]\] \|\| exit 1$/m);
  assert.match(script, /^OBJECT_KEY="\$\{1:\?请提供 COS 对象 Key\}"$/m);
  assert.match(
    script,
    /\^postgresql\/\(\[a-zA-Z0-9_-\]\+\)\/\[0-9\]\{4\}\/\[0-9\]\{2\}\/\(\[a-zA-Z0-9_-\]\+\)-\[0-9\]\{8\}T\[0-9\]\{6\}Z\\\.dump\$/,
  );
  assert.match(script, /BASH_REMATCH\[1\].*BASH_REMATCH\[2\]/);
  assert.doesNotMatch(script, /\b(?:latest|listObjects(?:V2)?)\b/i);

  const deployValidation = position(
    script,
    [
      "if grep -Ev '^$|^(IMAGE_REGISTRY|SERVER_IMAGE_TAG|ADMIN_IMAGE_TAG|WEBSITE_IMAGE_TAG)=[a-zA-Z0-9./:_-]+$' .deploy-images.env > /dev/null; then",
      '  echo "Invalid .deploy-images.env" >&2',
      "  exit 1",
      "else",
      "  status=$?",
      '  [[ "$status" -eq 1 ]] || exit 1',
      "fi",
    ].join("\n"),
  );
  const deploySource = position(script, "source .deploy-images.env");
  assert.match(script, /^test -r \.deploy-images\.env$/m);
  assert.equal((script.match(/^[ \t]*source \.deploy-images\.env$/gm) ?? []).length, 1);
  assert.doesNotMatch(script, /grep -Ev [^\n]*\|\s*grep\b/);
  assert.doesNotMatch(script, /\bgrep\b[^\n]*\|\s*grep\s+-q\b/);
  assert.doesNotMatch(script, /if ! grep -Ev/);
  assert.ok(deployValidation < deploySource);

  const cleanupTrap = position(script, "trap cleanup EXIT");
  assert.equal((script.match(/^trap cleanup EXIT$/gm) ?? []).length, 1);

  const workDirInitialization = position(script, 'WORK_DIR=""');
  const dumpInitialization = position(script, 'DUMP_PATH=""');
  const download = position(
    script,
    [
      "docker run --rm \\",
      '  --env-file "$BACKUP_ENV" \\',
      '  --mount "type=bind,src=$WORK_DIR,dst=/restore" \\',
      '  "$SERVER_IMAGE" \\',
      "  node apps/server/dist/operations/database-backup-cli.js \\",
      '  download "$OBJECT_KEY" "/restore/$STAMP.dump"',
    ].join("\n"),
  );
  const createWorkDir = position(script, 'mkdir -m 700 "$RESTORE_DIR/$STAMP"');
  const installRestoreDirectory = position(script, 'install -d -m 700 "$RESTORE_DIR"');
  const workDirAssignment = position(script, 'WORK_DIR="$RESTORE_DIR/$STAMP"');
  const dumpAssignment = position(script, 'DUMP_PATH="$WORK_DIR/$STAMP.dump"');
  const dumpListed = position(
    script,
    'docker compose --env-file .env exec -T postgres pg_restore --list < "$DUMP_PATH" > /dev/null',
  );
  assert.ok(
    workDirInitialization < createWorkDir &&
      dumpInitialization < createWorkDir &&
      createWorkDir < workDirAssignment &&
      workDirAssignment < dumpAssignment &&
      dumpAssignment < download &&
      download < dumpListed,
  );
  assert.doesNotMatch(script, /test ! -e/);
  assert.doesNotMatch(script, /\b(?:touch|mktemp)\b/);

  assert.match(script, /^RESTORE_DB="petcare_restore_\$\{STAMP,,\}"$/m);
  const createDatabase = position(
    script,
    [
      "docker compose --env-file .env exec -T postgres sh -lc \\",
      '  \'createdb -U "$POSTGRES_USER" "$1"\' sh "$RESTORE_DB"',
    ].join("\n"),
  );
  const createdDatabase = position(script, "CREATED_DB=true");
  const restoreDatabase = position(
    script,
    [
      "docker compose --env-file .env exec -T postgres sh -lc \\",
      '  \'pg_restore -U "$POSTGRES_USER" -d "$1" --no-owner --exit-on-error\' sh "$RESTORE_DB" < "$DUMP_PATH"',
    ].join("\n"),
  );
  const applicationTables = position(script, 'test "$APPLICATION_TABLES" -gt 0');
  const migrationStatus = position(script, "pnpm --filter @petcare/server prisma:migrate:status");
  const cleanupDrop = position(
    script,
    [
      '  if [[ "$CREATED_DB" == true ]]; then',
      "    docker compose --env-file .env exec -T postgres sh -lc \\",
      '      \'dropdb -U "$POSTGRES_USER" --if-exists "$1"\' sh "$RESTORE_DB" || [[ "$status" -ne 0 ]] || status=1',
      "  fi",
    ].join("\n"),
  );
  const cleanupDump = position(
    script,
    [
      '  if [[ -n "$DUMP_PATH" ]]; then',
      '    rm -f -- "$DUMP_PATH" || [[ "$status" -ne 0 ]] || status=1',
      "  fi",
    ].join("\n"),
  );
  const cleanupWorkDir = position(
    script,
    [
      '  if [[ -n "$WORK_DIR" ]]; then',
      '    rmdir -- "$WORK_DIR" || [[ "$status" -ne 0 ]] || status=1',
      "  fi",
    ].join("\n"),
  );
  const cleanupStatus = position(script, "cleanup() {\n  local status=$?");
  const cleanupReturn = position(script, '  return "$status"\n}');
  assert.ok(
    dumpListed < createDatabase &&
      createDatabase < createdDatabase &&
      createdDatabase < restoreDatabase &&
      restoreDatabase < applicationTables &&
      applicationTables < migrationStatus,
  );
  assert.match(script, /SELECT COUNT\(\*\) FROM information_schema\.tables/);
  assert.equal((script.match(/\bdropdb\b/g) ?? []).length, 1);
  assert.ok(
    cleanupDump < cleanupWorkDir && cleanupWorkDir < cleanupDrop && cleanupDrop < createDatabase,
  );
  assert.ok(
    cleanupTrap < position(script, 'cd "$INSTALL_DIR"') &&
      cleanupTrap < installRestoreDirectory &&
      cleanupTrap < createWorkDir &&
      cleanupTrap < download &&
      cleanupTrap < createDatabase,
  );
  assert.ok(
    cleanupStatus < cleanupDump && cleanupDump < cleanupWorkDir && cleanupWorkDir < cleanupDrop,
  );
  assert.ok(cleanupDrop < cleanupReturn);
  assert.throws(() => position(script.replace("trap cleanup EXIT", ""), "trap cleanup EXIT"));
  const movedTrap = script.replace(
    'trap cleanup EXIT\n\ncd "$INSTALL_DIR"',
    'cd "$INSTALL_DIR"\ntrap cleanup EXIT',
  );
  assert.notEqual(movedTrap, script);
  assert.throws(() =>
    assert.ok(position(movedTrap, "trap cleanup EXIT") < position(movedTrap, 'cd "$INSTALL_DIR"')),
  );
  assert.throws(() => position(script.replace("  local status=$?", ""), "  local status=$?"));
  assert.throws(() => position(script.replace('  return "$status"', ""), '  return "$status"\n}'));
  const unpreservedCleanup = script.replaceAll(
    ' || [[ "$status" -ne 0 ]] || status=1',
    " || status=1",
  );
  assert.throws(() =>
    position(unpreservedCleanup, '    rm -f -- "$DUMP_PATH" || [[ "$status" -ne 0 ]] || status=1'),
  );
  assert.match(script, /rm -f -- "\$DUMP_PATH"/);
  assert.doesNotMatch(script, /\brm\s+-[A-Za-z]*r/);
  assert.match(script, /run --rm --no-deps -e DB_NAME="\$RESTORE_DB" server/);
  assert.equal((script.match(/\bDB_NAME\b/g) ?? []).length, 1);
  assert.doesNotMatch(script, /(?:createdb|dropdb|pg_restore)[^\n]*\$\{?DB_NAME/);
});
