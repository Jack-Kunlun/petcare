"""Export PetCare Logo raster assets from the approved actual PNG artwork.

The approved PNG is the sole visual authority. Pillow 12.2.0 is the only
rasterizer used by this script, so browser or SVG renderer differences cannot
reinterpret the approved Logo.
"""

from __future__ import annotations

import io
import shutil
import struct
from pathlib import Path

from PIL import Image


STACKED_HEIGHTS = (260, 520, 780)
STACKED_VARIANTS = ("color", "dark", "monochrome", "reverse")
SYMBOL_SIZES = (16, 20, 24, 28, 32, 48, 64, 128, 256, 512, 1024)
FAVICON_SIZES = (16, 32, 48)
APP_ICON_SIZES = (32, 48, 64, 96, 128, 144, 180, 192, 512, 1024)
SYMBOL_CROP = (79, 9, 250, 180)
FLAT_COLORS = {
    "dark": (7, 26, 82),
    "monochrome": (115, 115, 115),
    "reverse": (255, 255, 255),
}


def _save_png(image: Image.Image, output_path: Path) -> None:
    output_path.parent.mkdir(parents=True, exist_ok=True)
    image.save(output_path, format="PNG", optimize=True, compress_level=9)


def _flat_variant(image: Image.Image, rgb: tuple[int, int, int]) -> Image.Image:
    result = Image.new("RGBA", image.size, (*rgb, 0))
    result.putalpha(image.getchannel("A"))
    return result


def _resize(image: Image.Image, size: tuple[int, int]) -> Image.Image:
    if image.size == size:
        return image.copy()
    return image.resize(size, Image.Resampling.LANCZOS)


def _square_symbol(master: Image.Image) -> Image.Image:
    """Return the approved Symbol crop without inventing new geometry."""
    return master.crop(SYMBOL_CROP)


def write_ico(source: Image.Image, output_path: Path, sizes: tuple[int, ...]) -> None:
    """Write a deterministic multi-resolution PNG-backed ICO."""
    frames: list[tuple[int, bytes]] = []
    for size in sizes:
        frame = _resize(source, (size, size))
        encoded = io.BytesIO()
        frame.save(encoded, format="PNG", optimize=True, compress_level=9)
        frames.append((size, encoded.getvalue()))

    header = struct.pack("<HHH", 0, 1, len(frames))
    offset = len(header) + (16 * len(frames))
    entries: list[bytes] = []
    payloads: list[bytes] = []
    for size, payload in frames:
        encoded_size = 0 if size == 256 else size
        entries.append(
            struct.pack(
                "<BBBBHHII",
                encoded_size,
                encoded_size,
                0,
                0,
                1,
                32,
                len(payload),
                offset,
            )
        )
        payloads.append(payload)
        offset += len(payload)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_bytes(header + b"".join(entries) + b"".join(payloads))


def export_logo_suite(repo_root: Path) -> list[Path]:
    """Export all Logo raster derivatives from the approved actual PNG."""
    deliverables = repo_root / "docs" / "10-brand-system" / "deliverables" / "logo"
    png_directory = deliverables / "png"
    svg_directory = deliverables / "svg"
    favicon_directory = deliverables / "favicon"
    app_icon_directory = deliverables / "app-icons"
    approved_master_path = png_directory / "petcare-logo-approved-actual-primary.png"
    outputs: list[Path] = []

    with Image.open(approved_master_path) as opened:
        approved_master = opened.convert("RGBA")
    symbol_master = _square_symbol(approved_master)

    stacked_images = {"color": approved_master}
    stacked_images.update(
        {name: _flat_variant(approved_master, rgb) for name, rgb in FLAT_COLORS.items()}
    )
    for variant in STACKED_VARIANTS:
        source = stacked_images[variant]
        for height in STACKED_HEIGHTS:
            width = round(source.width * height / source.height)
            output = png_directory / f"petcare-logo-stacked-{variant}-{height}h.png"
            if variant == "color" and height == approved_master.height:
                shutil.copyfile(approved_master_path, output)
            else:
                _save_png(_resize(source, (width, height)), output)
            outputs.append(output)

    for size in SYMBOL_SIZES:
        output = png_directory / f"petcare-symbol-color-{size}.png"
        _save_png(_resize(symbol_master, (size, size)), output)
        outputs.append(output)

    favicon_svg = favicon_directory / "petcare-favicon.svg"
    favicon_directory.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(svg_directory / "petcare-symbol-color.svg", favicon_svg)
    outputs.append(favicon_svg)
    for size in FAVICON_SIZES:
        output = favicon_directory / f"petcare-favicon-{size}.png"
        _save_png(_resize(symbol_master, (size, size)), output)
        outputs.append(output)
    favicon_ico = favicon_directory / "petcare-favicon.ico"
    write_ico(symbol_master, favicon_ico, FAVICON_SIZES)
    outputs.append(favicon_ico)

    for size in APP_ICON_SIZES:
        output = app_icon_directory / f"petcare-app-icon-{size}.png"
        _save_png(_resize(symbol_master, (size, size)), output)
        outputs.append(output)
    return outputs


if __name__ == "__main__":
    root = Path(__file__).resolve().parents[2]
    exported = export_logo_suite(root)
    print(f"Exported {len(exported)} approved-actual Logo assets.")
