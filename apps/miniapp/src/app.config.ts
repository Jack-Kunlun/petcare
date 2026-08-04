export default {
  pages: [
    "pages/index/index",
    "pages/bounty/index",
    "pages/community/index",
    "pages/messages/index",
    "pages/profile/index",
    "pages/auth/index",
  ],
  window: {
    backgroundTextStyle: "light",
    navigationBarBackgroundColor: "#F8FAFC",
    navigationBarTitleText: "PetCare宠伴",
    navigationBarTextStyle: "black",
  },
  tabBar: {
    custom: true,
    color: "#667085",
    selectedColor: "#4A6CF7",
    backgroundColor: "#FFFFFF",
    borderStyle: "white",
    list: [
      { pagePath: "pages/index/index", text: "首页" },
      { pagePath: "pages/bounty/index", text: "悬赏大厅" },
      { pagePath: "pages/community/index", text: "社区" },
      { pagePath: "pages/messages/index", text: "消息" },
      { pagePath: "pages/profile/index", text: "我的" },
    ],
  },
};
