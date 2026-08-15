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
const miniappRoot = resolve(repositoryRoot, "apps/miniapp");

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
  assert.deepEqual(config.rules.quotes, ["error", "double", { avoidEscape: true }]);
  assert.equal(
    Object.keys(config.rules).some((ruleId) =>
      ["@typescript-eslint/", "unicorn/", "import/"].some((prefix) => ruleId.startsWith(prefix)),
    ),
    false,
  );
});

test("Miniapp files receive the composed PetCare rules without replacing the UniApp parser", async () => {
  const eslint = new ESLint({
    cwd: miniappRoot,
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

test("Miniapp Vue ESLint reaches a Prettier fixed point in fix mode", async () => {
  const eslint = new ESLint({
    cwd: miniappRoot,
    fix: true,
    overrideConfigFile: "eslint.config.mjs",
  });

  for (const relativePath of ["src/pages/index/index.vue"]) {
    const filePath = resolve(miniappRoot, relativePath);
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

test("Miniapp ESLint configuration reaches a fix-mode fixed point without circular fixes", async () => {
  const configFile = resolve(miniappRoot, "eslint.config.mjs");
  const configSource = await readFile(configFile, "utf8");
  const circularFixWarnings = [];
  const onWarning = (warning) => {
    if (warning.name === "ESLintCircularFixesWarning") {
      circularFixWarnings.push(warning);
    }
  };
  const eslint = new ESLint({
    cwd: miniappRoot,
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

test("Miniapp formatting policy uses the root Prettier ignore rules and staged-only linting", async () => {
  const [rootPackageSource, miniappPackageSource, prettierIgnore] = await Promise.all([
    readFile(resolve(repositoryRoot, "package.json"), "utf8"),
    readFile(resolve(miniappRoot, "package.json"), "utf8"),
    readFile(resolve(repositoryRoot, ".prettierignore"), "utf8"),
  ]);
  const rootPackage = JSON.parse(rootPackageSource);
  const miniappPackage = JSON.parse(miniappPackageSource);

  assert.equal(miniappPackage.scripts.format, undefined);
  assert.equal(miniappPackage.scripts["format:check"], undefined);
  assert.equal(rootPackage.scripts.format, "prettier --write .");
  assert.equal(rootPackage.scripts["format:check"], "prettier --check .");
  assert.deepEqual(rootPackage["lint-staged"]["apps/miniapp/**/*.{js,mjs,ts,vue}"], [
    "pnpm --filter @petcare/miniapp exec -- eslint --fix",
    "prettier --write",
  ]);
  assert.deepEqual(rootPackage["lint-staged"]["apps/miniapp/**/*.{md,html}"], ["prettier --write"]);
  for (const protectedPath of [
    "apps/miniapp/src/uni_modules/",
    "apps/miniapp/src/auto-imports.d.ts",
    "apps/miniapp/src/components.d.ts",
    "apps/miniapp/src/uni-pages.d.ts",
  ]) {
    assert.match(
      prettierIgnore,
      new RegExp(`^${protectedPath.replace(/[.*+?^${}()|[\\]\\]/g, "\\$&")}$`, "m"),
    );
  }
});
