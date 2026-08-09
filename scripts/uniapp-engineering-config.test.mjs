import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import process from "node:process";
import test from "node:test";
import { resolve } from "node:path";
import { setImmediate } from "node:timers/promises";

import { ESLint } from "eslint";
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
  for (const config of [mainConfig, appConfig]) {
    assert.notEqual(config.rules["style/quotes"]?.[0], 2);
    assert.notEqual(config.rules["style/semi"]?.[0], 2);
    assert.deepEqual(config.rules.quotes.slice(0, 2), [2, "double"]);
    assert.deepEqual(config.rules.semi.slice(0, 2), [2, "always"]);
  }
  assert.equal(appConfig.rules.semi[0], 2);
  assert.equal(appConfig.rules["petcare-import/named"][0], 0);
  assert.equal(appConfig.languageOptions.parser.meta.name, "vue-eslint-parser");
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
