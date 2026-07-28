import { defineConfig } from "@tarojs/cli";

const apiBaseUrl = process.env.TARO_APP_API_BASE_URL || "http://localhost:3000";

export default defineConfig({
  projectName: "petcare-miniapp",
  date: "2026-7-15",
  designWidth: 750,
  deviceRatio: {
    750: 1,
  },
  sourceRoot: "src",
  outputRoot: "dist",
  plugins: [],
  defineConstants: {
    __API_BASE_URL__: JSON.stringify(apiBaseUrl),
    ENABLE_INNER_HTML: "true",
    ENABLE_ADJACENT_HTML: "true",
    ENABLE_SIZE_APIS: "true",
    ENABLE_TEMPLATE_CONTENT: "true",
    ENABLE_MUTATION_OBSERVER: "true",
    ENABLE_CLONE_NODE: "true",
    ENABLE_CONTAINS: "true",
  },
  framework: "react",
  compiler: "webpack5",
  cache: {
    enable: false,
  },
  mini: {
    postcss: {
      pxtransform: {
        enable: true,
        config: {},
      },
      cssModules: {
        enable: false,
      },
    },
  },
  h5: {
    publicPath: "/",
    staticDirectory: "static",
    postcss: {
      autoprefixer: {
        enable: true,
        config: {},
      },
      cssModules: {
        enable: false,
      },
    },
  },
});
