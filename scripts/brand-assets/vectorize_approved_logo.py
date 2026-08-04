"""Guard the authored PetCare curved SVG masters against accidental regeneration.

The approved raster remains visual provenance, but the production SVGs are authored
Bezier-path masters. They must not be rebuilt as one rectangle per source pixel.
"""

from __future__ import annotations

from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
SVG_DIR = ROOT / "docs" / "10-brand-system" / "deliverables" / "logo" / "svg"
VARIANTS = ("color", "dark", "monochrome", "reverse")


def verify_curved_masters() -> None:
    """Fail if a required authored master is missing or was replaced by pixel runs."""
    paths = [
        SVG_DIR / f"petcare-{family}-{variant}.svg"
        for family in ("logo-stacked", "symbol")
        for variant in VARIANTS
    ]
    errors: list[str] = []
    for path in paths:
        if not path.is_file():
            errors.append(f"missing SVG master: {path}")
            continue
        source = path.read_text(encoding="utf-8")
        if "approved-curves-v1" not in source:
            errors.append(f"curved-master metadata missing: {path}")
        if "shape-rendering=\"crispEdges\"" in source or "approved-pixel-runs" in source:
            errors.append(f"pixel-run SVG is not allowed: {path}")
        if " C " not in source and "C" not in source:
            errors.append(f"Bezier curves missing: {path}")
    if errors:
        raise RuntimeError("\n".join(errors))
    print("Verified 8 authored PetCare curved SVG masters.")


if __name__ == "__main__":
    verify_curved_masters()
