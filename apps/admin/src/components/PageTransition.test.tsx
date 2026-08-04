// @vitest-environment jsdom

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
  });
});
