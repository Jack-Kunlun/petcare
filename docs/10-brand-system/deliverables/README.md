# PetCare Brand Asset Deliverables

This directory is the delivery package for the PetCare brand system. The
machine-readable contract is [`manifest.json`](./manifest.json); downstream
work must retain its asset IDs and lowercase kebab-case paths.

## Brand palette

| Token | Value | Intended use |
| --- | --- | --- |
| Primary | `#4A6CF7` | Primary brand color |
| Secondary | `#5BC8AF` | Secondary system color |
| Approved Logo mint | `#5BC9B9` | Mint endpoint in the approved actual Logo artwork |
| Accent | `#F6B343` | Restrained accent color |
| Primary text | `#1F2937` | Primary text color |
| Light background | `#F8FAFC` | Light page and asset background |

## Logo rules

`../assets/petcare-brand-positioning-logo-v1.png` is the approved actual
Logo artwork and production visual master. Its extracted Logo raster governs
all visual decisions. The delivered SVGs are faithful reconstructed vector
companions for scalable use, not replacement artwork or a redesign. Preserve
the rounded ribbon house/shield, four-pane window, left dog and right cat, the
`#4A6CF7` to `#5BC9B9` color relationship, and the original `PetCare` wordmark
proportions. Do not add `宠伴` to the standard or compact lockup.

| Version | File | Intended placement |
| --- | --- | --- |
| Color horizontal | `logo/svg/petcare-logo-horizontal-color.svg` | Default light-background header and brand surfaces |
| Compact horizontal | `logo/svg/petcare-logo-horizontal-compact.svg` | Narrow headers and mobile layouts |
| Dark horizontal | `logo/svg/petcare-logo-horizontal-dark.svg` | Single-color dark-navy applications |
| Monochrome horizontal | `logo/svg/petcare-logo-horizontal-monochrome.svg` | Monochrome production constraints |
| Reverse horizontal | `logo/svg/petcare-logo-horizontal-reverse.svg` | Dark or photographic backgrounds |
| Color symbol | `logo/svg/petcare-symbol-color.svg` | App icons, favicons, avatars, and compact UI |
| Dark symbol | `logo/svg/petcare-symbol-dark.svg` | Single-color dark-navy applications |
| Monochrome symbol | `logo/svg/petcare-symbol-monochrome.svg` | Monochrome production constraints |
| Reverse symbol | `logo/svg/petcare-symbol-reverse.svg` | Dark or photographic backgrounds |

Keep clear space of at least `0.25H`, where `H` is the symbol height. Use a
32px symbol height in headers, 48px for brand-display contexts, and never
display the mark higher than 64px. Regenerate PNG, favicon, ICO, and app-icon
derivatives with `python scripts/brand-assets/export_logo_assets.py`.

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
