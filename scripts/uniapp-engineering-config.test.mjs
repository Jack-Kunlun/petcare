import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import process from "node:process";
import test from "node:test";
import { resolve } from "node:path";
import { setImmediate } from "node:timers/promises";

import { ESLint } from "eslint";
import { format, resolveConfig } from "prettier";
import { createBaseRulesConfig } from "../packages/eslint-config-base/index.js";

const repositoryRoot = resolve(import.meta.dirname, "..");
const uniappRoot = resolve(repositoryRoot, "apps/uniapp");

test("createBaseRulesConfig rewrites plugin rule IDs without setting a parser", () => {
  const config = createBaseRulesConfig({
    files: ["**/*.{ts,vue}"],
    pluginAliases: {
      "@typescript-eslint": "petcare-ts",
      unicorn: "petcare-unicorn",
      import: "petcare-import",
    },
    ruleOverrides: {
      "no-console": "off",
      "import/named": "off",
    },
  });

  assert.deepEqual(Object.keys(config).sort(), ["files", "plugins", "rules"]);
  assert.deepEqual(config.files, ["**/*.{ts,vue}"]);
  assert.equal(config.languageOptions?.parser, undefined);
  assert.deepEqual(Object.keys(config.plugins), [
    "petcare-ts",
    "petcare-unicorn",
    "petcare-import",
  ]);
  assert.equal(config.rules["petcare-ts/no-explicit-any"], "error");
  assert.equal(config.rules["petcare-unicorn/prefer-includes"], "error");
  assert.equal(config.rules["petcare-import/order"][0], "error");
  assert.equal(config.rules["petcare-import/named"], "off");
  assert.equal(config.rules["no-console"], "off");
  assert.equal(
    Object.keys(config.rules).some((ruleId) =>
      ["@typescript-eslint/", "unicorn/", "import/"].some((prefix) => ruleId.startsWith(prefix)),
    ),
    false,
  );
});

test("UniApp files receive the composed PetCare rules without replacing its parser", async () => {
  const eslint = new ESLint({
    cwd: uniappRoot,
    overrideConfigFile: "eslint.config.mjs",
  });

  const [mainConfig, appConfig] = await Promise.all([
    eslint.calculateConfigForFile("src/main.ts"),
    eslint.calculateConfigForFile("src/App.vue"),
  ]);

  assert.ok(mainConfig.plugins["petcare-ts"]);
  assert.ok(appConfig.plugins["petcare-unicorn"]);
  assert.equal(mainConfig.rules["petcare-ts/no-explicit-any"][0], 2);
  assert.equal(mainConfig.rules.quotes[0], 2);
  assert.equal(mainConfig.rules.semi[0], 2);
  for (const config of [mainConfig, appConfig]) {
    assert.notEqual(config.rules["style/quotes"]?.[0], 2);
    assert.notEqual(config.rules["style/semi"]?.[0], 2);
  }
  assert.deepEqual(mainConfig.rules.quotes.slice(0, 2), [2, "double"]);
  assert.deepEqual(mainConfig.rules.semi.slice(0, 2), [2, "always"]);
  assert.equal(appConfig.rules.quotes[0], 0);
  assert.equal(appConfig.rules.semi[0], 2);
  assert.equal(appConfig.rules["vue/html-indent"][0], 0);
  assert.equal(appConfig.rules["vue/singleline-html-element-content-newline"][0], 0);
  assert.equal(appConfig.rules["perfectionist/sort-imports"][0], 0);
  assert.equal(appConfig.rules["petcare-unicorn/no-nested-ternary"][0], 2);
  assert.equal(appConfig.rules["petcare-import/order"][0], 2);
  assert.equal(appConfig.rules["petcare-import/no-duplicates"][0], 2);
  assert.equal(appConfig.rules["antfu/import-dedupe"][0], 2);
  assert.equal(appConfig.rules["petcare-import/named"][0], 0);
  assert.equal(appConfig.languageOptions.parser.meta.name, "vue-eslint-parser");
});

