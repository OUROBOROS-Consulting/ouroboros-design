# @OUROBOROS-Consulting/agentic-design

Accessible, elegant design system for OUROBOROS Consulting. Dark, editorial aesthetic built for readability and accessibility-first design.

## Installation

```bash
npm install @ouroboros-consulting/agentic-design
```

## Usage

Import in your SCSS file:

```scss
@import "~@OUROBOROS-Consulting/agentic-design/scss/index";
```

All design tokens (CSS custom properties) are defined in `_base.scss` and available on `:root`.

## Design Tokens

### Colors

All colors defined as CSS custom properties. Scallop texture + elevation levels for dimensional hierarchy.

```scss
--bg1: #141414    // page background
--bg2: #1E1E1E    // card/surface
--bg3: #252525    // elevated surface
--border: #333333
--calloutbg: #2A2A2A

--gold: #C9A84C   // primary accent
--gold-border: #B1935D
--text: #E8E4DC   // primary text
--subdued: #B0AAA0
--muted: #999999

--steel: #7B8FA1  // secondary accent
--amethyst: #967ABB
--sage: #6A8E7F
--teal: #4a6b5f
```

### Elevation Mixins

Three levels apply scallop texture + background:

```scss
@include scallop-recessed      // 12px tile, subtle
@include scallop-standard      // 16px tile, standard
@include scallop-elevated      // 24px tile, prominent
```

## Architecture

| File | Purpose |
| --- | --- |
| `_base.scss` | Tokens, reset, mixins, body texture, scallop patterns |
| `_typography.scss` | Prose typographic scale (Lora serif) |
| `_buttons.scss` | `.btn`, `.btn--ghost` styles |
| `_nav.scss` | Navigation component |
| `_footer.scss` | Footer styles |
| `_cards.scss` | Card layouts, stat cards, bib cards |
| `_home.scss` | Home page (hero, stats, testimonials) |
| `_service.scss` | Service/mission page layouts |
| `_essay.scss` | Essay reading layout |
| `_cv.scss` | CV/resume styling |
| `_linkedin.scss` | LinkedIn post layout |
| `_timeline.scss` | Timeline component |
| `_floorplan.scss` | Grid/floorplan layouts |

## Design Philosophy

**Accessibility first.** Dark theme reduces eye strain for users with visual sensitivity. High contrast ratios meet WCAG AA standards. Careful typography hierarchy guides reading.

**Dimensional depth.** Scallop texture provides visual texture without distraction. Elevation levels create clear information hierarchy through background treatment, not borders.

**Editorial elegance.** Gold accent on dark background. Serif + sans-serif pairing. Careful whitespace. Designed for long-form reading about complex, serious topics.

## Fonts (via Google Fonts CDN)

- **Lora** — Serif for body/headings
- **Inter** — Sans for UI/labels
- **JetBrains Mono** — Monospace for code
- **Cormorant SC** — Small-caps display font for nav logo wordmark (`family=Cormorant+SC:wght@400;600;700`)

## License

MIT
