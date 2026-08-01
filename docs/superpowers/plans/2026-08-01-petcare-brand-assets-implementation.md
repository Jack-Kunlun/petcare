# PetCare Brand Assets Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Faithfully separate and normalize the approved actual PetCare Logo artwork into a production-ready logo suite, then build three responsive website hero families, reusable brand elements, and their delivery documentation.

**Architecture:** Treat identity assets and photographic assets as separate pipelines. `docs/10-brand-system/assets/petcare-brand-positioning-logo-v1.png` is the approved source artwork; deterministic direct crops produce the transparent primary and full-lockup PNG production visual masters. Bézier SVG companions faithfully separate and normalize the approved stacked composition without redesign before reproducible raster export. Hero photography is generated without text, visually reviewed, then cropped and encoded through a deterministic image pipeline. A manifest and validator make the final package auditable.

**Tech Stack:** SVG 1.1, CSS custom properties, built-in image generation, Python 3 with Pillow and CairoSVG from the bundled workspace runtime, PowerShell, Markdown.

## Global Constraints

- Use `#4A6CF7` as primary, `#5BC8AF` as secondary, `#F6B343` as accent, `#1F2937` as primary text, and `#F8FAFC` as light background.
- Preserve one-to-one the approved actual Logo artwork: rounded ribbon house/shield, four-pane window, left dog, right cat, overlaps and negative spaces, `#4A6CF7` to `#5BC9B9` color relationship, and original `PetCare` wordmark proportions.
- Logo work is asset separation, faithful vector reconstruction, and format normalization only. Do not redesign, reinterpret, simplify, or stylistically optimize the artwork.
- Logo clear space is at least `0.25H`; header symbol height is 32px, brand display is 48px, and maximum display is 64px.
- Hero images contain no text, buttons, generated logos, watermarks, medical scenes, cages, or cartoon styling.
- Generate desktop `1920×720`, miniapp `750×340`, and social `1200×630` variants for all three hero families.
- Treat `docs/10-brand-system/assets/petcare-brand-positioning-logo-v1.png` as the approved source artwork; do not overwrite it. Treat the two exact extracted transparent PNGs as production visual masters and SVGs only as Bézier companions.
- Use lowercase kebab-case file names.

---

## File Map

```text
docs/10-brand-system/deliverables/
├── README.md                                  # Human-readable usage and asset catalog
├── manifest.json                              # Machine-readable sizes, formats, alt text, prompts
├── logo/
│   ├── svg/                                   # Vector masters and variants
│   ├── png/                                   # 1x/2x/3x raster exports
│   ├── favicon/                               # favicon.svg, favicon.png, favicon.ico
│   └── app-icons/                             # Required square icon sizes
├── hero/
│   ├── desktop/                               # 1920×720 PNG and WebP
│   ├── miniapp/                               # 750×340 PNG and WebP
│   ├── social/                                # 1200×630 PNG and WebP
│   └── source/                                # Selected uncropped image-generation outputs
└── elements/
    ├── gradients/                             # SVG and CSS gradient definitions
    ├── patterns/                              # Seamless connection pattern SVG
    ├── badges/                                # Symbol-only and Trusted Companion badges
    └── overlays/                              # Left, right, and bottom masks

scripts/brand-assets/
├── export_logo_assets.py                      # SVG-to-PNG/ICO export pipeline
├── process_hero_assets.py                     # Crop and encode pipeline
└── validate_brand_assets.py                   # Structure, dimensions, SVG, and alpha checks
```

---

### Task 1: Delivery Skeleton and Manifest Contract

**Files:**

- Create: `docs/10-brand-system/deliverables/README.md`
- Create: `docs/10-brand-system/deliverables/manifest.json`

**Interfaces:**

- Consumes: approved design spec and Brand Book v1.0.
- Produces: stable asset IDs `logo.*`, `hero.trusted-care`, `hero.professional-care`, `hero.community-companion`, and `element.*` used by all later tasks.

- [ ] **Step 1: Create the directory tree and initial README**

Document the five brand colors, Logo size rules, hero safe-zone convention, and the rule that website copy is rendered in HTML rather than baked into images.

- [ ] **Step 2: Define the manifest schema with final asset records**

Use this record shape for every raster or vector output:

```json
{
  "id": "hero.trusted-care.desktop.webp",
  "path": "hero/desktop/hero-trusted-care-desktop-v1.webp",
  "kind": "hero",
  "width": 1920,
  "height": 720,
  "format": "webp",
  "safeZone": "left-40",
  "alt": "猫和狗在自然光照射的现代客厅里安心休息",
  "source": "hero/source/hero-trusted-care-source-v1.png"
}
```

- [ ] **Step 3: Validate JSON syntax**

Run:

