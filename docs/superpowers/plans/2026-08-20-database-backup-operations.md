# Database Backup Operations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create fail-closed PostgreSQL backups in a private Tencent COS bucket, schedule them daily, and provide an explicit restore-to-temporary-database procedure that never overwrites production automatically.

**Architecture:** Run `pg_dump` and `pg_restore` from the existing PostgreSQL container so the host needs no database client. Reuse the Server image's pinned `cos-nodejs-sdk-v5` dependency through a small tested storage adapter; systemd invokes one root-owned shell script, while COS credentials live only in `/etc/petcare-backup.env`.

**Tech Stack:** PostgreSQL 15 tools, Docker Compose, Bash, systemd, Node.js 24.19.0, TypeScript, `cos-nodejs-sdk-v5` 3.0.0, Jest 30, Node.js built-in test runner.

**Spec:** `docs/superpowers/specs/2026-08-20-production-deployment-release-design.md`

## Global Constraints

- Execute `2026-08-20-production-runtime-data-safety.md` first so `prisma:migrate:status` and the committed baseline exist.
- Store backups in a separate private Tencent COS bucket; do not reuse the public website-media bucket.
- Use exactly `BACKUP_COS_SECRET_ID`, `BACKUP_COS_SECRET_KEY`, `BACKUP_COS_BUCKET`, and `BACKUP_COS_REGION`.
- Store backup credentials at `/etc/petcare-backup.env` with root ownership and mode `600`; never put them in `/opt/petcare/.env`, Docker images, command-line arguments, logs, or Git.
- Produce PostgreSQL custom-format dumps with the PostgreSQL container's `pg_dump -Fc`.
- Validate every dump with `pg_restore --list` before upload.
- Upload over HTTPS with COS server-side encryption `AES256` and configure a 30-day lifecycle in Tencent COS.
- A pre-Server-deployment backup failure aborts deployment before migration.
- Restore requires an explicit COS object key, restores into a newly named temporary database, and never writes over the production database automatically.
- Do not add a second COS SDK or a host PostgreSQL package.

---

### Task 1: Add a backup-only ConfigService group

**Files:**

- Modify: `apps/server/src/config/config.service.ts`
- Modify: `apps/server/src/config/config.service.spec.ts`

**Interfaces:**

- Consumes: the existing `ConfigService.getRequiredString()` validation pattern.
- Produces: `validateForBackup(): void`, four required backup string getters, and `databaseName` for non-secret backup object naming.

- [ ] **Step 1: Write failing configuration tests**

Append to `apps/server/src/config/config.service.spec.ts`:

```typescript
describe("backup COS configuration", () => {
  it("requires the complete private backup group only when backup validation is requested", () => {
    process.env = { ...originalEnv, ...validStartupEnv };
    const config = new ConfigService();

    expect(() => config.validateForStartup()).not.toThrow();
    expect(() => config.validateForBackup()).toThrow(
      /BACKUP_COS_SECRET_ID.*BACKUP_COS_SECRET_KEY.*BACKUP_COS_BUCKET.*BACKUP_COS_REGION/s,
    );
  });

  it("accepts a complete private backup group", () => {
    process.env = {
      ...originalEnv,
      BACKUP_COS_SECRET_ID: "backup-secret-id",
      BACKUP_COS_SECRET_KEY: "backup-secret-key",
      BACKUP_COS_BUCKET: "petcare-backup-1250000000",
      BACKUP_COS_REGION: "ap-guangzhou",
    };
    const config = new ConfigService();

    expect(() => config.validateForBackup()).not.toThrow();
    expect(config.databaseName).toBe("petcare");
    expect(config.backupCosBucket).toBe("petcare-backup-1250000000");
    expect(config.backupCosRegion).toBe("ap-guangzhou");
  });
});
```

Add deletion of all four backup variables in `beforeEach` so the tests are isolated.

- [ ] **Step 2: Run the focused test and verify it fails**

Run:

```bash
pnpm --filter @petcare/server test -- config.service.spec.ts
```

Expected: FAIL because the backup getters and `validateForBackup()` do not exist.

- [ ] **Step 3: Implement the backup-only validation boundary**

Add to `ConfigService`:

