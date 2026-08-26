import { defineUniPages } from "@uni-helper/vite-plugin-uni-pages";

const subPageStyle = {
  navigationBarTextStyle: "black",
  navigationStyle: "custom",
} as const;

const createPage = (path: string) => ({ path, style: subPageStyle });

export default defineUniPages({
  pages: [],
  subPackages: [
    {
      root: "pages-bounty",
      pages: [
        "publish/step1",
        "publish/step2",
        "publish/step3",
        "publish/success",
        "reward/detail",
      ].map(createPage),
    },
    {
      root: "pages-care",
      pages: ["orders/index", "order/detail", "monitor/index", "chat/index"].map(createPage),
    },
    {
      root: "pages-account",
      pages: [
        "pets/index",
        "pets/form",
        "pets/detail",
        "favorites/index",
        "follows/index",
        "reviews/index",
        "services/detail",
        "caregivers/detail",
        "stores/detail",
        "creators/detail",
        "profile/info",
        "profile/edit",
        "account/cancel",
      ].map(createPage),
    },
    {
      root: "pages-content",
      pages: [
        "classroom/article",
        "community/article",
        "community/publish",
        "coupons/index",
        "wallet/index",
        "help/index",
        "contact/index",
        "legal/index",
      ].map(createPage),
    },
  ],
  globalStyle: {
    navigationBarTextStyle: "black",
    navigationBarTitleText: "PetCare",
    navigationStyle: "custom",
    "app-plus": {
      titleNView: false,
    },
  },
});
