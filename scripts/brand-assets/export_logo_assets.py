"""Render the committed PetCare SVG logo masters into browser and app assets.

This module deliberately uses only the Python standard library and an already-installed
Chromium-based browser.  It therefore adds no project dependency: Chromium is the SVG
rasterizer and its PNG screenshots retain the masters' transparent background.
"""

from __future__ import annotations

import os
import shutil
import io
import struct
import subprocess
import tempfile
from pathlib import Path


HORIZONTAL_HEIGHTS = (32, 64, 96)
SYMBOL_SIZES = (16, 20, 24, 28, 32, 48, 64, 128, 256, 512, 1024)
FAVICON_SIZES = (16, 32, 48)
APP_ICON_SIZES = (32, 48, 64, 96, 128, 144, 180, 192, 512, 1024)


def _browser_executable() -> str:
    """Return a supported local browser executable without downloading anything."""
    candidates = (
        os.environ.get("CHROME_PATH"),
        shutil.which("chrome"),
        shutil.which("msedge"),
        r"C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
        r"C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
    )
    for candidate in candidates:
        if candidate and Path(candidate).is_file():
            return candidate
    raise RuntimeError("Chrome or Edge is required to render the logo SVG assets.")


def _render_file(source_path: Path, output_path: Path, width: int, height: int) -> None:
    browser = _browser_executable()
    output_path.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix="petcare-logo-render-") as temporary_directory:
        page_path = Path(temporary_directory) / "render.html"
        page_path.write_text(
            "<!doctype html><html><head><style>"
            f"html,body,img{{margin:0;padding:0;width:{width}px;height:{height}px;overflow:hidden;}}"
            "img{display:block;object-fit:fill;}"
            "</style></head><body>"
            f'<img src="{source_path.resolve().as_uri()}" alt="" />'
            "</body></html>",
            encoding="utf-8",
        )
        command = [
            browser,
            "--headless=new",
            "--disable-gpu",
            "--hide-scrollbars",
            "--force-device-scale-factor=1",
            "--default-background-color=00000000",
            f"--window-size={width},{height}",
            f"--screenshot={output_path.resolve()}",
            page_path.as_uri(),
        ]
        subprocess.run(command, check=True, capture_output=True, text=True)


def render_svg(svg_path: Path, output_path: Path, width: int, height: int) -> None:
    """Rasterize an SVG master as a transparent PNG with exact dimensions."""
    if not svg_path.is_file():
        raise FileNotFoundError(svg_path)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    try:
        import cairosvg

        cairosvg.svg2png(
            url=str(svg_path),
            write_to=str(output_path),
            output_width=width,
            output_height=height,
        )
        return
    except (ImportError, OSError):
        pass
    try:
        from resvg_py import svg_to_bytes

        output_path.write_bytes(svg_to_bytes(svg_path=str(svg_path), width=width, height=height))
        return
    except ImportError:
        _render_file(svg_path, output_path, width, height)


def write_ico(source_png: Path, output_path: Path, sizes: tuple[int, ...]) -> None:
    """Write a multi-resolution PNG-backed ICO from a transparent PNG source."""
    if not source_png.is_file():
        raise FileNotFoundError(source_png)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    try:
        from PIL import Image
    except ImportError:
        Image = None

    frames: list[tuple[int, bytes]] = []
    if Image is not None:
        with Image.open(source_png) as image:
            for size in sizes:
                frame = image.convert("RGBA").resize((size, size), Image.Resampling.LANCZOS)
                encoded = io.BytesIO()
                frame.save(encoded, format="PNG")
                frames.append((size, encoded.getvalue()))
    else:
        for size in sizes:
            with tempfile.TemporaryDirectory(prefix="petcare-favicon-frame-") as temporary_directory:
                frame_path = Path(temporary_directory) / f"favicon-{size}.png"
                _render_file(source_png, frame_path, size, size)
                frames.append((size, frame_path.read_bytes()))

    header = struct.pack("<HHH", 0, 1, len(frames))
    offset = len(header) + (16 * len(frames))
    entries: list[bytes] = []
    payloads: list[bytes] = []
    for size, payload in frames:
        encoded_size = 0 if size == 256 else size
        entries.append(struct.pack("<BBBBHHII", encoded_size, encoded_size, 0, 0, 1, 32, len(payload), offset))
        payloads.append(payload)
        offset += len(payload)
    output_path.write_bytes(header + b"".join(entries) + b"".join(payloads))


def export_logo_suite(repo_root: Path) -> list[Path]:
    """Export all committed raster and favicon derivatives from color SVG masters."""
    deliverables = repo_root / "docs" / "10-brand-system" / "deliverables" / "logo"
    svg_directory = deliverables / "svg"
    png_directory = deliverables / "png"
    favicon_directory = deliverables / "favicon"
    app_icon_directory = deliverables / "app-icons"
    horizontal_svg = svg_directory / "petcare-logo-horizontal-color.svg"
    symbol_svg = svg_directory / "petcare-symbol-color.svg"
    outputs: list[Path] = []

    for height in HORIZONTAL_HEIGHTS:
        width = round(556 * height / 128)
        output = png_directory / f"petcare-logo-horizontal-color-{height}h.png"
        render_svg(horizontal_svg, output, width, height)
        outputs.append(output)
    for size in SYMBOL_SIZES:
        output = png_directory / f"petcare-symbol-color-{size}.png"
        render_svg(symbol_svg, output, size, size)
        outputs.append(output)

    favicon_svg = favicon_directory / "petcare-favicon.svg"
    favicon_directory.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(symbol_svg, favicon_svg)
    outputs.append(favicon_svg)
    for size in FAVICON_SIZES:
        output = favicon_directory / f"petcare-favicon-{size}.png"
        render_svg(symbol_svg, output, size, size)
        outputs.append(output)
    favicon_ico = favicon_directory / "petcare-favicon.ico"
    write_ico(favicon_directory / "petcare-favicon-48.png", favicon_ico, FAVICON_SIZES)
    outputs.append(favicon_ico)

    for size in APP_ICON_SIZES:
        output = app_icon_directory / f"petcare-app-icon-{size}.png"
        render_svg(symbol_svg, output, size, size)
        outputs.append(output)
    return outputs


if __name__ == "__main__":
    root = Path(__file__).resolve().parents[2]
    exported = export_logo_suite(root)
    print(f"Exported {len(exported)} logo assets.")
