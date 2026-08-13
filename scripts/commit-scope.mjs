const DIRECT_WORKSPACES = Object.freeze({
  "apps/admin/": "@petcare/admin",
  "apps/miniapp/": "@petcare/miniapp",
  "apps/server/": "@petcare/server",
  "apps/website/": "@petcare/website",
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
  "@petcare/server",
  "@petcare/website",
  "@petcare/api-client",
  "@petcare/shared-types",
  "@petcare/shared-utils",
]);

const STYLE_PROJECTS = Object.freeze({
  admin: "@petcare/admin",
  website: "@petcare/website",
});

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
    if (path.startsWith("apps/website/src/")) styleScopes.add("website");
  }

  return {
    fullTypecheck,
    typecheckSelectors: fullTypecheck ? [] : [...typecheckSelectors].sort(),
    styleScopes: [...styleScopes].sort(),
  };
}

export function createFilterArguments(selectors) {
  return selectors.flatMap((selector) => ["--filter", selector]);
}

export function createCommitCheckPlan(scope) {
  const selectors = scope.fullTypecheck ? FULL_TYPECHECK_PROJECTS : scope.typecheckSelectors;

  return {
    typecheck:
      selectors.length === 0
        ? null
        : {
            kind: scope.fullTypecheck ? "full" : "affected",
            selectors,
            args: [...createFilterArguments(selectors), "--if-present", "run", "typecheck"],
          },
    styles: scope.styleScopes.map((scopeName) => {
      const project = STYLE_PROJECTS[scopeName];

      return {
        scope: scopeName,
        project,
        args: ["--filter", project, "run", "lint:styles"],
      };
    }),
  };
}

export function createPnpmInvocation(args, platform, comSpec) {
  if (platform === "win32") {
    return {
      executable: comSpec ?? "cmd.exe",
      args: ["/d", "/s", "/c", `pnpm ${args.join(" ")}`],
    };
  }

  return { executable: "pnpm", args };
}
