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
      root: "pages-account",
      pages: [
        "pets/index",
        "pets/form",
        "pets/detail",
        "profile/info",
        "profile/edit",
        "account/settings",
        "account/cancel",
      ].map(createPage),
    },
    {
      root: "pages-content",
      pages: [
        "classroom/article",
        "community/article",
        "community/publish",
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
