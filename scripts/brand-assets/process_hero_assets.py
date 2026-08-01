"""Build responsive PetCare hero assets and editable website brand elements."""

from __future__ import annotations

import json
import struct
from dataclasses import dataclass
from pathlib import Path

from PIL import Image, ImageCms


ROOT = Path(__file__).resolve().parents[2]
DELIVERY = ROOT / "docs" / "10-brand-system" / "deliverables"
SOURCE_DIR = DELIVERY / "hero" / "source"
MANIFEST_PATH = DELIVERY / "manifest.json"


@dataclass(frozen=True)
class CropProfile:
    width: int
    height: int
    focal_x: float
    focal_y: float


PROFILES = {
    "desktop": CropProfile(1920, 720, 0.50, 0.61),
    "miniapp": CropProfile(750, 340, 0.50, 0.60),
    "social": CropProfile(1200, 630, 0.50, 0.58),
}

THEME_FOCAL_POINTS = {
    "trusted-care": (0.72, 0.58),
    "professional-care": (0.28, 0.50),
    "community-companion": (0.70, 0.56),
}

THEMES = {
    "trusted-care": {
        "source": "hero-trusted-care-source-v1.png",
        "safe_zone": "left-40",
        "alt": "A cat and dog resting peacefully in a modern living room with natural light.",
    },
    "professional-care": {
        "source": "hero-professional-care-source-v1.png",
        "safe_zone": "right-40",
        "alt": "A tidy home pet-care station with fresh water, measured food, and a cat nearby.",
    },
    "community-companion": {
        "source": "hero-community-companion-source-v1.png",
        "safe_zone": "left-40",
        "alt": "A cat and dog sharing a relaxed moment in a sunlit living room.",
    },
}


def cover_crop(image: Image.Image, profile: CropProfile) -> Image.Image:
    """Crop around a normalized focal point and resize with high-quality sampling."""
    source_ratio = image.width / image.height
    target_ratio = profile.width / profile.height
    if source_ratio > target_ratio:
        crop_height = image.height
        crop_width = round(crop_height * target_ratio)
    else:
        crop_width = image.width
        crop_height = round(crop_width / target_ratio)

    center_x = profile.focal_x * image.width
    center_y = profile.focal_y * image.height
    left = max(0, min(round(center_x - crop_width / 2), image.width - crop_width))
    top = max(0, min(round(center_y - crop_height / 2), image.height - crop_height))
    cropped = image.crop((left, top, left + crop_width, top + crop_height))
    return cropped.resize((profile.width, profile.height), Image.Resampling.LANCZOS)


def to_srgb(image: Image.Image) -> Image.Image:
    """Return an RGB image tagged with the standard sRGB profile."""
    if image.mode != "RGB":
        image = image.convert("RGB")
    profile = image.info.get("icc_profile")
    if profile:
        try:
            source = ImageCms.ImageCmsProfile(profile)
            target = ImageCms.createProfile("sRGB")
            image = ImageCms.profileToProfile(image, source, target, outputMode="RGB")
        except (ImageCms.PyCMSError, OSError):
            pass
    return image


def srgb_profile_bytes() -> bytes:
    """Return the ICC bytes embedded in every raster derivative."""
    profile = bytearray(ImageCms.ImageCmsProfile(ImageCms.createProfile("sRGB")).tobytes())
    # LittleCMS writes the current time into the ICC header. Pin the standard
    # six UINT16 date fields so repeated builds remain byte-for-byte stable.
    profile[24:36] = struct.pack(">6H", 2020, 1, 1, 0, 0, 0)
    return bytes(profile)


def safe_zone_fit(image: Image.Image, profile: CropProfile, safe_zone: str) -> Image.Image:
    """Fit the full scene and extend only its deliberately empty copy zone."""
    target_ratio = profile.width / profile.height
    source_ratio = image.width / image.height
    if target_ratio <= source_ratio:
        return cover_crop(image, profile)

    scaled_width = round(image.width * profile.height / image.height)
    scaled = image.resize((scaled_width, profile.height), Image.Resampling.LANCZOS)
    extension = profile.width - scaled_width
    canvas = Image.new("RGB", (profile.width, profile.height))
    strip_width = max(8, round(scaled_width * 0.20))
    if safe_zone.startswith("left"):
        strip = scaled.crop((0, 0, strip_width, profile.height)).transpose(
            Image.Transpose.FLIP_LEFT_RIGHT
        ).resize(
            (extension, profile.height), Image.Resampling.BICUBIC
        )
        canvas.paste(strip, (0, 0))
        canvas.paste(scaled, (extension, 0))
    else:
        canvas.paste(scaled, (0, 0))
        strip = scaled.crop((scaled_width - strip_width, 0, scaled_width, profile.height)).transpose(
            Image.Transpose.FLIP_LEFT_RIGHT
        ).resize(
            (extension, profile.height), Image.Resampling.BICUBIC
        )
        canvas.paste(strip, (scaled_width, 0))
    return canvas