```powershell
Get-Content docs/10-brand-system/deliverables/manifest.json -Raw | ConvertFrom-Json | Out-Null
```

Expected: exit code 0 and no parser output.

- [ ] **Step 4: Commit the delivery contract**

```bash
git add docs/10-brand-system/deliverables/README.md docs/10-brand-system/deliverables/manifest.json
git commit -m "docs(brand): 建立品牌资产交付清单"
```

---

### Task 2: Deterministic Logo SVG Suite

**Files:**

- Create: `docs/10-brand-system/deliverables/logo/svg/petcare-symbol-color.svg`
- Create: `docs/10-brand-system/deliverables/logo/svg/petcare-symbol-dark.svg`
- Create: `docs/10-brand-system/deliverables/logo/svg/petcare-symbol-monochrome.svg`
- Create: `docs/10-brand-system/deliverables/logo/svg/petcare-symbol-reverse.svg`
- Create: `docs/10-brand-system/deliverables/logo/svg/petcare-logo-stacked-color.svg`
- Create: `docs/10-brand-system/deliverables/logo/svg/petcare-logo-stacked-dark.svg`
- Create: `docs/10-brand-system/deliverables/logo/svg/petcare-logo-stacked-monochrome.svg`
- Create: `docs/10-brand-system/deliverables/logo/svg/petcare-logo-stacked-reverse.svg`
- Create: `docs/10-brand-system/deliverables/logo/png/petcare-logo-approved-actual-primary.png`
- Create: `docs/10-brand-system/deliverables/logo/png/petcare-logo-approved-actual-full-lockup.png`
- Create: `scripts/brand-assets/extract_approved_logo_assets.ps1`
- Modify: `docs/10-brand-system/deliverables/manifest.json`

**Interfaces:**

- Consumes: the approved actual Logo source artwork from Global Constraints.
- Produces: two exact extracted transparent PNG production visual masters and self-contained Bézier SVG companions with `viewBox`, accessible `<title>`, and no external image/font dependency.

- [ ] **Step 1: Faithfully separate and vectorize the approved actual mark**

Directly crop the approved source artwork into a `330×260` transparent primary visual master and `350×345` transparent full-lockup visual master. Use a `128×128` viewBox for the symbol and `330×260` for the stacked SVG companion. Trace the primary production visual master one-to-one: preserve the rounded ribbon house/shield, four-pane window, left dog and right cat silhouettes, their scale/direction/overlap/negative spaces, and the blue-to-mint ribbon relationship. Do not replace the animal relationship with a heart or simplify any contour. Use the approved Logo colors in the color master:

```xml
<linearGradient id="petcare-mint-gradient" x1="64" y1="52" x2="64" y2="124" gradientUnits="userSpaceOnUse">
  <stop offset="0" stop-color="#4A6CF7" />
  <stop offset="0.42" stop-color="#5BC9B9" />
  <stop offset="1" stop-color="#5BC9B9" />
</linearGradient>
```

- [ ] **Step 2: Build the approved stacked wordmark variants**

The canonical composition includes exactly Symbol stacked above `PetCare`; do not create a horizontal or compact substitute. The exact extracted full-lockup PNG additionally preserves `Trusted Pet Companion Platform` and the approved Chinese slogan from the source artwork. Reconstruct the original wordmark proportion, spacing, and vertical relationship as paths so the SVG does not depend on installed fonts.

- [ ] **Step 3: Check SVG structure**

Run:

```powershell
Get-ChildItem docs/10-brand-system/deliverables/logo/svg/*.svg | ForEach-Object {
  [xml](Get-Content $_.FullName -Raw) | Out-Null
}
```

Expected: all files parse as XML.

- [ ] **Step 4: Visually inspect the 16px, 24px, 32px, 48px, and 64px symbol renders**

Reject paths that alter the house/shield silhouette, close the approved negative spaces, move the four-pane window, reverse or rescale either animal, or make either animal silhouette illegible at 16px. Render a target crop and side-by-side comparison against the approved actual artwork before acceptance.

- [ ] **Step 5: Commit SVG masters**

```bash
git add docs/10-brand-system/deliverables/logo/svg docs/10-brand-system/deliverables/manifest.json
git commit -m "feat(brand): 交付品牌标识矢量母版"
```

---

### Task 3: Logo Raster, Favicon, and App Icon Exports

**Files:**

- Create: `scripts/brand-assets/export_logo_assets.py`
- Create: `docs/10-brand-system/deliverables/logo/png/*`
- Create: `docs/10-brand-system/deliverables/logo/favicon/*`
- Create: `docs/10-brand-system/deliverables/logo/app-icons/*`
- Modify: `docs/10-brand-system/deliverables/manifest.json`

**Interfaces:**

- Consumes: Task 2 SVG master paths.
- Produces: PNG sizes and ICO file listed in the manifest.

