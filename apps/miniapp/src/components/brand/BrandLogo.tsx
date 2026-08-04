import { Image } from "@tarojs/components";
import logoStacked from "../../assets/brand/petcare-logo-stacked-color-780h.png";
import logoSymbol from "../../assets/brand/petcare-symbol-color-1024.png";

interface BrandLogoProps {
  variant?: "stacked" | "symbol";
  label?: string;
}

export default function BrandLogo({ variant = "stacked", label = "PetCare 宠伴" }: BrandLogoProps) {
  if (variant === "symbol") {
    return (
      <Image
        className="h-logo-sm w-logo-sm object-contain"
        src={logoSymbol}
        mode="aspectFit"
        ariaLabel={label}
      />
    );
  }

  return (
    <Image
      className="h-logo-lockup w-logo-lockup object-contain"
      src={logoStacked}
      mode="aspectFit"
      ariaLabel={label}
    />
  );
}
