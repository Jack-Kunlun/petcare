import type { JSX } from "react";

type BrandLogoVariant = "color" | "reverse" | "stacked-color" | "stacked-reverse";

interface BrandLogoProps {
  variant: BrandLogoVariant;
  className?: string;
  label?: string;
}

const sources = {
  color: "/brand/petcare-symbol-color.svg",
  reverse: "/brand/petcare-symbol-reverse.svg",
  "stacked-color": "/brand/petcare-logo-stacked-color.svg",
  "stacked-reverse": "/brand/petcare-logo-stacked-reverse.svg",
} as const;

/** Renders one of the public PetCare logo assets with an accessible label. */
export function BrandLogo({ variant, className, label = "PetCare" }: BrandLogoProps): JSX.Element {
  return (
    <img
      src={sources[variant]}
      alt={label}
      decoding="sync"
      className={`object-contain${className ? ` ${className}` : ""}`}
    />
  );
}
