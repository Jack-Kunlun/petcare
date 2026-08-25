// @vitest-environment jsdom

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { PageTransition } from "./PageTransition";

describe("PageTransition", () => {
  afterEach(cleanup);

  it("preserves its child content and applies the shared page-enter animation", () => {
    render(
      <PageTransition className="custom-page-shell">
        <p>Settings content</p>
      </PageTransition>,
    );

    const child = screen.getByText("Settings content");
    const wrapper = child.parentElement;

    expect(wrapper).toHaveClass("animate-[pc-page-enter_220ms_ease-out_both]", "custom-page-shell");
    expect(wrapper).toContainElement(child);
    expect(wrapper?.className).not.toContain("transform");
    expect(wrapper?.className).not.toContain("translate");
  });

  it("keeps the shared page-enter keyframes free from transforms", () => {
    const styles = readFileSync(resolve(process.cwd(), "src/index.css"), "utf8");
    const pageEnterKeyframes = styles.slice(
      styles.indexOf("@keyframes pc-page-enter"),
      styles.indexOf("@keyframes pc-skeleton-shimmer"),
    );

    expect(pageEnterKeyframes).toContain("opacity");
    expect(pageEnterKeyframes).not.toContain("transform");
  });
});
