import authConfig from "./auth/index.config";
import bountyConfig from "./bounty/index.config";
import indexConfig from "./index/index.config";

it("uses custom navigation only on the redesigned entry pages", () => {
  expect(authConfig.navigationStyle).toBe("custom");
  expect(indexConfig.navigationStyle).toBe("custom");
  expect(bountyConfig).not.toHaveProperty("navigationStyle", "custom");
});