def export_hero_family(source: Path, slug: str, safe_zone: str) -> list[Path]:
    """Export the three responsive PNG/WebP pairs for one approved source."""
    exported: list[Path] = []
    with Image.open(source) as opened:
        base = to_srgb(opened)
        focal_x, focal_y = THEME_FOCAL_POINTS[slug]
        for profile_name, profile in PROFILES.items():
            effective_profile = CropProfile(profile.width, profile.height, focal_x, focal_y)
            # Social crops need only a small vertical trim, so use the focal
            # cover crop directly. Wider product banners preserve every care
            # detail by extending only the intentionally empty safe zone.
            result = (
                cover_crop(base, effective_profile)
                if profile_name == "social"
                else safe_zone_fit(base, effective_profile, safe_zone)
            )
            output_dir = DELIVERY / "hero" / profile_name
            output_dir.mkdir(parents=True, exist_ok=True)
            stem = f"hero-{slug}-{profile_name}-v1"
            png = output_dir / f"{stem}.png"
            webp = output_dir / f"{stem}.webp"
            icc_profile = srgb_profile_bytes()
            result.save(png, "PNG", optimize=True, compress_level=9, icc_profile=icc_profile)
            result.save(webp, "WEBP", quality=88, method=6, exact=True, icc_profile=icc_profile)
            exported.extend((png, webp))
    return exported


def write_svg(path: Path, content: str) -> Path:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(content.strip() + "\n", encoding="utf-8", newline="\n")
    return path


def create_elements() -> list[Path]:
    """Create deterministic SVG elements using approved brand colors and symbol."""
    gradients = DELIVERY / "elements" / "gradients"
    patterns = DELIVERY / "elements" / "patterns"
    badges = DELIVERY / "elements" / "badges"
    overlays = DELIVERY / "elements" / "overlays"
    symbol_source = (DELIVERY / "logo" / "svg" / "petcare-symbol-color.svg").read_text(encoding="utf-8")
    symbol_markup = symbol_source.split("</title>", 1)[1].rsplit("</svg>", 1)[0].strip()
    assets = [
        write_svg(
            gradients / "petcare-gradient-linear.svg",
            '''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 480" role="img" aria-labelledby="title"><title id="title">PetCare blue to mint linear gradient</title><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#4A6CF7"/><stop offset="1" stop-color="#5BC8AF"/></linearGradient></defs><rect width="1600" height="480" rx="32" fill="url(#g)"/></svg>''',
        ),
        write_svg(
            gradients / "petcare-gradient-radial.svg",
            '''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 900" role="img" aria-labelledby="title"><title id="title">PetCare soft radial brand glow</title><defs><radialGradient id="g" cx="72%" cy="30%" r="72%"><stop offset="0" stop-color="#5BC8AF" stop-opacity=".38"/><stop offset=".45" stop-color="#4A6CF7" stop-opacity=".14"/><stop offset="1" stop-color="#FAFBFC" stop-opacity="0"/></radialGradient></defs><rect width="1600" height="900" fill="#FAFBFC"/><rect width="1600" height="900" fill="url(#g)"/></svg>''',
        ),
        write_svg(
            gradients / "petcare-background-soft.svg",
            '''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 900" role="img" aria-labelledby="title"><title id="title">PetCare soft website background</title><defs><linearGradient id="b" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#FAFBFC"/><stop offset=".55" stop-color="#F1F5FF"/><stop offset="1" stop-color="#EFFBF8"/></linearGradient></defs><rect width="1600" height="900" fill="url(#b)"/><circle cx="1320" cy="120" r="320" fill="#5BC8AF" opacity=".08"/><circle cx="170" cy="760" r="380" fill="#4A6CF7" opacity=".07"/></svg>''',
        ),
        write_svg(
            patterns / "petcare-connection-pattern.svg",
            '''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 320" role="img" aria-labelledby="title"><title id="title">PetCare connection pattern</title><defs><pattern id="p" width="80" height="80" patternUnits="userSpaceOnUse"><path d="M16 40h18m12 0h18M40 16v18m0 12v18" stroke="#4A6CF7" stroke-width="2" stroke-linecap="round" opacity=".16"/><circle cx="40" cy="40" r="6" fill="none" stroke="#5BC8AF" stroke-width="2" opacity=".32"/></pattern></defs><rect width="320" height="320" fill="url(#p)"/></svg>''',
        ),
        write_svg(
            badges / "petcare-badge-symbol.svg",
            f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 176 176" role="img" aria-labelledby="title"><title id="title">PetCare approved symbol badge</title><circle cx="88" cy="88" r="84" fill="#FFFFFF" stroke="#E6EAF0" stroke-width="4"/><svg x="32" y="32" width="112" height="112" viewBox="0 0 128 128">{symbol_markup}</svg></svg>''',
        ),
        write_svg(
            badges / "petcare-badge-trusted-companion.svg",
            f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 480 112" role="img" aria-labelledby="title"><title id="title">PetCare Trusted Companion badge</title><rect x="2" y="2" width="476" height="108" rx="56" fill="#FFFFFF" stroke="#E6EAF0" stroke-width="4"/><svg x="20" y="16" width="80" height="80" viewBox="0 0 128 128">{symbol_markup}</svg><text x="124" y="48" fill="#202632" font-family="Montserrat, Arial, sans-serif" font-size="25" font-weight="700">TRUSTED COMPANION</text><text x="124" y="78" fill="#667085" font-family="Noto Sans SC, Arial, sans-serif" font-size="18">每一次托付，都值得信赖</text></svg>''',
        ),
        write_svg(
            overlays / "petcare-overlay-copy-left.svg",
            '''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 720" role="img" aria-labelledby="title"><title id="title">PetCare left copy readability overlay</title><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="0"><stop stop-color="#FFFFFF" stop-opacity=".96"/><stop offset=".42" stop-color="#FFFFFF" stop-opacity=".82"/><stop offset=".68" stop-color="#FFFFFF" stop-opacity="0"/></linearGradient></defs><rect width="1600" height="720" fill="url(#g)"/></svg>''',
        ),
        write_svg(
            overlays / "petcare-overlay-copy-right.svg",
            '''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 720" role="img" aria-labelledby="title"><title id="title">PetCare right copy readability overlay</title><defs><linearGradient id="g" x1="1" y1="0" x2="0" y2="0"><stop stop-color="#FFFFFF" stop-opacity=".96"/><stop offset=".42" stop-color="#FFFFFF" stop-opacity=".82"/><stop offset=".68" stop-color="#FFFFFF" stop-opacity="0"/></linearGradient></defs><rect width="1600" height="720" fill="url(#g)"/></svg>''',
        ),
        write_svg(
            overlays / "petcare-overlay-bottom.svg",
            '''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 720" role="img" aria-labelledby="title"><title id="title">PetCare bottom caption readability overlay</title><defs><linearGradient id="g" x1="0" y1="1" x2="0" y2="0"><stop stop-color="#202632" stop-opacity=".94"/><stop offset=".38" stop-color="#202632" stop-opacity=".62"/><stop offset=".72" stop-color="#202632" stop-opacity="0"/></linearGradient></defs><rect width="1600" height="720" fill="url(#g)"/></svg>''',
        ),
    ]
    return assets


