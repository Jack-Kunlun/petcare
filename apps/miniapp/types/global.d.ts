/// <reference types="@tarojs/taro" />

declare module "*.png";
declare module "*.gif";
declare module "*.jpg";
declare module "*.jpeg";
declare module "*.svg";
declare module "*.css";
declare module "*.less";
declare module "*.scss";
declare module "*.sass";
declare module "*.styl";

declare namespace NodeJS {
  interface ProcessEnv {
    /** Node 环境，会影响最终构建产物。 */
    NODE_ENV: "development" | "production";
    /** 当前 Taro 构建平台。 */
    TARO_ENV: "weapp" | "swan" | "alipay" | "h5" | "rn" | "tt" | "qq" | "jd" | "harmony" | "jdrn";
    /** 当前构建使用的小程序 AppID。 */
    TARO_APP_ID: string;
    /** 后端 API 根地址。 */
    TARO_APP_API_BASE_URL?: string;
  }
}