```typescript
validateForBackup(): void {
  const errors: string[] = [];
  for (const name of [
    "BACKUP_COS_SECRET_ID",
    "BACKUP_COS_SECRET_KEY",
    "BACKUP_COS_BUCKET",
    "BACKUP_COS_REGION",
  ]) {
    try {
      this.getRequiredString(name);
    } catch (error) {
      errors.push(error instanceof Error ? error.message : `${name} is invalid`);
    }
  }

  if (errors.length > 0) {
    throw new Error(`Invalid backup configuration:\n- ${errors.join("\n- ")}`);
  }

  if (!/^[a-z0-9][a-z0-9-]*-\d{10,}$/.test(this.backupCosBucket)) {
    throw new Error("BACKUP_COS_BUCKET must use the BucketName-APPID format");
  }

  if (!/^[a-z0-9]+(?:-[a-z0-9]+)+$/.test(this.backupCosRegion)) {
    throw new Error("BACKUP_COS_REGION has an invalid format");
  }
}

get backupCosSecretId(): string {
  return this.getRequiredString("BACKUP_COS_SECRET_ID");
}

get backupCosSecretKey(): string {
  return this.getRequiredString("BACKUP_COS_SECRET_KEY");
}

get backupCosBucket(): string {
  return this.getRequiredString("BACKUP_COS_BUCKET");
}

get backupCosRegion(): string {
  return this.getRequiredString("BACKUP_COS_REGION");
}

get databaseName(): string {
  return process.env.DB_NAME?.trim() || "petcare";
}
```

In `databaseUrl`, replace the local `process.env.DB_NAME` read with `const name = this.databaseName;` so runtime connections and backup object naming share one value.

Do not call `validateForBackup()` from `validateForStartup()`: the API Server and the independently scheduled backup job have different required configuration groups.

- [ ] **Step 4: Run ConfigService tests and typecheck**

Run:

```bash
pnpm --filter @petcare/server test -- config.service.spec.ts
pnpm --filter @petcare/server typecheck
```

Expected: both commands exit 0 and no secret value appears in thrown messages.

- [ ] **Step 5: Commit backup configuration**

```bash
git add apps/server/src/config/config.service.ts apps/server/src/config/config.service.spec.ts
git commit -m "feat(config): 增加数据库备份凭据组"
```

---

### Task 2: Reuse the installed COS SDK for encrypted upload and explicit download

**Files:**

- Create: `apps/server/src/operations/database-backup-storage.ts`
- Create: `apps/server/src/operations/database-backup-storage.spec.ts`
- Create: `apps/server/src/operations/database-backup-cli.ts`

**Interfaces:**

- Consumes: `ConfigService.validateForBackup()`, the four backup getters, local file paths, and `cos-nodejs-sdk-v5` callback APIs.
- Produces: `DatabaseBackupStorage.upload(filePath: string, objectKey: string): Promise<void>`, `DatabaseBackupStorage.download(objectKey: string, filePath: string): Promise<void>`, and CLI forms `upload <file> <object-key>` / `download <object-key> <file>`.

- [ ] **Step 1: Write failing storage adapter tests**

Create `apps/server/src/operations/database-backup-storage.spec.ts`:

```typescript
import { createReadStream, createWriteStream } from "node:fs";
import { ConfigService } from "../config/config.service";
import { DatabaseBackupStorage } from "./database-backup-storage";

jest.mock("node:fs", () => ({
  ...jest.requireActual("node:fs"),
  createReadStream: jest.fn(() => "dump-stream"),
  createWriteStream: jest.fn(() => "restore-stream"),
}));

describe("DatabaseBackupStorage", () => {
  const config = {
    backupCosBucket: "petcare-backup-1250000000",
    backupCosRegion: "ap-guangzhou",
  } as ConfigService;
  const cos = { putObject: jest.fn(), getObject: jest.fn() };
  const storage = new DatabaseBackupStorage(cos as never, config);

  beforeEach(() => {
    jest.clearAllMocks();
    cos.putObject.mockImplementation((_params, callback) => callback(null, {}));
    cos.getObject.mockImplementation((_params, callback) => callback(null, {}));
  });

  it("uploads a private encrypted dump", async () => {
    await storage.upload(
      "/backup/database.dump",
      "postgresql/2026/08/petcare-20260820T010203Z.dump",
    );

    expect(createReadStream).toHaveBeenCalledWith("/backup/database.dump");
    expect(cos.putObject).toHaveBeenCalledWith(
      expect.objectContaining({
        Bucket: "petcare-backup-1250000000",
        Region: "ap-guangzhou",
        Key: "postgresql/2026/08/petcare-20260820T010203Z.dump",
        Body: "dump-stream",
        ServerSideEncryption: "AES256",
      }),
      expect.any(Function),
    );
  });

  it("downloads only the explicitly selected object", async () => {
    await storage.download(
      "postgresql/2026/08/petcare-20260820T010203Z.dump",
      "/restore/database.dump",
    );

    expect(createWriteStream).toHaveBeenCalledWith("/restore/database.dump", { mode: 0o600 });
    expect(cos.getObject).toHaveBeenCalledWith(
      expect.objectContaining({
        Bucket: "petcare-backup-1250000000",
        Region: "ap-guangzhou",
        Key: "postgresql/2026/08/petcare-20260820T010203Z.dump",
        Output: "restore-stream",
      }),
      expect.any(Function),
    );
  });
});
```

