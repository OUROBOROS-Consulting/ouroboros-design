# @ouroboros-consulting/ouroboros-design

SCSS design system for OUROBOROS Consulting. Dark, editorial, accessibility-first.

This package is the **single source of truth for visual styling**. Consuming sites must not redefine its tokens.

## Consumption

Not published to the npm registry. The site consumes it from a local path:

```json
// OUROBOROS-Consulting.github.io/package.json
"dependencies": {
  "@ouroboros-consulting/ouroboros-design": "file:../ouroboros-design"
}
```

Import the SCSS source **without a `~` prefix** — that is a webpack convention and native Sass does not understand it. The consuming site sets `sass: load_paths: [node_modules]` in `_config.yml`, which makes the bare path resolve.

## Build

```bash
npm run build       # compressed → dist/ouroboros.css
npm run build:dev   # expanded, for debugging
npm run watch       # rebuild on change
```

### ⚠ The site compiles the SCSS source, not `dist/`

`dist/ouroboros.css` exists for any consumer that wants prebuilt CSS. The Jekyll site does **not** use it — `assets/css/main.scss` pulls in the SCSS and Jekyll compiles it. Editing a partial therefore changes the site even if you never run `npm run build`.

### ⚠ Deploy order is not optional

The site's GitHub Actions workflow does a second `actions/checkout@v4` of this repo with **no `ref:`**, so CI always pulls this repo's **default branch** (`main`).

Consequences:
- Design work on a feature branch **never reaches production**, no matter how it looks locally.
- Pushing this repo does **not** trigger the site's workflow.
- When a change spans both repos, **push this repo first, then the site.** Reversed, production serves new markup against old CSS.

## Architecture

`scss/index.scss` forwards every partial. Load order matters — later partials can override earlier ones.

| Partial | Purpose |
|---|---|
| `_base.scss` | Tokens, reset, elevation mixins, body texture, cursor spotlight |
| `_chamfer.scss` | `@include chamfer` corner-cut geometry |
| `_typography.scss` | Type scale, `label-caps` mixin, font stacks |
| `_framework.scss` | Layout primitives, grid helpers |
| `_buttons.scss` | `.btn`, `.btn--ghost` |
| `_cards.scss` | Card layouts, stat cards, bib cards |
| `_nav-primary.scss` | Fixed top bar, wordmark, nav search |
| `_nav-secondary.scss` | Data-driven second-level nav (`_data/nav.yml`) |
| `_sidebar.scss` | Sidebar surfaces |
| `_sidebar-rail.scss` | Fixed icon rail (`--rail-w`, `--rail-top`) |
| `_footer.scss` | Footer |
| `_home.scss` | Home page: hero, stats, testimonials, cards |
| `_service.scss` | `page-*` page chrome, service detail, marble bands |
| `_essay.scss` | `post-*` prose reading layout |
| `_announcements.scss` | Announcement list and category colour coding |
| `_team.scss` | Team grid, hex portraits |
| `_cv.scss` | CV/resume |
| `_safety-exit.scss` | Quick-exit control for trauma content |
| `_design-system.scss` | Living style-guide page |

## Class Naming

| Prefix | Scope |
|---|---|
| `page-*` | Universal page chrome — hero, body, sections. Used by **every** layout, not just services. |
| `post-*` | Prose reading chrome — headers, body copy, meta, related. Shared across article and announcement layouts. |
| `svc-*` | **Genuinely service-specific only**: `svc-included`, `svc-item*`, `svc-pricing-*`, `svc-rate-principle`. |
| `card-*` | Card internals, shared between home and intake. |

`page-*` was renamed from `svc-*` on 2026-07-26 because the prefix had stopped being true — those classes had spread to 22 pages across every layout. If you find yourself using an `svc-` class outside `_services/`, rename it rather than spreading it further.

## Design Tokens

Defined on `:root` in `_base.scss`.

### Surfaces

All one navy family (hue ~223°) so the elevation ramp reads as the same material lifted rather than a different material.

```scss
--bg1: #0c101a       // page background
--bg-hero: #1e213e   // homepage + service hero
--bg2: #1a1d26       // card/surface
--bg3: #22262f       // elevated surface
--border: #30343e
--calloutbg: #252831
--shadow: #06080d
```

⚠ Surfaces were shifted from neutral grey into the navy family on 2026-07-26 at **matched luminance**, so every text-on-surface ratio moved by less than 0.15. The one deliberate exception is `--calloutbg`, darkened slightly: steel and amethyst sat at 4.57:1 on the old grey, barely over AA, and are now 4.69:1. Do not reintroduce neutral greys (`#1E1E1E`, `#252525`, `#333333`, `#2A2A2A`).

Worst case in the whole system is now **4.69:1** (steel/amethyst on `--calloutbg`). Anything you add must clear 4.5:1 against the surface it sits on.

