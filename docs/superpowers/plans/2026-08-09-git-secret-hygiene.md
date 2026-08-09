# Git Secret Hygiene Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove repository-tracked local task artifacts and prevent local secrets, UniApp build outputs, mobile signing material, and packaged applications from being committed.

**Architecture:** Keep real local credentials in the already ignored root `.env`, preserve intentionally public template configuration such as `.env.example` and `apps/uniapp/.env.{development,staging,production}`, and enforce the boundary with a repository policy test. Remove only files that are simultaneously tracked and ignored; retain their local copies through `git rm --cached`.

**Tech Stack:** Git ignore rules, Node.js built-in test runner, pnpm workspace policy tests.

## Global Constraints

- Never print, copy, or commit values from the root `.env`.
- Preserve the user's staged and untracked documentation changes.
- Do not rewrite Git history: the audit found no high-confidence credential in tracked history.
- Do not remove the official UniApp scaffold, generated TypeScript declaration sources, or public `VITE_*` endpoint configuration.
- Keep `.superpowers` task reports locally while removing them from Git tracking.

---

### Task 1: Enforce Git hygiene and remove tracked local artifacts

**Files:**
- Modify: `scripts/repository-policy.test.mjs`
- Modify: `.gitignore`
- Untrack, keep locally: `.superpowers/sdd/2026-07-29-order-complaint-dispute/task-5-report.md`
- Untrack, keep locally: `.superpowers/sdd/2026-07-29-order-complaint-dispute/task-7-report.md`
- Test: `scripts/repository-policy.test.mjs`

**Interfaces:**
- Consumes: Git's `check-ignore` and `ls-files -ci --exclude-standard` commands.
- Produces: A repository invariant that no committed path is also ignored and that representative secret/mobile artifact paths are ignored.

- [x] **Step 1: Add the failing repository policy test**

Add a helper that runs Git with `spawnSync`, then add a test equivalent to:

```js
function runGit(args, input) {
  return spawnSync("git", args, {
    cwd: root,
    encoding: "utf8",
    input,
  });
}

test("local secrets and generated mobile artifacts stay out of Git", () => {
  const probes = [
    ".env.staging.local",
    ".envrc",
    ".direnv/allow",
    ".npmrc",
    "apps/uniapp/unpackage/dist/build/app-plus/app-service.js",
    "apps/uniapp/release/petcare.keystore",
    "apps/uniapp/release/petcare.p12",
    "apps/uniapp/release/PetCare.mobileprovision",
    "apps/uniapp/release/petcare.apk",
    "apps/uniapp/release/petcare.aab",
    "apps/uniapp/release/petcare.ipa",
  ];
  const ignored = runGit(["check-ignore", "--stdin"], `${probes.join("\n")}\n`);
  assert.equal(ignored.status, 0, ignored.stderr);
  assert.deepEqual(ignored.stdout.trim().split(/\r?\n/).sort(), probes.toSorted());

  const trackedIgnored = runGit(["ls-files", "-ci", "--exclude-standard"]);
  assert.equal(trackedIgnored.status, 0, trackedIgnored.stderr);
  assert.equal(trackedIgnored.stdout.trim(), "");
});
```

- [x] **Step 2: Run the test and confirm the policy is red**

Run:

```bash
node --test scripts/repository-policy.test.mjs
```

Expected: FAIL because mobile/signing probes are not yet ignored and two `.superpowers/sdd` reports are tracked despite the existing ignore rule.

- [x] **Step 3: Add narrowly justified ignore rules**

Update `.gitignore` to retain `.env.example`, generalize local environment overrides, and ignore shell-local credentials plus mobile outputs:

```gitignore
# Environment variables and local credentials
.env
.env.local
.env.*.local
.envrc
.direnv/
.npmrc
!.env.example

# Mobile build outputs and signing material
unpackage/
*.apk
*.aab
*.ipa
*.jks
*.keystore
*.p12
*.pfx
*.mobileprovision
*.pem
*.key
```

Do not ignore the tracked `apps/uniapp/.env.development`, `.env.staging`, or `.env.production` files because they contain public client configuration, not secrets.

- [x] **Step 4: Remove the two ignored task reports from Git tracking without deleting local copies**

Run:

```bash
git rm --cached -- .superpowers/sdd/2026-07-29-order-complaint-dispute/task-5-report.md .superpowers/sdd/2026-07-29-order-complaint-dispute/task-7-report.md
```

Expected: both paths are staged as deleted but remain present locally and ignored.

- [x] **Step 5: Run focused verification**

Run:

```bash
node --test scripts/repository-policy.test.mjs
git ls-files -ci --exclude-standard
git check-ignore -v .env .env.staging.local apps/uniapp/unpackage/app.js apps/uniapp/release/petcare.keystore apps/uniapp/release/petcare.apk
git diff --check
git diff --cached --check
```

Expected: policy tests pass; `git ls-files -ci` is empty; all probes are ignored; both diff checks pass.

- [x] **Step 6: Review scope without disturbing user work**

Run:

```bash
git status --short
git diff -- .gitignore scripts/repository-policy.test.mjs
git diff --cached --name-status
```

Expected: the user's pre-existing documentation paths remain unchanged; only the two `.superpowers` reports are staged deletions, while `.gitignore`, the policy test, and this plan remain unstaged unless the primary agent intentionally stages them later.
