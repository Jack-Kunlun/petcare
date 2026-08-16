import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import process from "node:process";
import { defineManifestConfig } from "@uni-helper/vite-plugin-uni-manifest";

function readEnvFromWorkspaceRoot(key: string): string | undefined {
  const workspaceRoot = resolve(import.meta.dirname, "../..");
  const envPath = resolve(workspaceRoot, ".env");

  if (!existsSync(envPath)) {
    return undefined;
  }

  const envContent = readFileSync(envPath, "utf-8");
  const line = envContent.split(/\r?\n/).find((rawLine) => rawLine.trim().startsWith(`${key}=`));

  if (!line) {
    return undefined;
  }

  const value = line.slice(line.indexOf("=") + 1).trim();

  return value.replace(/^['"]|['"]$/g, "");
}

const wechatAppId =
  process.env.WECHAT_APP_ID ??
  process.env.WECHAT_APPID ??
  readEnvFromWorkspaceRoot("WECHAT_APP_ID") ??
  readEnvFromWorkspaceRoot("WECHAT_APPID") ??
  "";

export default defineManifestConfig({
  name: "PetCare",
  appid: "__UNI__UNCONFIGURED__",
  description: "",
  versionName: "1.0.0",
  versionCode: "100",
  "app-plus": {
    usingComponents: true,
    nvueStyleCompiler: "uni-app",
    compilerVersion: 3,
    splashscreen: {
      alwaysShowBeforeRender: true,
      waiting: true,
      autoclose: true,
      delay: 0,
    },
    modules: {},
    distribute: {
      android: {},
      ios: {},
      sdkConfigs: {},
    },
  },
  "mp-weixin": {
    optimization: {
      subPackages: true,
    },
    appid: wechatAppId,
    setting: {
      urlCheck: true,
    },
    usingComponents: true,
  },
  h5: {},
  uniStatistics: {
    enable: false,
  },
  vueVersion: "3",
});
