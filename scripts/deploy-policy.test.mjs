import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";

const root = resolve(import.meta.dirname, "..");

function position(script, fragment) {
  const index = script.indexOf(fragment);

  assert.notEqual(index, -1, "Expected release script to contain: " + fragment);

  return index;
}

function lastPosition(script, fragment) {
  const index = script.lastIndexOf(fragment);

  assert.notEqual(index, -1, "Expected release script to contain: " + fragment);

  return index;
}

test("生产发布只在完整验证后原子保存可回退的镜像状态", async () => {
  const [script, packageJsonText] = await Promise.all([
    readFile(resolve(root, "scripts/release-production.sh"), "utf8"),
    readFile(resolve(root, "package.json"), "utf8"),
  ]);
  const packageJson = JSON.parse(packageJsonText);

  assert.match(script, /^set -Eeuo pipefail$/m);
  assert.match(script, /^umask 077$/m);
  assert.match(
    script,
    /^STATE_KEYS=\(IMAGE_REGISTRY SERVER_IMAGE_TAG ADMIN_IMAGE_TAG WEBSITE_IMAGE_TAG\)$/m,
  );
  assert.match(script, /parse_state_file\(\) \{/);
  assert.match(script, /local -A seen=\(\)/);
  assert.match(script, /for key in "\$\{STATE_KEYS\[@\]\}"; do/);
  assert.match(script, /状态文件键重复/);
  assert.match(script, /状态文件缺少键/);
  assert.doesNotMatch(script, /(?:^|\n)\s*(?:source|\.)\s+.*deploy-images\.env/m);
  assert.doesNotMatch(script, /\beval\b/);
  assert.doesNotMatch(script, /grep[^\n]*\|\s*grep\b/);

  assert.match(script, /首次部署必须选择 target=all/);
  assert.match(script, /TARGET.*!= all[\s\S]*IMAGE_REGISTRY.*!=.*OLD_IMAGE_REGISTRY/);
  assert.match(
    script,
    /all\)[\s\S]*SERVER_IMAGE_TAG="\$NEW_IMAGE_TAG"[\s\S]*ADMIN_IMAGE_TAG="\$NEW_IMAGE_TAG"[\s\S]*WEBSITE_IMAGE_TAG="\$NEW_IMAGE_TAG"/,
  );
  assert.match(
    script,
    /server\)[\s\S]*?APP_SERVICES=\(server\)[\s\S]*?RESTART_SERVICES=\(admin website-gateway\)/,
  );
  assert.match(
    script,
    /admin\)[\s\S]*?APP_SERVICES=\(admin\)[\s\S]*?RESTART_SERVICES=\(edge-gateway\)/,
  );
  assert.match(
    script,
    /website\)[\s\S]*?APP_SERVICES=\(website\)[\s\S]*?RESTART_SERVICES=\(website-gateway\)/,
  );

  const cleanup = position(script, "trap cleanup EXIT");
  const candidate = position(
    script,
    'CANDIDATE_STATE="$(mktemp "$INSTALL_DIR/.deploy-images.XXXXXX")"',
  );
  const candidateMode = position(script, 'chmod 600 "$CANDIDATE_STATE"');
  const backup = position(script, "scripts/database-backup.sh");
  const migrate = position(script, "prisma:migrate:deploy");
  const wait = lastPosition(script, "--wait-timeout 180");
  const httpSmoke = position(script, "http://$host/");
  const httpsSmoke = position(script, "https://petcare-home.com");
  const persist = position(script, 'mv -f -- "$CANDIDATE_STATE" "$STATE_FILE"');

  assert.ok(cleanup < candidate && candidate < candidateMode);
  assert.ok(
    backup < migrate &&
      migrate < wait &&
      wait < httpSmoke &&
      httpSmoke < httpsSmoke &&
      httpsSmoke < persist,
  );
  assert.match(script, /local status=\$\?/);
  assert.match(script, /rm -f -- "\$CANDIDATE_STATE"/);
  assert.match(
    script,
    /HAD_STATE.*false[\s\S]*APPLICATION_TABLES.*== 0[\s\S]*跳过无历史意义的备份/,
  );
  assert.match(
    script,
    /BACKUP_RUNNER_IMAGE="\$IMAGE_REGISTRY\/server:\$SERVER_IMAGE_TAG" scripts\/database-backup\.sh/,
  );
  assert.match(script, /INITIALIZE_DATA.*true[\s\S]*TARGET.*all[\s\S]*prisma:seed/);
  assert.doesNotMatch(script, /prisma:push|prisma db push/);

  assert.match(script, /trap on_error ERR/);
  assert.match(script, /ROLLBACK_RUNNING/);
  assert.match(script, /trap - ERR/);
  assert.match(script, /应用镜像回滚已尝试；数据库 migration 未回滚/);
  assert.match(
    script,
    /for host in petcare-home\.com www\.petcare-home\.com admin\.petcare-home\.com; do/,
  );
  assert.match(
    script,
    /redirect="\$\(curl --silent --show-error --head --max-redirs 0 --proto '=http' --output \/dev\/null --write-out '%\{http_code\} %\{redirect_url\}' "http:\/\/\$host\/"\)"/,
  );
  assert.match(script, /\[\[ "\$redirect" == "301 https:\/\/\$host\/" \]\]/);
  assert.doesNotMatch(script, /headers="\$\(curl/);
  assert.doesNotMatch(script, /grep -Eq '\^HTTP/);
  assert.doesNotMatch(script, /grep -Eiq "\^location:/);
  for (const url of [
    "https://petcare-home.com",
    "https://www.petcare-home.com",
    "https://admin.petcare-home.com",
    "https://admin.petcare-home.com/api/ready",
  ]) {
    assert.ok(script.includes(url));
  }
  assert.match(script, /--proto '=https' --tlsv1\.2/);
  assert.match(packageJson.scripts["test:tooling"], /\bscripts\/deploy-policy\.test\.mjs\b/);
});
