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
    `,?\\r?\\n\\s{4}\\{\\r?\\n\\s{6}"root"\\s*:\\s*"${escapedRoot}"\\s*,[\\s\\S]*?\\r?\\n\\s{4}\\}(?=\\r?\\n\\s{2}\\]\\r?\\n\\})`,
    "u",
  );
  const cleaned = source.replace(generatedBlock, "");

  if (cleaned === source) {
    throw new Error(`Cannot safely remove stale ${root} routes from pages.json`);
  }

  return cleaned;
}

/** Builds the route manifest with commercial subpackages absent by default. */
export function createMiniappPagesConfig(commercialServicesEnabled = false) {
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
      ...(commercialServicesEnabled
        ? [
            {
              root: "pages-bounty",
              pages: ["index", "form"].map(createPage),
            },
          ]
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
