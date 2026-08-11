import { defineManifestConfig } from "@uni-helper/vite-plugin-uni-manifest";

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
    appid: "",
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
