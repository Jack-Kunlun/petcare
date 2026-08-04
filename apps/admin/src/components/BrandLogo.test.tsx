// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { BrandLogo } from "./BrandLogo";

describe("BrandLogo", () => {
  afterEach(cleanup);

  it.each([
    ["color", "/brand/petcare-symbol-color.svg"],
    ["reverse", "/brand/petcare-symbol-reverse.svg"],
    ["stacked-color", "/brand/petcare-logo-stacked-color.svg"],
    ["stacked-reverse", "/brand/petcare-logo-stacked-reverse.svg"],
  ] as const)("renders the %s variant from its brand asset", (variant, source) => {
    render(<BrandLogo variant={variant} />);

    expect(screen.getByRole("img", { name: "PetCare" })).toHaveAttribute("src", source);
  });

  it("uses the default, decorative, and custom accessible labels", () => {
    const { rerender } = render(<BrandLogo variant="color" />);

    expect(screen.getByRole("img", { name: "PetCare" })).toHaveAttribute("alt", "PetCare");

    rerender(<BrandLogo variant="color" label="" />);

    expect(screen.getByAltText("")).toHaveAttribute("alt", "");

    rerender(<BrandLogo variant="color" label="PetCare Admin" />);

    expect(screen.getByRole("img", { name: "PetCare Admin" })).toHaveAttribute(
      "alt",
      "PetCare Admin",
    );
  });

  it("preserves object containment and forwards className", () => {
    render(<BrandLogo variant="color" className="h-8 w-8" />);

    expect(screen.getByRole("img", { name: "PetCare" })).toHaveClass(
      "object-contain",
      "h-8",
      "w-8",
    );
  });

  it("uses synchronous decoding for crisp first paint", () => {
    render(<BrandLogo variant="color" />);

    expect(screen.getByRole("img", { name: "PetCare" })).toHaveAttribute("decoding", "sync");
  });

  it("provides a 2K raster source while keeping the SVG fallback", () => {
    render(<BrandLogo variant="stacked-reverse" />);

    expect(screen.getByRole("img", { name: "PetCare" })).toHaveAttribute(
      "src",
      "/brand/petcare-logo-stacked-reverse.svg",
    );
    expect(screen.getByRole("img", { name: "PetCare" }).previousElementSibling).toHaveAttribute(
      "srcset",
      "/brand/petcare-logo-stacked-reverse@2x.png",
    );
  });
});
