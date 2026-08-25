import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(resolve(import.meta.dirname, "edit.vue"), "utf8");

describe("profile edit interaction boundary", () => {
  it("uses one busy owner across load, avatar, save, code, and bind actions", () => {
    expect(source).toContain(
      'const busy = ref<"load" | "avatar" | "save" | "code" | "bind" | null>',
    );
    expect(source).toContain(':disabled="busy !== null"');
    expect(source).toContain(':aria-disabled="busy !== null"');
    expect(source).toContain(':disabled="busy !== null || countdown > 0"');
    expect(source).toMatch(
      /function chooseImage\(\)[\s\S]*busy\.value = "avatar";[\s\S]*uni\.chooseImage/,
    );
  });

  it("shows a retryable initial error instead of an empty profile", () => {
    expect(source).toContain('const loadError = ref("")');
    expect(source).toContain('v-if="loadError && !profile"');
    expect(source).toContain('@click="loadProfile"');
  });

  it("uses a native disabled button for the H5 and App avatar fallback", () => {
    const fallback = source.match(/<!-- #ifndef MP-WEIXIN -->([\s\S]*?)<!-- #endif -->/)?.[1];

    expect(fallback).toContain("<button");
    expect(fallback).toContain(':disabled="busy !== null"');
    expect(fallback).toContain(':aria-disabled="busy !== null"');
    expect(fallback).toContain('@click="chooseImage"');
  });
});
