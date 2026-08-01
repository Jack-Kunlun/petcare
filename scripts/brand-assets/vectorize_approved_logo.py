"""Create faithful self-contained SVG companions from the approved raster master.

The approved source is raster artwork. To prevent interpretive geometry drift, this
script converts deterministic quantized pixels into editable SVG path runs. At the
approved 330x260 comparison size the alpha silhouette is preserved one-to-one.
"""

from __future__ import annotations

from collections import defaultdict
import hashlib
from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parents[2]
DELIVERY = ROOT / "docs" / "10-brand-system" / "deliverables" / "logo"
MASTER = DELIVERY / "png" / "petcare-logo-approved-actual-primary.png"
SVG_DIR = DELIVERY / "svg"
SYMBOL_CROP = (79, 9, 250, 180)  # 171x171 square around the approved Symbol
SYMBOL_SCALE = 128 / 171
FLAT_COLORS = {
    "dark": (7, 26, 82),
    "monochrome": (115, 115, 115),
    "reverse": (255, 255, 255),
}


def quantized_color(image: Image.Image) -> Image.Image:
    """Reduce raster noise while preserving transparent silhouette pixels."""
    quantized = image.quantize(colors=256, method=Image.Quantize.FASTOCTREE).convert("RGBA")
    source_alpha = image.getchannel("A")
    alpha = source_alpha.point(lambda value: round(value / 17) * 17)
    quantized.putalpha(alpha)
    return quantized


def flat_variant(image: Image.Image, rgb: tuple[int, int, int]) -> Image.Image:
    result = Image.new("RGBA", image.size, (*rgb, 0))
    alpha = image.getchannel("A").point(lambda value: round(value / 17) * 17)
    result.putalpha(alpha)
    return result


def pixel_run_paths(image: Image.Image) -> str:
    """Group horizontal pixel runs by RGBA and emit deterministic SVG paths."""
    groups: dict[tuple[int, int, int, int], list[str]] = defaultdict(list)
    pixels = image.load()
    for y in range(image.height):
        x = 0
        while x < image.width:
            color = pixels[x, y]
            start = x
            x += 1
            while x < image.width and pixels[x, y] == color:
                x += 1
            if color[3] == 0:
                continue
            length = x - start
            groups[color].append(f"M{start} {y}h{length}v1h-{length}z")

    output: list[str] = []
    for red, green, blue, alpha in sorted(groups):
        opacity = "" if alpha == 255 else f' fill-opacity="{alpha / 255:.4f}"'
        path = "".join(groups[(red, green, blue, alpha)])
        output.append(f'<path fill="#{red:02X}{green:02X}{blue:02X}"{opacity} d="{path}"/>')
    return "".join(output)


def svg_document(
    title: str,
    view_box: str,
    markup: str,
    source_sha256: str,
    transform: str | None = None,
) -> str:
    group_start = f'<g transform="{transform}">' if transform else "<g>"
    return (
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{view_box}" '
        f'data-approved-source-sha256="{source_sha256}" '
        f'data-vectorization="approved-pixel-runs-v1" '
        f'role="img" aria-labelledby="title" shape-rendering="crispEdges">'
        f'<title id="title">{title}</title>{group_start}{markup}</g></svg>\n'
    )


def write_variants() -> None:
    SVG_DIR.mkdir(parents=True, exist_ok=True)
    source_sha256 = hashlib.sha256(MASTER.read_bytes()).hexdigest()
    with Image.open(MASTER) as opened:
        master = opened.convert("RGBA")
    symbol = master.crop(SYMBOL_CROP)

    stacked_images = {"color": quantized_color(master)}
    symbol_images = {"color": quantized_color(symbol)}
    for name, rgb in FLAT_COLORS.items():
        stacked_images[name] = flat_variant(master, rgb)
        symbol_images[name] = flat_variant(symbol, rgb)

    for name, image in stacked_images.items():
        svg = svg_document(
            f"PetCare approved actual stacked {name} Logo",
            "0 0 330 260",
            pixel_run_paths(image),
            source_sha256,
        )
        (SVG_DIR / f"petcare-logo-stacked-{name}.svg").write_text(svg, encoding="utf-8", newline="\n")

    for name, image in symbol_images.items():
        svg = svg_document(
            f"PetCare approved actual {name} Symbol",
            "0 0 128 128",
            pixel_run_paths(image),
            source_sha256,
            f"scale({SYMBOL_SCALE:.12f})",
        )
        (SVG_DIR / f"petcare-symbol-{name}.svg").write_text(svg, encoding="utf-8", newline="\n")

    print("Vectorized approved actual PetCare Logo: 8 SVG companions")


if __name__ == "__main__":
    write_variants()
