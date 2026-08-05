// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import stackedReverseLogoUrl from "../assets/brand/petcare-logo-stacked-reverse.svg";
import colorSymbolUrl from "../assets/brand/petcare-symbol-color.svg";
import reverseSymbolUrl from "../assets/brand/petcare-symbol-reverse.svg";
import { BrandLogo } from "./BrandLogo";

describe("BrandLogo", () => {
  afterEach(cleanup);

  it.each([
    ["reverse", reverseSymbolUrl],
    ["stacked-reverse", stackedReverseLogoUrl],
  ] as const)("renders the %s variant from its imported asset", (variant, source) => {
    render(<BrandLogo variant={variant} />);

    expect(screen.getByRole("img", { name: "PetCare" })).toHaveAttribute("src", source);
  });

  it("renders the color variant from its imported asset", () => {
    render(<BrandLogo variant="color" label="PetCare color logo" />);

    expect(screen.getByRole("img", { name: "PetCare color logo" })).toHaveAttribute(
      "src",
      colorSymbolUrl,
    );
  });

  it("uses the default, decorative, and custom accessible labels", () => {
    const { rerender } = render(<BrandLogo variant="reverse" />);

    expect(screen.getByRole("img", { name: "PetCare" })).toHaveAttribute("alt", "PetCare");

    rerender(<BrandLogo variant="reverse" label="" />);

    expect(screen.getByAltText("")).toHaveAttribute("alt", "");

    rerender(<BrandLogo variant="reverse" label="PetCare Admin" />);

    expect(screen.getByRole("img", { name: "PetCare Admin" })).toHaveAttribute(
      "alt",
      "PetCare Admin",
    );
  });

  it("preserves object containment and forwards className", () => {
    render(<BrandLogo variant="reverse" className="h-8 w-8" />);

    expect(screen.getByRole("img", { name: "PetCare" })).toHaveClass(
      "object-contain",
      "h-8",
      "w-8",
    );
  });

  it("uses synchronous decoding for crisp first paint", () => {
    render(<BrandLogo variant="reverse" />);

    expect(screen.getByRole("img", { name: "PetCare" })).toHaveAttribute("decoding", "sync");
  });

  it("renders SVG directly without a raster source", () => {
    const view = render(<BrandLogo variant="stacked-reverse" />);

    expect(view.baseElement.querySelector("picture")).not.toBeInTheDocument();
    expect(view.baseElement.querySelector("source")).not.toBeInTheDocument();
  });
});