test("UniApp Vue ESLint reaches a Prettier fixed point in fix mode", async () => {
  const eslint = new ESLint({
    cwd: uniappRoot,
    fix: true,
    overrideConfigFile: "eslint.config.mjs",
  });

  for (const relativePath of [
    "src/subPages/ci/index.vue",
    "src/subPages/feedback/index.vue",
    "src/subPages/router/demo-params.vue",
    "src/subPages/router/demo-query.vue",
  ]) {
    const filePath = resolve(uniappRoot, relativePath);
    const [source, prettierOptions] = await Promise.all([
      readFile(filePath, "utf8"),
      resolveConfig(filePath),
    ]);
    const formattedSource = await format(source, { ...prettierOptions, filepath: filePath });
    const [result] = await eslint.lintText(formattedSource, { filePath });

    assert.equal(result.errorCount, 0, relativePath);
    assert.equal(result.output, undefined, relativePath);
  }
});

test("UniApp whitespace-sensitive demo snippets stay multiline", async () => {
  const snippetExpectations = [
    {
      relativePath: "src/subPages/feedback/index.vue",
      prettierIgnoreCount: 6,
      multilineSnippet: "const { success, error, warning, info } = useGlobalToast()\n",
    },
    {
      relativePath: "src/subPages/router/demo-params.vue",
      prettierIgnoreCount: 2,
      multilineSnippet: "router.push({ name: 'demo-params', params: { username: 'eduardo' } })\n",
    },
    {
      relativePath: "src/subPages/router/demo-query.vue",
      prettierIgnoreCount: 3,
      multilineSnippet: "router.push({\n            path: '/demo-query',\n",
    },
  ];

  for (const { relativePath, prettierIgnoreCount, multilineSnippet } of snippetExpectations) {
    const source = await readFile(resolve(uniappRoot, relativePath), "utf8");
    assert.equal(
      source.match(/<!-- prettier-ignore -->/g)?.length ?? 0,
      prettierIgnoreCount,
      relativePath,
    );
    assert.ok(source.includes(multilineSnippet), relativePath);
  }
});

test("UniApp ESLint configuration reaches a fix-mode fixed point without circular fixes", async () => {
  const configFile = resolve(uniappRoot, "eslint.config.mjs");
  const configSource = await readFile(configFile, "utf8");
  const circularFixWarnings = [];
  const onWarning = (warning) => {
    if (warning.name === "ESLintCircularFixesWarning") {
      circularFixWarnings.push(warning);
    }
  };
  const eslint = new ESLint({
    cwd: uniappRoot,
    fix: true,
    overrideConfigFile: "eslint.config.mjs",
  });

  process.on("warning", onWarning);
  try {
    const [firstPass] = await eslint.lintText(configSource, { filePath: configFile });
    const [secondPass] = await eslint.lintText(firstPass.output ?? configSource, {
      filePath: configFile,
    });

    assert.equal(firstPass.errorCount, 0);
    assert.equal(secondPass.errorCount, 0);
    assert.equal(secondPass.output, undefined);
    await setImmediate();
    assert.deepEqual(circularFixWarnings, []);
  } finally {
    process.off("warning", onWarning);
  }
});

test("UniApp formatting policy uses the root Prettier ignore rules and staged-only linting", async () => {
  const [rootPackageSource, uniappPackageSource, prettierIgnore] = await Promise.all([
    readFile(resolve(repositoryRoot, "package.json"), "utf8"),
    readFile(resolve(uniappRoot, "package.json"), "utf8"),
    readFile(resolve(repositoryRoot, ".prettierignore"), "utf8"),
  ]);
  const rootPackage = JSON.parse(rootPackageSource);
  const uniappPackage = JSON.parse(uniappPackageSource);

  assert.equal(
    uniappPackage.scripts.format,
    "prettier --write . --ignore-path ../../.prettierignore",
  );
  assert.equal(
    uniappPackage.scripts["format:check"],
    "prettier --check . --ignore-path ../../.prettierignore",
  );
  assert.deepEqual(rootPackage["lint-staged"]["apps/uniapp/**/*.{js,mjs,ts,vue}"], [
    "prettier --write",
    "corepack pnpm --filter @petcare/uniapp exec -- eslint --fix",
  ]);
  assert.deepEqual(rootPackage["lint-staged"]["apps/uniapp/**/*.{md,html}"], ["prettier --write"]);
  for (const protectedPath of [
    "apps/uniapp/src/uni_modules/",
    "apps/uniapp/src/auto-imports.d.ts",
    "apps/uniapp/src/components.d.ts",
    "apps/uniapp/src/uni-pages.d.ts",
  ]) {
    assert.match(
      prettierIgnore,
      new RegExp(`^${protectedPath.replace(/[.*+?^${}()|[\\]\\]/g, "\\$&")}$`, "m"),
    );
  }
});
