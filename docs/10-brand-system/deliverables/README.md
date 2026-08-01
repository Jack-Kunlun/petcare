# PetCare Brand Asset Deliverables

This directory is the delivery package for the PetCare brand system. The
machine-readable contract is [`manifest.json`](./manifest.json); downstream
work must retain its asset IDs and lowercase kebab-case paths.

## Brand palette

| Token              | Value     | Intended use                                      |
| ------------------ | --------- | ------------------------------------------------- |
| Primary            | `#4A6CF7` | Primary brand color                               |
| Secondary          | `#5BC8AF` | Secondary system color                            |
| Approved Logo mint | `#5BC9B9` | Mint endpoint in the approved actual Logo artwork |
| Accent             | `#F6B343` | Restrained accent color                           |
| Primary text       | `#1F2937` | Primary text color                                |
| Light background   | `#F8FAFC` | Light page and asset background                   |

## Logo rules

`../assets/petcare-brand-positioning-logo-v1.png` is the approved source
artwork. The two exact extracted transparent PNGs below are the production
visual masters: `logo/png/petcare-logo-approved-actual-primary.png` contains
the approved stacked Symbol + `PetCare` lockup, while
`logo/png/petcare-logo-approved-actual-full-lockup.png` also includes the
English tagline and Chinese slogan. The delivered SVGs are Bézier vector
companions for scalable use, not replacement artwork or a redesign. Preserve
the rounded ribbon house/shield, four-pane window, left dog and right cat, the
`#4A6CF7` to `#5BC9B9` color relationship, the original `PetCare` wordmark
proportions, and the approved vertical spacing. Do not create or substitute a
horizontal lockup; none is approved by the source artwork.

| Version                            | File                                                    | Intended placement                                 |
| ---------------------------------- | ------------------------------------------------------- | -------------------------------------------------- |
| Approved actual primary master     | `logo/png/petcare-logo-approved-actual-primary.png`     | Default visual reference and raster production use |
| Approved actual full-lockup master | `logo/png/petcare-logo-approved-actual-full-lockup.png` | Brand communications requiring tagline and slogan  |
| Color stacked companion            | `logo/svg/petcare-logo-stacked-color.svg`               | Scalable light-background brand surfaces           |
| Dark stacked companion             | `logo/svg/petcare-logo-stacked-dark.svg`                | Single-color dark-navy applications                |
| Monochrome stacked companion       | `logo/svg/petcare-logo-stacked-monochrome.svg`          | Monochrome production constraints                  |
| Reverse stacked companion          | `logo/svg/petcare-logo-stacked-reverse.svg`             | Dark or photographic backgrounds                   |
| Color symbol                       | `logo/svg/petcare-symbol-color.svg`                     | App icons, favicons, avatars, and compact UI       |
| Dark symbol                        | `logo/svg/petcare-symbol-dark.svg`                      | Single-color dark-navy applications                |
| Monochrome symbol                  | `logo/svg/petcare-symbol-monochrome.svg`                | Monochrome production constraints                  |
| Reverse symbol                     | `logo/svg/petcare-symbol-reverse.svg`                   | Dark or photographic backgrounds                   |

Keep clear space of at least `0.25H`, where `H` is the symbol height. Use a
32px symbol height in headers, 48px for brand-display contexts, and never
display the symbol higher than 64px in compact UI. Re-extract the two raster
masters with `scripts/brand-assets/extract_approved_logo_assets.ps1`, then
regenerate stacked PNG, favicon, ICO, and app-icon derivatives with
`python scripts/brand-assets/export_logo_assets.py`. The color, dark,
monochrome, and reverse stacked companions each export at 260px, 520px, and
780px high.

## Hero rules

All hero imagery is text-free photography. Do not bake website copy, buttons,
logos, watermarks, medical scenes, cages, or cartoon styling into the images.
Website copy is rendered in HTML over the declared `safeZone`, so it remains
accessible, localizable, and responsive.

The safe-zone values mean:

- `left-40`: reserve the leftmost 40% for HTML copy; keep the primary subject
  in the right 55%.
- `right-40`: reserve the rightmost 40% for HTML copy; keep the primary
  subject or care details in the left 55%.

Every hero family provides the following crops: desktop `1920x720`, miniapp
`750x340`, and social `1200x630`. The manifest associates each derivative
with its uncropped source and recommended alternative text.

## Manifest contract

Each raster or vector asset record has these fields:

```json
{
  "id": "hero.trusted-care.desktop.webp",
  "path": "hero/desktop/hero-trusted-care-desktop-v1.webp",
  "kind": "hero",
  "width": 1920,
  "height": 720,
  "format": "webp",
  "safeZone": "left-40",
  "alt": "A cat and dog resting peacefully in a modern living room with natural light.",
  "source": "hero/source/hero-trusted-care-source-v1.png"
}
```

Stable prefixes are `logo.*`, `hero.trusted-care.*`,
`hero.professional-care.*`, `hero.community-companion.*`, and `element.*`.
Future tasks add the corresponding Logo, source, and reusable-element records
without renaming any existing ID.
