import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(resolve(import.meta.dirname, "PcButton.vue"), "utf8");

describe("pc button contract", () => {
  it("keeps the native button boundary and shared action props", () => {
    expect(source).toContain("<button");
    expect(source).toContain("variant?: PcButtonVariant");
    expect(source).toContain("size?: PcButtonSize");
    expect(source).toContain("block?: boolean");
    expect(source).toContain("loading?: boolean");
    expect(source).toContain("ariaLabel?: string");
    expect(source).toContain("props.disabled || props.loading");
    expect(source).toContain(':disabled="isDisabled"');
    expect(source).toContain(':aria-disabled="isDisabled"');
    expect(source).toContain(':aria-busy="loading"');
  });

  it("exposes prefix, default, suffix, and click behavior", () => {
    expect(source).toContain('<slot name="prefix" />');
    expect(source).toContain("<slot />");
    expect(source).toContain('<slot name="suffix" />');
    expect(source).toContain('emit("click", event)');
    expect(source).toContain("background: #1d4ed8");
    expect(source).toContain("&--danger");
  });
});