- [ ] **Step 1: Implement deterministic exports**

Expose these functions:

```python
def render_svg(svg_path: Path, output_path: Path, width: int, height: int) -> None: ...
def write_ico(source_png: Path, output_path: Path, sizes: tuple[int, ...]) -> None: ...
def export_logo_suite(repo_root: Path) -> list[Path]: ...
```

Export every color, dark, monochrome, and reverse stacked Logo at 260/520/780px high using each SVG companion viewBox aspect ratio, Symbol at 16/20/24/28/32/48/64/128/256/512/1024px, and favicon at 16/32/48px. Reproduce the two exact extracted PNG production visual masters with `scripts/brand-assets/extract_approved_logo_assets.ps1` before running the SVG exporter.

- [ ] **Step 2: Run the exporter**

Run with the bundled workspace Python runtime:

```powershell
python scripts/brand-assets/export_logo_assets.py
```

Expected: every manifest logo output exists and has non-zero size.

- [ ] **Step 3: Inspect transparent corners and small-size readability**

Check that PNG outputs use RGBA mode and corner pixels are transparent where appropriate.

- [ ] **Step 4: Commit raster exports and script**

```bash
git add scripts/brand-assets/export_logo_assets.py docs/10-brand-system/deliverables/logo docs/10-brand-system/deliverables/manifest.json
git commit -m "feat(brand): 导出品牌标识数字资产"
```

---

### Task 4: Generate and Select Three Hero Sources

**Files:**

- Create: `docs/10-brand-system/deliverables/hero/source/hero-trusted-care-source-v1.png`
- Create: `docs/10-brand-system/deliverables/hero/source/hero-professional-care-source-v1.png`
- Create: `docs/10-brand-system/deliverables/hero/source/hero-community-companion-source-v1.png`
- Modify: `docs/10-brand-system/deliverables/manifest.json`

**Interfaces:**

- Consumes: Brand Book photography system and the safe-zone table in the approved spec.
- Produces: three selected, text-free, high-resolution source images.

- [ ] **Step 1: Generate Hero 01 — Trusted Care**

Use case `photorealistic-natural`. Generate a wide premium lifestyle photograph of a real cat and dog calmly resting in a modern warm home, natural side light, subtle wood and fabric, subjects on the right 55%, completely clean left 40% copy zone, restrained blue and mint accents, no people, no text, no logo, no watermark, no clinic, no cage, no cartoon.

- [ ] **Step 2: Generate Hero 02 — Professional Care**

Generate a wide authentic home-care scene with a tidy pet feeding station, fresh water, measured food and a subtle phone-shaped service-record prop with no legible interface text, cat nearby, key details on the left 55%, completely clean right 40% copy zone, natural morning light, no people, no text, no logo, no medical equipment.

- [ ] **Step 3: Generate Hero 03 — Community Companion**

Generate a wide editorial lifestyle photograph of a real cat and dog sharing a relaxed sunlit living-room moment, subjects on the right 55%, completely clean left 40% copy zone, warm human-centered atmosphere without showing people, restrained blue, mint and amber details, no text, no logo, no watermark.

- [ ] **Step 4: Inspect each output at full resolution**

Reject any image with malformed anatomy, duplicated limbs, inconsistent reflections, readable pseudo-text, blocked safe zones, strong saturation, medical styling, or key content too close to crop edges.

- [ ] **Step 5: Save selected built-in outputs into the workspace and update prompt provenance**

Record the final prompt, generation mode, selection date, suggested alt text, and source path in `manifest.json`.

- [ ] **Step 6: Commit selected source images**

```bash
git add docs/10-brand-system/deliverables/hero/source docs/10-brand-system/deliverables/manifest.json
git commit -m "feat(brand): 生成官网轮播摄影母版"
```

---

### Task 5: Responsive Hero Crops and Brand Elements

**Files:**

- Create: `scripts/brand-assets/process_hero_assets.py`
- Create: `docs/10-brand-system/deliverables/hero/desktop/*`
- Create: `docs/10-brand-system/deliverables/hero/miniapp/*`
- Create: `docs/10-brand-system/deliverables/hero/social/*`
- Create: `docs/10-brand-system/deliverables/elements/gradients/*`
- Create: `docs/10-brand-system/deliverables/elements/patterns/*`
- Create: `docs/10-brand-system/deliverables/elements/badges/*`
- Create: `docs/10-brand-system/deliverables/elements/overlays/*`
- Modify: `docs/10-brand-system/deliverables/manifest.json`

**Interfaces:**

- Consumes: Task 4 selected source images and Task 2 Symbol.
- Produces: all website-ready PNG/WebP crops and reusable SVG/CSS elements.

- [ ] **Step 1: Implement focal-point-aware crop profiles**

Expose:

