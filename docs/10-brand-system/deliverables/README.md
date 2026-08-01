# PetCare Brand Asset Deliverables

This directory is the delivery package for the PetCare brand system. The
machine-readable contract is [`manifest.json`](./manifest.json); downstream
work must retain its asset IDs and lowercase kebab-case paths.

## Brand palette

| Token | Value | Intended use |
| --- | --- | --- |
| Primary | `#4A6CF7` | Primary brand color |
| Secondary | `#5BC8AF` | Secondary brand color |
| Accent | `#F6B343` | Restrained accent color |
| Primary text | `#1F2937` | Primary text color |
| Light background | `#F8FAFC` | Light page and asset background |

## Logo rules

The logo retains the approved house/protection, heart/relationship, and
cat-dog/companionship concept. Keep clear space of at least `0.25H`, where
`H` is the symbol height. Use a 32px symbol height in headers, 48px for
brand-display contexts, and never display the mark higher than 64px.

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