### Luminance hierarchy

Every value passes WCAG AA on `--bg1`.

```scss
--bright: #FFFFFF    // 18.4:1
--text: #E8E4DC      // 14.5:1
--subdued: #B0AAA0   //  8.0:1  AAA for normal text
--muted: #999999     //  6.5:1  AA for normal text
```

### Accents

```scss
--gold: #C9A84C          --gold-dim: rgba(201, 168, 76, 0.35)
--gold-ghost: rgba(201, 168, 76, 0.12)
--gold-border: #b39f7b   // opaque, for visible 1px borders

--steel: #7F94A6         --steel-dim / -ghost: rgba(127, 148, 166, …)
--amethyst: #A284CA      --amethyst-dim / -ghost: rgba(162, 132, 202, …)
--sage: #6DA187          --sage-dim / -ghost: rgba(109, 161, 135, …)
--teal: #5DA19C          --teal-dim / -ghost: rgba(93, 161, 156, …)

--ruby: #ba6868          // timeline error/alert states only
--claude: #E8640A
```

⚠ The five accents were **raised on 2026-07-25 to clear WCAG AA on `--bg1`**. The old `--teal` (`#4a6b5f`) was a genuine 3.22:1 failure. Do not restore older, darker values.

⚠ Raising several accents at once can collapse them into each other. Original teal (158°) and sage (155°) were 3° apart and distinguished only by lightness. Replacements were chosen for ≥18° hue separation (teal 176°, sage 150°). Preserve that separation if you retune.

`--sapphire` and `--emerald` are legacy aliases of `--steel` / `--sage` with zero call sites. Use the real names.

## Accent Semantics

**This is not a six-accent palette.** Gold is the primary accent (211 call sites); the other four are situational and each carries one meaning per context. Never pick a non-gold accent for decoration.

| Accent | Announcement category | Dashboard audience | Other bound uses |
|---|---|---|---|
| gold (211) | Accountability | `--accent-gate` | Everything else: links, focus, borders, CTA, drop caps |
| amethyst (12) | AI | `--accent-pol` (policy) | `quiz.scss` ×8 |
| sage (10) | Psychopathology | `--accent-adv` (advocate) | `quiz.scss` correct-answer state ×6 |
| teal (9) | Institutional Betrayal | — | Logo hex frame, `_service.scss` ×5, `_sidebar.scss` |
| steel (5) | Technology | `--accent-inst` (institution) | `_home.scss:705` |

Category bindings live in `_announcements.scss:256-277`. Audience bindings live in the site's `assets/css/dashboard.scss:25-29`. `--accent-surv` (survivor) is a hardcoded `#c0392b`, outside this token set.

**Known drift:** `_announcements.scss:257, 272, 277` hardcode pre-2026-07-25 RGB triplets as `border-color` instead of referencing tokens. Cosmetic, but line 272 uses alpha `0.5` where `--teal-dim` is `0.35`, so it is not a clean find-and-replace.

## Elevation

Three mixins in `_base.scss`. Each combines a scallop SVG tile with a background colour. Darker = further back, brighter = further forward.

| Mixin | Tile | Stroke opacity |
|---|---|---|
| `@include elevation-recessed` | 12px | 0.08 |
| `@include elevation-standard` | 16px | 0.18 |
| `@include elevation-elevated` | 24px | 0.28 |

## Accessibility Invariants

Break these and the site regresses. They are not stylistic preferences.

- **`clip-path` clips both `outline` and `box-shadow`.** Anything with `@include chamfer` cannot show a normal focus ring. Use a thickened, high-contrast **border** instead. `.nav-search__input` carries a deliberate `outline: none` at `_nav-primary.scss:630` for exactly this reason, with the border replacement documented at line 640.
- **Every interactive element needs a visible focus indicator.** If a chamfered control appears to have none, that is a bug, not a design choice.
- **The cursor spotlight is gated twice** — the site's `main.js` skips the listener, and `_base.scss:409` hides `body::after` entirely under `prefers-reduced-motion`. Keep both gates.
- **`.rail-tx` uses `opacity: 0`, not `display: none`.** The labels stay in the accessibility tree so screen readers announce "Contact" and "Announcements". Switching to `display: none` or `visibility: hidden` would silently strip the rail's accessible names. The rail is icon-only *visually* by deliberate design decision; that is a usability tradeoff, not a conformance failure.
- **Any new accent must clear 4.5:1 on `--bg1`.**

## Typography

- **Lora** — serif, body and headings
- **Inter** — sans, UI and labels
- **JetBrains Mono** — code
- **Cormorant SC** — nav wordmark (`family=Cormorant+SC:wght@400;600;700`)

Loaded via Google Fonts CDN in the consuming site's `_layouts/default.html`, not by this package.

## License

MIT