- [ ] **Step 2: Run the storage test and confirm it is red**

Run:

```bash
pnpm --filter @petcare/server test -- database-backup-storage.spec.ts
```

Expected: FAIL because `DatabaseBackupStorage` is missing.

- [ ] **Step 3: Implement the narrow COS adapter**

Create `apps/server/src/operations/database-backup-storage.ts`:

```typescript
import { createReadStream, createWriteStream } from "node:fs";
import type COS from "cos-nodejs-sdk-v5";
import { ConfigService } from "../config/config.service";

export class DatabaseBackupStorage {
  constructor(
    private readonly cos: Pick<COS, "putObject" | "getObject">,
    private readonly config: ConfigService,
  ) {}

  upload(filePath: string, objectKey: string): Promise<void> {
    return new Promise((resolve, reject) => {
      this.cos.putObject(
        {
          Bucket: this.config.backupCosBucket,
          Region: this.config.backupCosRegion,
          Key: objectKey,
          Body: createReadStream(filePath),
          ServerSideEncryption: "AES256",
        },
        (error) => (error ? reject(error) : resolve()),
      );
    });
  }

  download(objectKey: string, filePath: string): Promise<void> {
    return new Promise((resolve, reject) => {
      this.cos.getObject(
        {
          Bucket: this.config.backupCosBucket,
          Region: this.config.backupCosRegion,
          Key: objectKey,
          Output: createWriteStream(filePath, { mode: 0o600 }),
        },
        (error) => (error ? reject(error) : resolve()),
      );
    });
  }
}
```

Do not log COS credentials, local paths, or SDK error bodies.

- [ ] **Step 4: Add the executable CLI with strict arguments**

Create `apps/server/src/operations/database-backup-cli.ts`:

```typescript
import COS from "cos-nodejs-sdk-v5";
import { ConfigService } from "../config/config.service";
import { DatabaseBackupStorage } from "./database-backup-storage";

async function main(): Promise<void> {
  const [operation, first, second, ...extra] = process.argv.slice(2);

  if (extra.length > 0 || !first || !second || !["upload", "download"].includes(operation)) {
    throw new Error("Usage: database-backup-cli <upload|download> <source> <destination>");
  }

  const config = new ConfigService();
  config.validateForBackup();
  const storage = new DatabaseBackupStorage(
    new COS({
      SecretId: config.backupCosSecretId,
      SecretKey: config.backupCosSecretKey,
      Protocol: "https:",
    }),
    config,
  );

  if (operation === "upload") {
    await storage.upload(first, second);
  } else {
    await storage.download(first, second);
  }
}

void main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "Database backup operation failed";

  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
});
```

The shell scripts supply the exact argument order. The CLI must not print a success payload that could include SDK response metadata.

- [ ] **Step 5: Run focused tests and build the Server image payload**

Run:

```bash
pnpm --filter @petcare/server test -- database-backup-storage.spec.ts config.service.spec.ts
pnpm --filter @petcare/server typecheck
pnpm --filter @petcare/server build
```

Expected: all commands exit 0 and `apps/server/dist/operations/database-backup-cli.js` exists.

- [ ] **Step 6: Commit the backup storage CLI**