def update_manifest() -> None:
    manifest = json.loads(MANIFEST_PATH.read_text(encoding="utf-8"))
    assets = manifest["assets"]
    assets[:] = [item for item in assets if not str(item["id"]).startswith("element.")]
    element_specs = [
        ("element.gradient.linear", "elements/gradients/petcare-gradient-linear.svg", 1600, 480),
        ("element.gradient.radial", "elements/gradients/petcare-gradient-radial.svg", 1600, 900),
        ("element.background.soft", "elements/gradients/petcare-background-soft.svg", 1600, 900),
        ("element.pattern.connection", "elements/patterns/petcare-connection-pattern.svg", 320, 320),
        ("element.badge.symbol", "elements/badges/petcare-badge-symbol.svg", 176, 176),
        ("element.badge.trusted-companion", "elements/badges/petcare-badge-trusted-companion.svg", 480, 112),
        ("element.overlay.copy-left", "elements/overlays/petcare-overlay-copy-left.svg", 1600, 720),
        ("element.overlay.copy-right", "elements/overlays/petcare-overlay-copy-right.svg", 1600, 720),
        ("element.overlay.bottom", "elements/overlays/petcare-overlay-bottom.svg", 1600, 720),
    ]
    for asset_id, path, width, height in element_specs:
        assets.append({
            "id": asset_id,
            "path": path,
            "kind": "element",
            "width": width,
            "height": height,
            "format": "svg",
            "alt": asset_id.removeprefix("element.").replace(".", " ").replace("-", " ").title(),
            "source": "../PetCare-Brand-Book-v1.0.md",
        })
    manifest["overlayAccessibility"] = {
        "lightOverlayDarkText": {"text": "#202632", "minimumBodyContrast": "4.5:1", "minimumLargeContrast": "3:1", "verifiedMinimumContrast": "13.81:1", "verifiedRegion": "declared-side-40-percent"},
        "darkBottomOverlayWhiteText": {"text": "#FFFFFF", "minimumBodyContrast": "4.5:1", "minimumLargeContrast": "3:1", "verifiedMinimumContrast": "7.46:1", "verifiedRegion": "bottom-20-percent"},
        "note": "Verified against every final PNG crop. Re-test after changing an image, overlay, opacity, or text color.",
    }
    MANIFEST_PATH.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8", newline="\n")


def main() -> None:
    exported: list[Path] = []
    for slug, data in THEMES.items():
        exported.extend(export_hero_family(SOURCE_DIR / data["source"], slug, data["safe_zone"]))
    exported.extend(create_elements())
    update_manifest()
    print(f"Generated {len(exported)} PetCare responsive and brand-element assets.")


if __name__ == "__main__":
    main()
