/*
 * @Author: weisheng
 * @Date: 2025-08-28 20:59:43
 * @LastEditTime: 2025-11-17 14:28:09
 * @LastEditors: weisheng
 * @Description:
 * @FilePath: /wot-starter/manifest.config.ts
 * 记得注释
 */
import { defineManifestConfig } from '@uni-helper/vite-plugin-uni-manifest'

export default defineManifestConfig({
  'name': 'PetCare',
  'appid': '__UNI__UNCONFIGURED__',
  'description': '',
  'versionName': '1.0.0',
  'versionCode': '100',
  'transformPx': false,
  /* 5+App特有相关 */
  'app-plus': {
    usingComponents: true,
    nvueStyleCompiler: 'uni-app',
    compilerVersion: 3,
    splashscreen: {
      alwaysShowBeforeRender: true,
      waiting: true,
      autoclose: true,
      delay: 0,
    },
    /* 模块配置 */
    modules: {},
    /* 应用发布信息 */
    distribute: {
      /* Android permissions are added only when a PetCare feature requires them. */
      android: {},
      /* ios打包配置 */
      ios: {},
      /* SDK配置 */
      sdkConfigs: {},
    },
  },
  /* 快应用特有相关 */
  'quickapp': {},
  /* 小程序特有相关 */
  'mp-weixin': {
    optimization: {
      subPackages: true,
    },
    appid: '',
    setting: {
      urlCheck: true,
    },
    usingComponents: true,
    darkmode: true,
    themeLocation: 'theme.json',
  },
  'app-harmony': {},
  'mp-harmony': {},
  'mp-alipay': {
    usingComponents: true,
    compileOptions: {
      globalObjectMode: 'enable',
      treeShaking: true,
    },
  },
  'mp-baidu': {
    usingComponents: true,
  },
  'mp-toutiao': {
    usingComponents: true,
  },
  'h5': {
    darkmode: true,
    themeLocation: 'theme.json',
  },
  'uniStatistics': {
    enable: false,
  },
  'vueVersion': '3',
})