```bash
git add apps/server/src/operations/database-backup-storage.ts apps/server/src/operations/database-backup-storage.spec.ts apps/server/src/operations/database-backup-cli.ts
git commit -m "feat(backup): 接入私有 COS 数据库存储"
```

---

### Task 3: Create and validate fail-closed database backups

**Files:**

- Create: `scripts/database-backup.sh`
- Create: `scripts/database-operations-policy.test.mjs`
- Modify: `package.json`

**Interfaces:**

- Consumes: `/opt/petcare/.env`, `/etc/petcare-backup.env`, the current Compose Server image or an explicit `BACKUP_RUNNER_IMAGE`, and the compiled backup CLI.
- Produces: `scripts/database-backup.sh`, which exits 0 only after a non-empty validated dump has been encrypted and uploaded to `postgresql/<database>-<schema>/YYYY/MM/<database>-<schema>-<UTC timestamp>.dump`.

- [ ] **Step 1: Write the failing backup policy test**

Create `scripts/database-operations-policy.test.mjs`:

```javascript
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";

const root = resolve(import.meta.dirname, "..");

test("数据库备份使用容器工具、校验转储并通过 Server 镜像上传", async () => {
  const script = await readFile(resolve(root, "scripts/database-backup.sh"), "utf8");

  assert.match(script, /^set -Eeuo pipefail$/m);
  assert.match(script, /^umask 077$/m);
  assert.match(
    script,
    /docker compose [\s\S]*? exec -T postgres [\s\S]*?pg_dump [\s\S]*?--format=custom/,
  );
  assert.match(script, /docker compose .* exec -T postgres pg_restore --list/);
  assert.match(script, /docker compose .* images -q server/);
  assert.match(script, /--env-file \/etc\/petcare-backup\.env/);
  assert.match(script, /database-backup-cli\.js upload/);
  assert.match(script, /OBJECT_KEY="postgresql\/\$DATABASE_ID\/\$YEAR\/\$MONTH/);
  assert.match(script, /trap .*EXIT/);
  assert.doesNotMatch(script, /BACKUP_COS_SECRET_(?:ID|KEY)=/);
});
```

Add `scripts/database-operations-policy.test.mjs` to the root `test:tooling` command.

- [ ] **Step 2: Run the policy test and confirm the script is missing**

Run:

```bash
node --test scripts/database-operations-policy.test.mjs
```

Expected: FAIL with `ENOENT` for `scripts/database-backup.sh`.

- [ ] **Step 3: Implement the smallest complete backup script**

Create `scripts/database-backup.sh`:

```bash
#!/usr/bin/env bash
set -Eeuo pipefail
umask 077

INSTALL_DIR="/opt/petcare"
BACKUP_DIR="/var/lib/petcare-backups"
BACKUP_ENV="/etc/petcare-backup.env"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
YEAR="$(date -u +%Y)"
MONTH="$(date -u +%m)"

cleanup() {
  rm -f -- "$DUMP_PATH"
}
trap cleanup EXIT

cd "$INSTALL_DIR"
test -r .env
test -r "$BACKUP_ENV"
install -d -m 700 "$BACKUP_DIR"

if [[ -r .deploy-images.env ]]; then
  if grep -Ev '^(IMAGE_REGISTRY|SERVER_IMAGE_TAG|ADMIN_IMAGE_TAG|WEBSITE_IMAGE_TAG)=[a-zA-Z0-9./:_-]+$' .deploy-images.env | grep -q .; then
    echo "Invalid .deploy-images.env" >&2
    exit 1
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
```

Do not add a host-side COS CLI or PostgreSQL client. The `EXIT` trap removes the sensitive local dump whether upload succeeds or fails.

- [ ] **Step 4: Run static and shell verification**

Run:

```bash
bash -n scripts/database-backup.sh
node --test scripts/database-operations-policy.test.mjs
pnpm lint:scripts
git diff --check
```

Expected: all commands exit 0. Do not execute a real upload without the dedicated private bucket credentials.

- [ ] **Step 5: Commit the fail-closed backup command**

```bash
git update-index --add --chmod=+x scripts/database-backup.sh
git add scripts/database-backup.sh scripts/database-operations-policy.test.mjs package.json
git commit -m "feat(backup): 增加数据库转储与加密上传"
```

---

