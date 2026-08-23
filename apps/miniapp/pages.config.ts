import { defineUniPages } from "@uni-helper/vite-plugin-uni-pages";
import { miniappDesignTokens } from "./src/config/design-tokens";

const { colors } = miniappDesignTokens;

export default defineUniPages({
  pages: [],
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