```python
@dataclass(frozen=True)
class CropProfile:
    width: int
    height: int
    focal_x: float
    focal_y: float

def cover_crop(image: Image.Image, profile: CropProfile) -> Image.Image: ...
def export_hero_family(source: Path, slug: str, safe_zone: str) -> list[Path]: ...
```

Use `1920×720`, `750×340`, and `1200×630` profiles with focal points matched to the subject side.

- [ ] **Step 2: Export PNG and WebP**

Use sRGB output, PNG optimization, and WebP quality 88. Preserve enough detail for 2x-density displays without introducing sharpening halos.

- [ ] **Step 3: Create deterministic supporting SVGs**

Create:

- `petcare-gradient-linear.svg`
- `petcare-gradient-radial.svg`
- `petcare-background-soft.svg`
- `petcare-connection-pattern.svg`
- `petcare-badge-symbol.svg`
- `petcare-badge-trusted-companion.svg`
- `petcare-overlay-copy-left.svg`
- `petcare-overlay-copy-right.svg`
- `petcare-overlay-bottom.svg`

For the left and right copy overlays, document white-text and dark-text combinations whose contrast over the composited Hero reaches WCAG AA: at least 4.5:1 for body text and 3:1 for large text.

- [ ] **Step 4: Inspect all nine crop compositions**

Verify that the safe zone remains clear and no cat/dog face, ear, paw, bowl, or key environmental feature is cut at an awkward boundary.

- [ ] **Step 5: Commit derived assets**

```bash
git add scripts/brand-assets/process_hero_assets.py docs/10-brand-system/deliverables/hero docs/10-brand-system/deliverables/elements docs/10-brand-system/deliverables/manifest.json
git commit -m "feat(brand): 交付响应式轮播与品牌元素"
```

---

### Task 6: Automated Validation and Delivery QA

**Files:**

- Create: `scripts/brand-assets/validate_brand_assets.py`
- Modify: `docs/10-brand-system/deliverables/README.md`
- Modify: `docs/10-brand-system/deliverables/manifest.json`

**Interfaces:**

- Consumes: complete deliverables package.
- Produces: exit code 0 only when required files, dimensions, formats, SVG parsing, alpha behavior, and manifest references are valid.

- [ ] **Step 1: Implement validation checks**

Expose:

```python
def validate_manifest(root: Path) -> list[str]: ...
def validate_raster(path: Path, expected_width: int, expected_height: int) -> list[str]: ...
def validate_svg(path: Path) -> list[str]: ...
def main() -> int: ...
```

Fail on missing assets, duplicate IDs, invalid dimensions, invalid XML, external SVG URLs, missing `viewBox`, broken source references, or non-transparent Symbol corners.

- [ ] **Step 2: Run automated validation**

```powershell
python scripts/brand-assets/validate_brand_assets.py
```

Expected: `Validated PetCare brand assets: 0 errors` and exit code 0.

- [ ] **Step 3: Complete manual visual QA**

Open every SVG, small Logo raster, source Hero, and final crop. Compare the Logo package directly against the approved actual artwork `docs/10-brand-system/assets/petcare-brand-positioning-logo-v1.png`, including its large lower-left Logo and lower-right version row, then compare the remaining package against `PetCare-Brand-Book-v1.0.md` pages 45–76 and the approved design spec.

- [ ] **Step 4: Finalize delivery documentation**

README must list every Logo version, Hero theme, intended placement, safe zone, alt text, CSS overlay usage, source prompt, and regeneration command.
It must also identify the approved WCAG AA text/overlay combinations and state that carousel autoplay needs pause controls and must respect `prefers-reduced-motion`.

- [ ] **Step 5: Run repository checks**

```powershell
git diff --check
python scripts/brand-assets/validate_brand_assets.py
```

Expected: both commands pass.

- [ ] **Step 6: Commit the verified package**

```bash
git add docs/10-brand-system/deliverables scripts/brand-assets/validate_brand_assets.py
git commit -m "docs(brand): 完成品牌资产交付说明"
```

---

## Execution Checkpoints

1. Review Logo geometry after Task 2 before exporting raster sizes.
2. Review the three selected Hero sources after Task 4 before producing crops.
3. Review contact sheets of every final asset before Task 6 completion.

## Completion Definition

- Every asset declared in `manifest.json` exists and validates.
- SVG masters remain editable and contain no embedded raster or remote dependency.
- Logo visual masters are exact transparent separations of the approved actual artwork; SVG companions preserve the approved stacked composition with no redesign or visible comparison drift.
- Logo is legible at all required minimum sizes.
- Three Hero families are visually consistent, text-free, and safe to crop.
- Desktop, miniapp, and social variants preserve their copy safe zones.
- README documents usage, alt text, prompts, and regeneration.
- `git diff --check` and the asset validator both pass.
