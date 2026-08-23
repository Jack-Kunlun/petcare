import { defineUniPages } from "@uni-helper/vite-plugin-uni-pages";
import { miniappDesignTokens } from "./src/config/design-tokens";

const { colors } = miniappDesignTokens;
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
  ],
  globalStyle: {
    navigationBarTitleText: "PetCare",
  },
  tabBar: {
    color: colors.subtle,
    selectedColor: colors.brand,
    backgroundColor: colors.surface,
    borderStyle: "white",
    list: [
      { pagePath: "pages/index/index", text: "首页" },
      { pagePath: "pages/bounty/index", text: "悬赏" },
      { pagePath: "pages/community/index", text: "社区" },
      { pagePath: "pages/messages/index", text: "消息" },
      { pagePath: "pages/profile/index", text: "我的" },
    ],
  },
});
