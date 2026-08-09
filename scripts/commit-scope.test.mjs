import assert from "node:assert/strict";
import test from "node:test";

import {
  FULL_TYPECHECK_PROJECTS,
  classifyStagedPaths,
  createCommitCheckPlan,
  createPnpmInvocation,
} from "./commit-scope.mjs";

test("a UniApp source change selects only UniApp", () => {
  assert.deepEqual(classifyStagedPaths(["apps/uniapp/src/App.vue"]), {
    fullTypecheck: false,
    typecheckSelectors: ["@petcare/uniapp"],
    styleScopes: [],
  });
});

test("application selectors and style scopes are deduplicated and sorted", () => {
  assert.deepEqual(
    classifyStagedPaths([
      "apps/miniapp/src/pages/index.tsx",
      "apps/admin/src/App.tsx",
      "apps/admin/src/app.css",
    ]),
    {
      fullTypecheck: false,
      typecheckSelectors: ["@petcare/admin", "@petcare/miniapp"],
      styleScopes: ["admin", "miniapp"],
    },
  );
});

test("shared packages include their dependents", () => {
  assert.deepEqual(
    classifyStagedPaths([
      "packages/shared-types/src/index.ts",
      "packages/shared-utils/src/date.ts",
    ]).typecheckSelectors,
    ["...@petcare/shared-types", "...@petcare/shared-utils"],
  );
});

test("server and api-client changes select their workspace mappings", () => {
  assert.deepEqual(
    classifyStagedPaths([
      "apps/server/src/main.ts",
      "packages/api-client/src/index.ts",
    ]).typecheckSelectors,
    ["...@petcare/api-client", "@petcare/server"],
  );
});

test("root and shared lint configuration changes require all workspace typechecks", () => {
  for (const path of [
    "package.json",
    "pnpm-lock.yaml",
    "pnpm-workspace.yaml",
    "turbo.json",
    "tsconfig.base.json",
    "packages/eslint-config-base/index.js",
    ".husky/pre-commit",
    "scripts/commit-check.mjs",
    "scripts/commit-scope.mjs",
  ]) {
    const scope = classifyStagedPaths([path]);
    assert.equal(scope.fullTypecheck, true, path);
    assert.deepEqual(scope.typecheckSelectors, []);
  }

  assert.deepEqual(FULL_TYPECHECK_PROJECTS, [
    "@petcare/admin",
    "@petcare/miniapp",
    "@petcare/uniapp",
    "@petcare/server",
    "@petcare/api-client",
    "@petcare/shared-types",
    "@petcare/shared-utils",
  ]);
});

test("root tsconfig triggers the full typecheck while lookalikes do not", () => {
  assert.equal(classifyStagedPaths(["tsconfig.json"]).fullTypecheck, true);
  assert.deepEqual(classifyStagedPaths(["apps/admin2/src/x.ts"]), {
    fullTypecheck: false,
    typecheckSelectors: [],
    styleScopes: [],
  });
  assert.deepEqual(classifyStagedPaths(["nested/tsconfig.json"]), {
    fullTypecheck: false,
    typecheckSelectors: [],
    styleScopes: [],
  });
});

test("Windows separators and empty input are supported", () => {
  assert.deepEqual(classifyStagedPaths(["apps\\uniapp\\src\\main.ts"]), {
    fullTypecheck: false,
    typecheckSelectors: ["@petcare/uniapp"],
    styleScopes: [],
  });
  assert.deepEqual(classifyStagedPaths([]), {
    fullTypecheck: false,
    typecheckSelectors: [],
    styleScopes: [],
  });
});

test("full scope plans all workspace typechecks with a single pnpm invocation", () => {
  const plan = createCommitCheckPlan(classifyStagedPaths(["package.json"]));

  assert.deepEqual(plan.typecheck, {
    kind: "full",
    selectors: FULL_TYPECHECK_PROJECTS,
    args: [
      "--filter",
      "@petcare/admin",
      "--filter",
      "@petcare/miniapp",
      "--filter",
      "@petcare/uniapp",
      "--filter",
      "@petcare/server",
      "--filter",
      "@petcare/api-client",
      "--filter",
      "@petcare/shared-types",
      "--filter",
      "@petcare/shared-utils",
      "--if-present",
      "run",
      "typecheck",
    ],
  });
  assert.deepEqual(plan.styles, []);
});

test("affected scope plans selected typechecks and ordered style checks", () => {
  const plan = createCommitCheckPlan(
    classifyStagedPaths(["apps/miniapp/src/pages/index.tsx", "apps/admin/src/App.tsx"]),
  );

  assert.deepEqual(plan.typecheck, {
    kind: "affected",
    selectors: ["@petcare/admin", "@petcare/miniapp"],
    args: [
      "--filter",
      "@petcare/admin",
      "--filter",
      "@petcare/miniapp",
      "--if-present",
      "run",
      "typecheck",
    ],
  });
  assert.deepEqual(plan.styles, [
    {
      scope: "admin",
      project: "@petcare/admin",
      args: ["--filter", "@petcare/admin", "run", "lint:styles"],
    },
    {
      scope: "miniapp",
      project: "@petcare/miniapp",
      args: ["--filter", "@petcare/miniapp", "run", "lint:styles"],
    },
  ]);
});

test("empty scope plans no typecheck or style command", () => {
  assert.deepEqual(createCommitCheckPlan(classifyStagedPaths([])), {
    typecheck: null,
    styles: [],
  });
});

test("pnpm invocations preserve Windows and POSIX command boundaries", () => {
  const args = ["--filter", "@petcare/admin", "run", "lint:styles"];

  assert.deepEqual(createPnpmInvocation(args, "win32", "C:\\Windows\\System32\\cmd.exe"), {
    executable: "C:\\Windows\\System32\\cmd.exe",
    args: [
      "/d",
      "/s",
      "/c",
      "corepack pnpm --filter @petcare/admin run lint:styles",
    ],
  });
  assert.deepEqual(createPnpmInvocation(args, "linux"), {
    executable: "corepack",
    args: ["pnpm", ...args],
  });
});