### Task 4: Restore one selected backup into an isolated database

**Files:**

- Create: `scripts/database-restore.sh`
- Modify: `scripts/database-operations-policy.test.mjs`

**Interfaces:**

- Consumes: one explicit object key in the `postgresql/<database>-<schema>/YYYY/MM/*.dump` namespace and the same backup COS environment file.
- Produces: a completed restore exercise against `petcare_restore_<UTC timestamp>` followed by removal of that temporary database; production `DB_NAME` is never a restore target.

- [ ] **Step 1: Add the failing restore policy test**

Append to `scripts/database-operations-policy.test.mjs`:

```javascript
test("恢复流程要求显式对象并只写入临时数据库", async () => {
  const script = await readFile(resolve(root, "scripts/database-restore.sh"), "utf8");

  assert.match(script, /\$\{1:\?请提供 COS 对象 Key\}/);
  assert.match(script, /\^postgresql\//);
  assert.match(script, /database-backup-cli\.js download/);
  assert.match(script, /pg_restore --list/);
  assert.match(script, /RESTORE_DB="petcare_restore_/);
  assert.match(script, /createdb/);
  assert.match(script, /pg_restore [\s\S]*?--exit-on-error/);
  assert.match(script, /prisma:migrate:status/);
  assert.match(script, /dropdb/);
  assert.doesNotMatch(script, /dropdb[^\n]*\$\{?DB_NAME/);
  assert.doesNotMatch(script, /pg_restore[^\n]*-d "?\$\{?DB_NAME/);
});
```

- [ ] **Step 2: Run the policy test and verify it fails**

Run:

```bash
node --test scripts/database-operations-policy.test.mjs
```

Expected: FAIL with `ENOENT` for `scripts/database-restore.sh`.

- [ ] **Step 3: Implement explicit restore-to-temporary-database**

Create `scripts/database-restore.sh`:

```bash
#!/usr/bin/env bash
set -Eeuo pipefail
umask 077

OBJECT_KEY="${1:?请提供 COS 对象 Key}"
[[ "$OBJECT_KEY" =~ ^postgresql/[a-zA-Z0-9_-]+/[0-9]{4}/[0-9]{2}/[a-zA-Z0-9_-]+-[0-9]{8}T[0-9]{6}Z\.dump$ ]]

INSTALL_DIR="/opt/petcare"
RESTORE_DIR="/var/lib/petcare-restores"
BACKUP_ENV="/etc/petcare-backup.env"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
RESTORE_DB="petcare_restore_${STAMP,,}"
DUMP_PATH="$RESTORE_DIR/$STAMP.dump"
CREATED_DB=false

cleanup() {
  rm -f -- "$DUMP_PATH"
  if [[ "$CREATED_DB" == false ]]; then
    return
  fi
  docker compose --env-file .env exec -T postgres sh -lc \
    'dropdb -U "$POSTGRES_USER" --if-exists "$1"' sh "$RESTORE_DB"
}
trap cleanup EXIT

cd "$INSTALL_DIR"
test -r .env
test -r "$BACKUP_ENV"
test -r .deploy-images.env
install -d -m 700 "$RESTORE_DIR"

if grep -Ev '^(IMAGE_REGISTRY|SERVER_IMAGE_TAG|ADMIN_IMAGE_TAG|WEBSITE_IMAGE_TAG)=[a-zA-Z0-9./:_-]+$' .deploy-images.env | grep -q .; then
  echo "Invalid .deploy-images.env" >&2
  exit 1
fi
source .deploy-images.env
export IMAGE_REGISTRY SERVER_IMAGE_TAG ADMIN_IMAGE_TAG WEBSITE_IMAGE_TAG

SERVER_IMAGE="$(docker compose --env-file .env images -q server)"
test -n "$SERVER_IMAGE"
docker run --rm \
  --env-file "$BACKUP_ENV" \
  --mount "type=bind,src=$RESTORE_DIR,dst=/restore" \
  "$SERVER_IMAGE" \
  node apps/server/dist/operations/database-backup-cli.js \
  download "$OBJECT_KEY" "/restore/$STAMP.dump"

test -s "$DUMP_PATH"
docker compose --env-file .env exec -T postgres pg_restore --list < "$DUMP_PATH" > /dev/null
docker compose --env-file .env exec -T postgres sh -lc \
  'createdb -U "$POSTGRES_USER" "$1"' sh "$RESTORE_DB"
CREATED_DB=true
docker compose --env-file .env exec -T postgres sh -lc \
  'pg_restore -U "$POSTGRES_USER" -d "$1" --no-owner --exit-on-error' sh "$RESTORE_DB" < "$DUMP_PATH"
docker compose --env-file .env exec -T postgres sh -lc \
  'psql -U "$POSTGRES_USER" -d "$1" -v ON_ERROR_STOP=1 -c "SELECT COUNT(*) AS application_tables FROM information_schema.tables WHERE table_schema NOT IN ('\''pg_catalog'\'', '\''information_schema'\'');"' \
  sh "$RESTORE_DB"
docker compose --env-file .env run --rm --no-deps -e DB_NAME="$RESTORE_DB" server \
  pnpm --filter @petcare/server prisma:migrate:status

printf '恢复验证完成，临时数据库将删除：%s\n' "$RESTORE_DB"
printf '生产数据库未被修改。\n'
```

