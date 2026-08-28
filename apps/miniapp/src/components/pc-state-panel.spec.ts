import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(resolve(import.meta.dirname, "PcStatePanel.vue"), "utf8");

describe("pc state panel contract", () => {
  it("covers the shared page states and recovery slots", () => {
    expect(source).toContain(
      'type PcState = "loading" | "empty" | "error" | "unavailable" | "unauthenticated"',
    );
    expect(source).toContain('<slot name="illustration">');
    expect(source).toContain('<slot name="actions">');
    expect(source).toContain("primaryLabel");
    expect(source).toContain("secondaryLabel");
    expect(source).toContain("!isLoading.value");
  });

  it("uses the shared button hierarchy and expressive panel visuals", () => {
    expect(source).toContain('import PcButton from "./PcButton.vue"');
    expect(source).toContain('variant="ghost"');
    expect(source).toContain("pc-state-panel__icon");
    expect(source).toContain('aria-live="polite"');
  });
});
