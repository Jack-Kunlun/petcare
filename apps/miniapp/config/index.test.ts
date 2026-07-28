/** @jest-environment node */

jest.mock("@tarojs/cli", () => ({
  defineConfig: jest.fn((value: unknown) => value),
}));

jest.mock("weapp-tailwindcss/webpack", () => ({
  WeappTailwindcss: class WeappTailwindcss {},
}));

import config, { miniappCssEntry, weappTailwindcssOptions } from ".";

describe("Miniapp Tailwind build config", () => {
  it("keeps px output and registers both build targets", () => {
    const resolvedConfig = config as {
      mini?: {
        postcss?: { pxtransform?: { enable?: boolean } };
        webpackChain?: unknown;
      };
      h5?: { webpackChain?: unknown };
    };

    expect(weappTailwindcssOptions.cssOptions).toEqual({
      cssPreflight: false,
      rem2rpx: false,
      px2rpx: false,
    });
    expect(weappTailwindcssOptions.cssEntries).toEqual([miniappCssEntry]);
    expect(miniappCssEntry).toMatch(/src[\\/]app\.css$/);
    expect(weappTailwindcssOptions.generator).not.toBe(false);
    expect(weappTailwindcssOptions.tailwindcssBasedir).toMatch(/apps[\\/]miniapp$/);
    expect(resolvedConfig.mini?.postcss?.pxtransform?.enable).toBe(false);
    expect(resolvedConfig.mini?.webpackChain).toEqual(expect.any(Function));
    expect(resolvedConfig.h5?.webpackChain).toEqual(expect.any(Function));
  });
});
