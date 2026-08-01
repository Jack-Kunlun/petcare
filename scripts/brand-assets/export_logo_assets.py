"""Render the committed PetCare SVG logo masters into browser and app assets.

This module deliberately uses only the Python standard library and an already-installed
Chromium-based browser.  It therefore adds no project dependency: Chromium is the SVG
rasterizer and its PNG screenshots retain the masters' transparent background.
"""

from __future__ import annotations

import base64
import os
import shutil
import io
import struct
import subprocess
import tempfile
import time
import xml.etree.ElementTree as ET
from pathlib import Path


STACKED_HEIGHTS = (260, 520, 780)
STACKED_VARIANTS = ("color", "dark", "monochrome", "reverse")
SYMBOL_SIZES = (16, 20, 24, 28, 32, 48, 64, 128, 256, 512, 1024)
FAVICON_SIZES = (16, 32, 48)
APP_ICON_SIZES = (32, 48, 64, 96, 128, 144, 180, 192, 512, 1024)
BROWSER_RENDER_ATTEMPTS = 3
BROWSER_RENDER_POLL_COUNT = 20
BROWSER_RENDER_POLL_SECONDS = 0.25
BROWSER_VIRTUAL_TIME_MS = 2000


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
    # Keep the wrapper page on the same drive as the SVG. Chromium blocks a
    # file:// page on another drive from loading the local SVG resource.
    with tempfile.TemporaryDirectory(
        prefix="petcare-logo-render-", dir=output_path.parent
    ) as temporary_directory:
        page_path = Path(temporary_directory) / "render.html"
        if source_path.suffix.lower() == ".svg":
            asset_markup = source_path.read_text(encoding="utf-8")
            asset_selector = "svg"
        elif source_path.suffix.lower() == ".png":
            encoded = base64.b64encode(source_path.read_bytes()).decode("ascii")
            asset_markup = f'<img src="data:image/png;base64,{encoded}" alt="" />'
            asset_selector = "img"
        else:
            raise ValueError(f"Unsupported browser render source: {source_path}")
        page_path.write_text(
            "<!doctype html><html><head><style>"
            f"html,body,{asset_selector}{{margin:0;padding:0;width:{width}px;height:{height}px;overflow:hidden;}}"
            f"{asset_selector}{{display:block;object-fit:fill;}}"
            f"</style></head><body>{asset_markup}</body></html>",
            encoding="utf-8",
        )
        output_path.unlink(missing_ok=True)
        for attempt in range(BROWSER_RENDER_ATTEMPTS):
            command = [
                browser,
                "--headless=new",
                "--disable-gpu",
                "--hide-scrollbars",
                "--no-first-run",
                "--no-default-browser-check",
                f"--user-data-dir={Path(temporary_directory) / f'browser-profile-{attempt}'}",
                "--force-device-scale-factor=1",
                "--run-all-compositor-stages-before-draw",
                f"--virtual-time-budget={BROWSER_VIRTUAL_TIME_MS}",
                "--default-background-color=00000000",
                f"--window-size={width},{height}",
                f"--screenshot={output_path.resolve()}",
                page_path.as_uri(),
            ]
            subprocess.run(command, check=True, capture_output=True, text=True)
            for _ in range(BROWSER_RENDER_POLL_COUNT):
                if output_path.is_file() and output_path.stat().st_size:
                    return
                time.sleep(BROWSER_RENDER_POLL_SECONDS)
        raise RuntimeError(f"Browser did not produce {output_path}")


def _svg_aspect_ratio(svg_path: Path) -> float:
    """Read the committed master's viewBox ratio without hard-coding lockup width."""
    root = ET.parse(svg_path).getroot()
    view_box = root.attrib.get("viewBox", "").split()
    if len(view_box) != 4:
        raise ValueError(f"Missing or invalid viewBox: {svg_path}")
    width = float(view_box[2])
    height = float(view_box[3])
    if width <= 0 or height <= 0:
        raise ValueError(f"Non-positive viewBox: {svg_path}")
    return width / height


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
    """Export all committed raster and favicon derivatives from committed SVG masters."""
    deliverables = repo_root / "docs" / "10-brand-system" / "deliverables" / "logo"
    svg_directory = deliverables / "svg"
    png_directory = deliverables / "png"
    favicon_directory = deliverables / "favicon"
    app_icon_directory = deliverables / "app-icons"
    symbol_svg = svg_directory / "petcare-symbol-color.svg"
    outputs: list[Path] = []

    for variant in STACKED_VARIANTS:
        stacked_svg = svg_directory / f"petcare-logo-stacked-{variant}.svg"
        stacked_aspect_ratio = _svg_aspect_ratio(stacked_svg)
        for height in STACKED_HEIGHTS:
            width = round(stacked_aspect_ratio * height)
            output = png_directory / f"petcare-logo-stacked-{variant}-{height}h.png"
            render_svg(stacked_svg, output, width, height)
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
