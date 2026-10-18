import { defineUniPages } from "@uni-helper/vite-plugin-uni-pages";

const subPageStyle = {
  navigationBarTextStyle: "black",
  navigationStyle: "custom",
} as const;

const createPage = (path: string) => ({ path, style: subPageStyle });

/** Removes one stale generated subpackage while preserving the surrounding JSONC source. */
export function removeGeneratedSubPackage(source: string, root: string): string {
  if (!source.includes(`"${root}"`)) {
    return source;
  }

  const escapedRoot = root.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
  const generatedBlock = new RegExp(
    `(,?\\r?\\n {4}\\{\\r?\\n {6}"root"\\s*:\\s*"${escapedRoot}"\\s*,[\\s\\S]*?\\r?\\n {4}\\})(,?)(?=\\r?\\n {4}\\{|\\r?\\n {2}\\])`,
    "u",
  );
  const cleaned = source.replace(generatedBlock, (_match, block: string, comma: string) =>
    block.trimStart().startsWith(",") ? comma : "",
  );

  if (cleaned === source) {
    throw new Error(`Cannot safely remove stale ${root} routes from pages.json`);
  }

  return cleaned;
}

/** Builds the route manifest with commercial subpackages absent by default. */
export function createMiniappPagesConfig(
  commercialServicesEnabled = false,
  qualificationWorkflowEnabled = false,
) {
  return defineUniPages({
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
          "income/index",
          "social/favorites",
          "social/follows",
          "social/reviews",
          "social/review-form",
          "discover/service",
          "discover/caregiver",
          "discover/store",
          "discover/creator",
          "coupons/index",
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
          "about/index",
          "chat/index",
        ].map(createPage),
      },
      ...(commercialServicesEnabled
        ? [
            {
              root: "pages-bounty",
              pages: ["index", "form", "detail", "map", "success"].map(createPage),
            },
            {
              root: "pages-orders",
              pages: ["index", "detail", "monitor"].map(createPage),
            },
          ]
        : []),
      ...(qualificationWorkflowEnabled
        ? [{ root: "pages-qualification", pages: ["index"].map(createPage) }]
        : []),
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
}

export default createMiniappPagesConfig();