The only automatic `dropdb` target is the generated `petcare_restore_...` database. The `EXIT` trap removes it after both successful and failed exercises.

- [ ] **Step 4: Run shell and policy checks**

Run:

```bash
bash -n scripts/database-restore.sh
node --test scripts/database-operations-policy.test.mjs
pnpm lint:scripts
git diff --check
```

Expected: all commands exit 0. Do not run the restore script against COS during this task.

- [ ] **Step 5: Commit isolated restore support**

```bash
git update-index --add --chmod=+x scripts/database-restore.sh
git add scripts/database-restore.sh scripts/database-operations-policy.test.mjs
git commit -m "feat(backup): 增加隔离数据库恢复验证"
```

---

### Task 5: Install a daily systemd schedule without embedding credentials

**Files:**

- Create: `deploy/systemd/petcare-backup.service`
- Create: `deploy/systemd/petcare-backup.timer`
- Modify: `scripts/server-init.sh`
- Modify: `scripts/database-operations-policy.test.mjs`

**Interfaces:**

- Consumes: `/opt/petcare/scripts/database-backup.sh` and `/etc/petcare-backup.env`.
- Produces: installed but initially disabled systemd units; the deployment workflow enables the timer only after writing valid credentials.

- [ ] **Step 1: Add failing systemd policy assertions**

Append to `scripts/database-operations-policy.test.mjs`:

```javascript
test("systemd 每日调度只从 root 环境文件读取备份凭据", async () => {
  const [service, timer, init] = await Promise.all([
    readFile(resolve(root, "deploy/systemd/petcare-backup.service"), "utf8"),
    readFile(resolve(root, "deploy/systemd/petcare-backup.timer"), "utf8"),
    readFile(resolve(root, "scripts/server-init.sh"), "utf8"),
  ]);

  assert.match(service, /EnvironmentFile=\/etc\/petcare-backup\.env/);
  assert.match(service, /ExecStart=\/opt\/petcare\/scripts\/database-backup\.sh/);
  assert.match(timer, /OnCalendar=\*-\*-\* 03:17:00 Asia\/Shanghai/);
  assert.match(timer, /Persistent=true/);
  assert.match(init, /chmod 0755 scripts\/database-backup\.sh scripts\/database-restore\.sh/);
  assert.match(init, /install -m 0644 deploy\/systemd\/petcare-backup\.service/);
  assert.match(init, /systemctl daemon-reload/);
  assert.doesNotMatch(init, /enable --now petcare-backup\.timer/);
});
```

- [ ] **Step 2: Run the policy test and verify it is red**

Run:

```bash
node --test scripts/database-operations-policy.test.mjs
```

Expected: FAIL because the unit files do not exist.

- [ ] **Step 3: Add the systemd unit and timer**

Create `deploy/systemd/petcare-backup.service`:

```ini
[Unit]
Description=PetCare PostgreSQL backup to private Tencent COS
Requires=docker.service
After=docker.service

[Service]
Type=oneshot
User=root
EnvironmentFile=/etc/petcare-backup.env
ExecStart=/opt/petcare/scripts/database-backup.sh
```

Create `deploy/systemd/petcare-backup.timer`:

