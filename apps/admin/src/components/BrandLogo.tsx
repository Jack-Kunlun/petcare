import type { JSX } from "react";
import stackedReverseLogoUrl from "../assets/brand/petcare-logo-stacked-reverse.svg";
import reverseSymbolUrl from "../assets/brand/petcare-symbol-reverse.svg";

type BrandLogoVariant = "reverse" | "stacked-reverse";

interface BrandLogoProps {
  variant: BrandLogoVariant;
  className?: string;
  label?: string;
}

const sources = {
  reverse: reverseSymbolUrl,
  "stacked-reverse": stackedReverseLogoUrl,
} as const satisfies Record<BrandLogoVariant, string>;

/** 渲染一个进入 Vite 构建流程的 PetCare 品牌标识。 */
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
