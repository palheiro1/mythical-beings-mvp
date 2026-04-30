# Wisdom Duel — Webapp Branding Asset Kit

This is a practical raster asset kit generated from the selected Wisdom Duel logo concept.

## Included assets

### Main logo
- `logo-primary-dark.png` — main logo, dark background, ~1200px wide.
- `logo-primary-dark@2x.png` — larger version for high-density displays.
- `logo-header-dark.png` — header/navbar version.
- `logo-header-dark@2x.png` — high-density navbar version.
- `logo-loading.png` — loading/splash use.

### Icons
- `icon-1024.png`
- `icon-512.png`
- `icon-256.png`
- `icon-192.png`
- `icon-180.png`
- `icon-128.png`
- `icon-64.png`
- `icon-32.png`
- `icon-16.png`
- `favicon-32.png`
- `favicon-16.png`
- `apple-touch-icon.png`
- `pwa-192.png`
- `pwa-512.png`

### Social
- `social-preview-1600x900.png`

### Developer helpers
- `brand-tokens.css`
- `manifest-snippet.json`

## Important limitation

These are raster assets extracted from the approved concept image. They are suitable for prototypes, staging, headers, PWA icons, and first production tests.

They are not equivalent to a final professional logo package with:
- vector SVG/AI source,
- transparent layered logo,
- manually retouched small-size favicons,
- legal-safe typography licensing,
- separate editable emblem/wordmark layers.

For final production, the recommended next step is to have a designer vectorize the selected logo and create true SVG/PNG transparent exports.

## Suggested usage

Put the files in:

```txt
/public/assets/branding/
```

Example:

```tsx
<img
  src="/assets/branding/logo-header-dark.png"
  alt="Wisdom Duel"
  className="h-12 w-auto"
/>
```

For PWA:

```json
{
  "icons": [
    { "src": "/assets/branding/pwa-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/assets/branding/pwa-512.png", "sizes": "512x512", "type": "image/png" }
  ],
  "theme_color": "#0B1024",
  "background_color": "#050812"
}
```

## Core palette

- Deep navy: `#0B1024`
- Near black: `#050812`
- Royal blue: `#192A6B`
- Arcane blue: `#2D6BFF`
- Cyan highlight: `#4FC3FF`
- Mystic violet: `#6C2DBE`
- Deep violet: `#1A1240`
- Gold: `#D4AF37`
- Warm gold: `#F2C46B`
- Silver: `#C9D2E3`