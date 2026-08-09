const DIRECT_WORKSPACES = Object.freeze({
  "apps/admin/": "@petcare/admin",
  "apps/miniapp/": "@petcare/miniapp",
  "apps/uniapp/": "@petcare/uniapp",
  "apps/server/": "@petcare/server",
});

const DEPENDENT_WORKSPACES = Object.freeze({
  "packages/api-client/": "...@petcare/api-client",
  "packages/shared-types/": "...@petcare/shared-types",
  "packages/shared-utils/": "...@petcare/shared-utils",
});

const FULL_SCOPE_PATHS = new Set([
  "package.json",
  "pnpm-lock.yaml",
  "pnpm-workspace.yaml",
  "turbo.json",
  ".husky/pre-commit",
  "scripts/commit-check.mjs",
  "scripts/commit-scope.mjs",
]);

export const FULL_TYPECHECK_PROJECTS = Object.freeze([
  "@petcare/admin",
  "@petcare/miniapp",
  "@petcare/uniapp",
  "@petcare/server",
  "@petcare/api-client",
  "@petcare/shared-types",
  "@petcare/shared-utils",
]);

export function classifyStagedPaths(paths) {
  const normalizedPaths = paths.map((path) => path.replaceAll("\\", "/"));
  const typecheckSelectors = new Set();
  const styleScopes = new Set();
  let fullTypecheck = false;

  for (const path of normalizedPaths) {
    if (
      FULL_SCOPE_PATHS.has(path) ||
      /^tsconfig(?:\.[^/]+)?\.json$/u.test(path) ||
      path.startsWith("packages/eslint-config-base/")
    ) {
      fullTypecheck = true;
    }

    for (const [prefix, selector] of Object.entries(DIRECT_WORKSPACES)) {
      if (path.startsWith(prefix)) typecheckSelectors.add(selector);
    }

    for (const [prefix, selector] of Object.entries(DEPENDENT_WORKSPACES)) {
      if (path.startsWith(prefix)) typecheckSelectors.add(selector);
    }

    if (path.startsWith("apps/admin/src/")) styleScopes.add("admin");
    if (path.startsWith("apps/miniapp/src/")) styleScopes.add("miniapp");
  }

  return {
    fullTypecheck,
    typecheckSelectors: fullTypecheck ? [] : [...typecheckSelectors].sort(),
    styleScopes: [...styleScopes].sort(),
  };
}
