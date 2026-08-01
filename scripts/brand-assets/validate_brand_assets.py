"""Validate the complete PetCare brand asset delivery package."""

from __future__ import annotations

import json
import re
import sys
import xml.etree.ElementTree as ET
from pathlib import Path
from typing import Any

from PIL import Image


REPO_ROOT = Path(__file__).resolve().parents[2]
DELIVERY_ROOT = REPO_ROOT / "docs" / "10-brand-system" / "deliverables"
RASTER_FORMATS = {"png", "webp", "ico"}
EXPECTED_ICC_DATE = bytes.fromhex("07e400010001000000000000")  # 2020-01-01 00:00:00


def validate_raster(path: Path, expected_width: int, expected_height: int) -> list[str]:
    errors: list[str] = []
    try:
        with Image.open(path) as image:
            if image.size != (expected_width, expected_height):
                errors.append(
                    f"{path}: expected {expected_width}x{expected_height}, got {image.width}x{image.height}"
                )
            expected_format = path.suffix.removeprefix(".").upper()
            if expected_format == "JPG":
                expected_format = "JPEG"
            if image.format != expected_format:
                errors.append(f"{path}: extension/format mismatch ({image.format})")
    except (OSError, ValueError) as error:
        errors.append(f"{path}: unreadable raster ({error})")
    return errors


def validate_svg(path: Path) -> list[str]:
    errors: list[str] = []
    try:
        source = path.read_text(encoding="utf-8")
        root = ET.fromstring(source)
    except (OSError, UnicodeError, ET.ParseError) as error:
        return [f"{path}: invalid SVG XML ({error})"]
    if root.tag.rsplit("}", 1)[-1] != "svg":
        errors.append(f"{path}: root element is not svg")
    if not root.attrib.get("viewBox"):
        errors.append(f"{path}: missing viewBox")
    for element in root.iter():
        for attribute, value in element.attrib.items():
            local_attribute = attribute.rsplit("}", 1)[-1]
            if local_attribute == "href" and value and not value.startswith("#"):
                errors.append(f"{path}: external SVG dependency is not allowed ({value})")
            if isinstance(value, str) and ("http://" in value or "https://" in value or "data:" in value):
                errors.append(f"{path}: remote or embedded dependency is not allowed")
        for css_text in (element.text, element.tail):
            if not css_text:
                continue
            if "@import" in css_text.lower():
                errors.append(f"{path}: CSS @import is not allowed")
            for match in re.findall(r"url\(\s*['\"]?([^)'\"\s]+)", css_text, flags=re.IGNORECASE):
                if not match.startswith("#"):
                    errors.append(f"{path}: external CSS dependency is not allowed ({match})")
    return errors


def _resolve_reference(root: Path, value: str) -> Path:
    return (root / value).resolve()


def _validate_transparent_corners(path: Path) -> list[str]:
    errors: list[str] = []
    try:
        with Image.open(path) as image:
            if image.mode not in {"RGBA", "LA", "PA"} and "transparency" not in image.info:
                return [f"{path}: Symbol raster lacks alpha transparency"]
            rgba = image.convert("RGBA")
            corners = [rgba.getpixel((0, 0))[3], rgba.getpixel((rgba.width - 1, 0))[3], rgba.getpixel((0, rgba.height - 1))[3], rgba.getpixel((rgba.width - 1, rgba.height - 1))[3]]
            if any(alpha != 0 for alpha in corners):
                errors.append(f"{path}: Symbol raster corners must be fully transparent")
    except OSError as error:
        errors.append(f"{path}: cannot inspect alpha ({error})")
    return errors


def validate_manifest(root: Path) -> list[str]:
    errors: list[str] = []
    manifest_path = root / "manifest.json"
    try:
        manifest: Any = json.loads(manifest_path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as error:
        return [f"{manifest_path}: invalid manifest ({error})"]

    if not isinstance(manifest, dict):
        return [f"{manifest_path}: manifest root must be an object"]

    assets = manifest.get("assets")
    if not isinstance(assets, list):
        return [f"{manifest_path}: assets must be a list"]
    ids = [asset.get("id") for asset in assets if isinstance(asset, dict)]
    duplicates = sorted({asset_id for asset_id in ids if ids.count(asset_id) > 1})
    if duplicates:
        errors.append(f"{manifest_path}: duplicate asset IDs: {', '.join(duplicates)}")

    for asset in assets:
        if not isinstance(asset, dict):
            errors.append(f"{manifest_path}: asset entry must be an object")
            continue
        asset_id = str(asset.get("id", "<missing-id>"))
        relative_path = asset.get("path")
        if not isinstance(relative_path, str):
            errors.append(f"{asset_id}: missing path")
            continue
        path = _resolve_reference(root, relative_path)
        if not path.is_file():
            errors.append(f"{asset_id}: missing asset {relative_path}")
            continue
        declared_format = str(asset.get("format", "")).lower()
        if path.suffix.lower() != f".{declared_format}":
            errors.append(f"{asset_id}: declared format does not match path suffix")
        width = asset.get("width")
        height = asset.get("height")
        if not isinstance(width, int) or not isinstance(height, int) or width <= 0 or height <= 0:
            errors.append(f"{asset_id}: invalid declared dimensions")
            continue
        if declared_format in RASTER_FORMATS:
            errors.extend(validate_raster(path, width, height))
            if asset_id.startswith("hero."):
                try:
                    with Image.open(path) as image:
                        profile = image.info.get("icc_profile")
                        if not profile:
                            errors.append(f"{asset_id}: Hero raster lacks explicit sRGB ICC profile")
                        elif len(profile) < 36 or profile[24:36] != EXPECTED_ICC_DATE:
                            errors.append(f"{asset_id}: Hero ICC metadata is not deterministic")
                except OSError:
                    pass
            if asset_id.startswith("logo.symbol.color.") and declared_format == "png":
                errors.extend(_validate_transparent_corners(path))
        elif declared_format == "svg":
            errors.extend(validate_svg(path))
        else:
            errors.append(f"{asset_id}: unsupported declared format {declared_format}")

        source = asset.get("source")
        if isinstance(source, str) and not _resolve_reference(root, source).is_file():
            errors.append(f"{asset_id}: broken source reference {source}")

    provenance = manifest.get("sourceProvenance")
    if not isinstance(provenance, list):
        errors.append(f"{manifest_path}: sourceProvenance must be a list")
        provenance = []
    for index, source in enumerate(provenance):
        if not isinstance(source, dict):
            errors.append(f"sourceProvenance[{index}]: entry must be an object")
            continue
        source_path = source.get("sourcePath")
        if not isinstance(source_path, str) or not _resolve_reference(root, source_path).is_file():
            errors.append(f"sourceProvenance[{index}]: broken sourcePath {source_path}")
        if not str(source.get("prompt", "")).strip():
            errors.append(f"sourceProvenance[{index}]: missing prompt for {source.get('id')}")

    approved = manifest.get("approvedLogoArtwork", {})
    approved_path = approved.get("path") if isinstance(approved, dict) else None
    if not isinstance(approved_path, str) or not _resolve_reference(root, approved_path).is_file():
        errors.append("approvedLogoArtwork.path is missing or broken")
    return errors


def main() -> int:
    errors = validate_manifest(DELIVERY_ROOT)
    print(f"Validated PetCare brand assets: {len(errors)} errors")
    for error in errors:
        print(f"- {error}")
    return 1 if errors else 0


if __name__ == "__main__":
    sys.exit(main())