```ini
[Unit]
Description=Run PetCare PostgreSQL backup daily

[Timer]
OnCalendar=*-*-* 03:17:00 Asia/Shanghai
RandomizedDelaySec=1800
Persistent=true
Unit=petcare-backup.service

[Install]
WantedBy=timers.target
```

- [ ] **Step 4: Install units during one-time server initialization**

After cloning and entering `/opt/petcare`, add to `scripts/server-init.sh`:

```bash
chmod 0755 scripts/database-backup.sh scripts/database-restore.sh
install -m 0644 deploy/systemd/petcare-backup.service /etc/systemd/system/petcare-backup.service
install -m 0644 deploy/systemd/petcare-backup.timer /etc/systemd/system/petcare-backup.timer
systemctl daemon-reload
```

Do not enable the timer here because `/etc/petcare-backup.env` is installed later from the GitHub `production` Environment.

- [ ] **Step 5: Run policy and syntax verification**

Run:

```bash
systemd-analyze verify deploy/systemd/petcare-backup.service deploy/systemd/petcare-backup.timer
bash -n scripts/server-init.sh scripts/database-backup.sh scripts/database-restore.sh
node --test scripts/database-operations-policy.test.mjs
git diff --check
```

Expected: all commands exit 0 on a Linux host. On Windows, run the Bash and systemd checks in CI or WSL and record that local PowerShell did not execute them.

- [ ] **Step 6: Commit daily scheduling support**

```bash
git add deploy/systemd/petcare-backup.service deploy/systemd/petcare-backup.timer scripts/server-init.sh scripts/database-operations-policy.test.mjs
git commit -m "feat(backup): 配置每日异地备份调度"
```

---

### Task 6: Document credentials, retention, verification, and restore

**Files:**

- Modify: `docs/08-deployment/github-actions-deploy.md`
- Modify: `docs/08-deployment/deployment.md`
- Modify: `docs/environment-variables.md`
- Modify: `SECURITY-CHECKLIST.md`

**Interfaces:**

- Consumes: Tasks 1-5 and the Tencent COS console.
- Produces: an operator runbook for private-bucket creation, 30-day lifecycle, SSE, timer checks, manual backup, explicit restore, and credential rotation.

- [ ] **Step 1: Add the exact backup configuration and console requirements**

Document this root-only server file without example secret values:

```dotenv
BACKUP_COS_SECRET_ID=
BACKUP_COS_SECRET_KEY=
BACKUP_COS_BUCKET=
BACKUP_COS_REGION=
```

State that GitHub stores the same four names in the `production` Environment and deployment writes `/etc/petcare-backup.env` with mode `600`. In Tencent COS, require: private read/write, HTTPS, server-side encryption, a credential limited to the selected bucket's `postgresql/` prefix, and a lifecycle deleting `postgresql/` objects after 30 days. Require an external alert on `petcare-backup.service` failure because systemd journal alone does not notify an operator.

- [ ] **Step 2: Add exact operator commands**

```bash
# Verify scheduling
systemctl status petcare-backup.timer
systemctl list-timers petcare-backup.timer

# Run and inspect one backup
systemctl start petcare-backup.service
journalctl -u petcare-backup.service --since today

# Restore one selected object into a temporary database
/opt/petcare/scripts/database-restore.sh postgresql/petcare-public/2026/08/petcare-public-20260820T010203Z.dump
```

Document that backup success must be confirmed from COS object metadata and that restoring into production is a separate human-authorized maintenance operation outside the automated script.

- [ ] **Step 3: Run documentation checks**

Run:

```bash
pnpm exec prettier --check docs/08-deployment/github-actions-deploy.md docs/08-deployment/deployment.md docs/environment-variables.md SECURITY-CHECKLIST.md
rg -n "BACKUP_COS|30 天|database-restore|petcare-backup.timer" docs/08-deployment docs/environment-variables.md SECURITY-CHECKLIST.md
git diff --check
```

Expected: all checks pass; no document contains a real SecretId, SecretKey, bucket name, or database password.

- [ ] **Step 4: Commit the backup runbook**

```bash
git add docs/08-deployment/github-actions-deploy.md docs/08-deployment/deployment.md docs/environment-variables.md SECURITY-CHECKLIST.md
git commit -m "docs(backup): 补充异地备份恢复手册"
```
