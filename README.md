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
| `_tokens.scss` | **Mixins only, emits no CSS.** The four theme mixins. `@use` it alone to reach them without pulling in the reset and `:root`. |
| `_base.scss` | `:root` scales, reset, elevation mixins, body texture, cursor spotlight. `@forward`s `_tokens.scss`. |
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

Scales live on `:root` in `_base.scss`. The themed colour sets live in `_tokens.scss` as mixins.

### Naming

Renamed to a numbered vocabulary on 2026-08-08. **Every ramp ascends, and ascending always means "more".**

| Ramp | Ascending means | Steps |
|---|---|---|
| `--surface-N` | further forward | 1–5 |
| `--line-N` | stronger | 1–4 |
| `--ink-N` | higher emphasis | 1–4 |
| `--space-N` | larger | 1–13 |
| `--fs-N` | larger | 1–11 |
| `--radius-N` | rounder | 1–5 |
| `--elev-N` | higher | 0–5 |

Two things sit deliberately outside the ramps because they are named decisions, not steps: `--surface-hero`, `--space-card`, `--space-band-lg`, `--radius-round`.

The old names (`--bg1`, `--text`, `--gold`, `--fs-base`, …) are **gone**, not aliased. 901 call sites were rewritten across both repos. If you are reading older notes, the map is: `bg1..3`/`calloutbg` → `surface-1..4`, `border` → `line-3`, `muted`/`subdued`/`text`/`bright` → `ink-1..4`, `gold*` → `mark*`, `fs-xs..xl` → `fs-1..6`, `fs-display-*` → `fs-7..11`.

### Surfaces

All one navy family (hue ~223°) so the elevation ramp reads as the same material lifted rather than a different material.

```scss
--surface-1: #0c101a   // page floor
--surface-2: #1a1d26   // card
--surface-3: #22262f   // elevated
--surface-4: #252831   // callout
--surface-5: #2b2f39   // top step — INK ONLY, see below
--surface-hero: #1e213e  // homepage + service hero, unconditional in both themes
--shadow: #06080d
```

⚠ Surfaces were shifted from neutral grey into the navy family on 2026-07-26 at **matched luminance**, so every text-on-surface ratio moved by less than 0.15. Do not reintroduce neutral greys (`#1E1E1E`, `#252525`, `#333333`, `#2A2A2A`).

⚠ **`--surface-5` carries ink only. Never put accent-coloured text on it.** The dark accent palette is at its contrast ceiling: `--steel` caps a 4.5:1 surface at luminance 0.02432, and `--surface-4` already sits at 0.02133. `--surface-5` spends the remaining headroom, so steel lands at 4.26:1, amethyst 4.27:1 and teal 4.49:1 there. The ink ramp clears 4.5:1 on all five steps. `scripts/check-contrast.mjs` encodes this: accents are asserted over surfaces 1–4, ink over 1–5. Lifting the restriction means lightening steel, amethyst and teal, which is a brand change.

Worst accent case is **4.69:1** (steel/amethyst on `--surface-4`). Anything you add must clear 4.5:1 against the surface it sits on.

### Lines

```scss
--line-1: #22262f   // quiet: row separators, cell borders
--line-2: #2b3038
--line-3: #30343e   // the default — this is the former single --border
--line-4: #3d424e   // assertive frame
```

### Light mode

Added 2026-08-06. Same navy-tinted character (hue ~223°). The ramp keeps the same **order** as dark, mirrored across the luminance midpoint: `--surface-1` is the page floor and the darkest, rising to `--surface-5` as the lightest. Elevation still means "brighter" in both themes, so the wash at the top of `elevation-elevated` stays a highlight instead of inverting into a dark band. `--surface-1` is therefore the worst-case backdrop for dark-on-light text.

```scss
--surface-1: #E7EAF0  --surface-2: #EFF1F5  --surface-3: #F5F7FA
--surface-4: #FCFDFE  --surface-5: #FFFFFF  --shadow: rgba(28, 32, 41, 0.18)

--line-1: #E1E4EC  --line-2: #D4D8E2  --line-3: #C7CBD6  --line-4: #B3B8C6

--ink-4: #1C2029  // 13.53:1 on --surface-1
--ink-3: #34394A  //  9.52:1
--ink-2: #3D4353  //  8.20:1  AAA
--ink-1: #535971  //  5.74:1

--mark: #7A6028      --steel: #4A5A68      --amethyst: #6B4F94
--sage: #38624C      --teal: #295F5A       --mark-border: #8A7550 (3.68:1, non-text)

--ruby: #8A3E3E    //  6.14:1 on --surface-1
--claude: #A34608  //  5.07:1 on --surface-1
```

`--ruby` and `--claude` have zero call sites in light-themed markup today. They are given real passing values anyway so the palette stays complete if one is ever used.

There is no light `--surface-hero`. Both heroes are dark islands, so they keep the dark `#1e213e` in every theme; overriding it would only take effect somewhere it is never read.

Default is dark. Two mechanisms bring in light:

1. **OS preference, no explicit choice.** `@media (prefers-color-scheme: light) { :root:not([data-theme="dark"]) { ... } }`.
2. **Explicit choice**, set by the rail toggle and persisted to `localStorage`. `:root[data-theme="light"] { ... }`.

`@include light-mode { ... }` (defined in `_base.scss`) wraps `@content` in both selectors — use it for any non-token effect (shadows, gradients, textures) that needs to flip.

⚠ **Marble surfaces are dark islands in both themes.** Nav, footer, rail, `.page-toc`, service hero, marble bands, and section headers all call `@include dark-island;`, which forces the full dark token set regardless of the active theme. Do not let a light-mode rule reach inside one of these — if a new component needs to sit on a marble surface, wrap it in `dark-island` too, or its text will inherit light-theme tokens against a dark background and become unreadable.

### Ink

Ratios are given on `--surface-1` (the page floor) and on `--surface-5` (the worst case).

```scss
--ink-4: #FFFFFF   // 19.01:1 on --surface-1  ·  13.39:1 on --surface-5
--ink-3: #E8E4DC   // 14.99:1  ·  10.56:1   — body copy
--ink-2: #B0AAA0   //  8.24:1  ·   5.80:1   — AAA on the floor, AA at the top
--ink-1: #999999   //  6.67:1  ·   4.70:1
```

### Accents

```scss
--mark: #b39f7b          --mark-dim: rgba(201, 168, 76, 0.35)
--mark-ghost: rgba(201, 168, 76, 0.12)
--mark-border: #b39f7b   // opaque, for visible 1px borders

--steel: #7F94A6         --steel-dim / -ghost: rgba(127, 148, 166, …)
--amethyst: #A284CA      --amethyst-dim / -ghost: rgba(162, 132, 202, …)
--sage: #6DA187          --sage-dim / -ghost: rgba(109, 161, 135, …)
--teal: #5DA19C          --teal-dim / -ghost: rgba(93, 161, 156, …)

--ruby: #ba6868          // timeline error/alert states only
--claude: #E8640A
```

**Known drift, unfixed:** `--mark-dim` and `--mark-ghost` are still `rgba(201, 168, 76, …)`, which is the pre-2026-07-25 `#C9A84C`. They were not updated when the primary darkened to `#b39f7b`, so the dim and ghost variants are a slightly different hue from the solid. `--mark` and `--mark-border` are now the same value, which makes `--mark-border` redundant; it is kept because 40 call sites read it and the two may diverge again.

⚠ The five accents were **raised on 2026-07-25 to clear WCAG AA**. The old `--teal` (`#4a6b5f`) was a genuine 3.22:1 failure. Do not restore older, darker values.

⚠ Raising several accents at once can collapse them into each other. Original teal (158°) and sage (155°) were 3° apart and distinguished only by lightness. Replacements were chosen for ≥18° hue separation (teal 176°, sage 150°). Preserve that separation if you retune.

`--sapphire` and `--emerald` are legacy aliases of `--steel` / `--sage` with zero call sites. Use the real names.

#### `--accent-1..5` exist, but you almost certainly want the semantic name

```scss
--accent-1: var(--mark);   --accent-2: var(--amethyst);  --accent-3: var(--sage);
--accent-4: var(--teal);   --accent-5: var(--steel);
```

Ordered by call-site prominence. They exist so the numbered vocabulary is complete, **not** because the accents form a ramp. This is a categorical set: each accent is bound to one meaning per context (see below), and a number implies an interchangeability this palette does not have. Reach for `--accent-N` only when you genuinely mean "the nth swatch", such as on the specimen page. Everywhere else, name the meaning.

### Spacing, radius, elevation

Added 2026-08-08 alongside the rename. All three were derived from an audit of the literals already in the codebase, not from a generic grid.

```scss
--space-1..13:  0.25 0.375 0.5 0.75 1 1.25 1.5 2 2.5 3 4 6 8  (rem)
--space-card: 1.4rem     --space-band-lg: 3.5rem

--radius-1..5:  2px 3px 4px 8px 20px     --radius-round: 50%

--elev-0: none                --elev-1: 0 1px 3px var(--shadow)
--elev-2: 0 2px 8px …         --elev-3: 0 2px 12px …
--elev-4: 0 4px 16px …        --elev-5: 0 24px 60px …
```

- **Spacing** covered 719 literals. The ten values the system actually leaned on are present at their exact former size, so most of the migration was a pure rename. The rest snapped under a rule of **no more than 0.25rem and no more than 25% of movement**; 16 sites failed that test and were left as literals rather than silently resized.
- **Radius** is in px on purpose. A corner radius is a fixed optical detail, not rhythm, so it should not scale with the root font the way `--space-*` does. 2/3/4px account for 54 of the 65 sites, which is why the low end steps one pixel at a time.
- **Elevation** puts shadow on the shadow scale and lightness on the surface scale, per Material's rule that lightness carries elevation in dark mode and shadow carries it in light. `--shadow` is themed, so all six re-resolve per palette. Pair `--elev-N` with the matching `--surface-N`.

### Everything else on `:root`

```scss
--lh-1..4:   1 · 1.35 · 1.75 (body) · 1.85
--fw-1..4:   300 · 400 · 500 · 700
--f-1..5:    1 · 1.25 · 1.563 · 1.953 · 2.441   // modular scale ratios, unitless
--measure:   68ch                                // readable prose column
--font-body / --font-sans / --font-mono          // custom-property mirrors of the SCSS vars
```

`--font-mono` replaced a bare `'JetBrains Mono', monospace` repeated at 53 call sites and adds the `ui-monospace, SFMono-Regular, Menlo` fallback chain those sites lacked.

## Accent Semantics

**This is not a six-accent palette.** `--mark` is the primary accent (211 call sites); the other four are situational and each carries one meaning per context. Never pick a non-`--mark` accent for decoration.

| Accent | Announcement category | Dashboard audience | Other bound uses |
|---|---|---|---|
| `--mark` (211) | Accountability | `--accent-gate` | Everything else: links, focus, borders, CTA, drop caps |
| `--amethyst` (12) | AI | `--accent-pol` (policy) | `quiz.scss` ×8 |
| `--sage` (10) | Psychopathology | `--accent-adv` (advocate) | `quiz.scss` correct-answer state ×6 |
| `--teal` (9) | Institutional Betrayal | — | Logo hex frame, `_service.scss` ×5, `_sidebar.scss` |
| `--steel` (5) | Technology | `--accent-inst` (institution) | `_home.scss:705` |

Category bindings live in `_announcements.scss:256-277`. Audience bindings live in the site's `assets/css/dashboard.scss:25-29`. `--accent-surv` (survivor) is a hardcoded `#c0392b`, outside this token set.

**Known drift:** `_announcements.scss:257, 272, 277` hardcode pre-2026-07-25 RGB triplets as `border-color` instead of referencing tokens. Cosmetic, but line 272 uses alpha `0.5` where `--teal-dim` is `0.35`, so it is not a clean find-and-replace.

## Elevation

Three mixins in `_base.scss`. Each combines a scallop SVG tile with a background colour, and paints its shadow from the `--elev-*` scale above. Darker = further back, brighter = further forward. Each also has a `-dark` variant (`elevation-recessed-dark`, etc.) that never flips — use those on marble/chrome islands, the plain names on content that should theme normally.

| Mixin | Tile | Stroke opacity (dark / light) |
|---|---|---|
| `@include elevation-recessed` | 12px | 0.076 / 0.12 |
| `@include elevation-standard` | 16px | 0.09 / 0.14 |
| `@include elevation-elevated` | 24px | 0.10 / 0.16 |

## Theme Mixins

| Mixin | Purpose |
|---|---|
| `dark-tokens` | Full dark custom-property set. Loaded unconditionally on `:root`. |
| `light-tokens` | Full light custom-property set. Loaded under the two override selectors described above. |
| `light-mode { @content }` | Wraps `@content` in both light override selectors, scoped to `&`. |
| `dark-island` | `dark-tokens` plus an explicit `color: var(--ink-3)`. Forces dark regardless of theme — use on marble/chrome surfaces. |

All four live in `_tokens.scss`, which **emits no CSS of its own**. That is the whole point: a stylesheet can `@use "@ouroboros-consulting/ouroboros-design/scss/tokens" as *;` to reach them without also pulling in the reset, the `:root` scales, and the `body` rule. `_base.scss` `@forward`s it, so `@use "base" as *` still reaches everything and no existing import had to change.

The site's `dashboard.scss`, `quiz.scss` and `intake.scss` each used to hand-copy a 30-token dark set for exactly that reason, and the copies had drifted — all three still carried `--gold: #C9A84C` long after the package moved it to `#b39f7b`. They are now one `@include dark-island;` apiece, so that class of bug cannot recur.

`dark-island` pins `color` as well as the tokens because `color` is **inherited**: without the pin, any descendant that sets no `color` of its own would inherit light-theme ink from `body` and render dark text on the dark island.

## Accessibility Invariants

Break these and the site regresses. They are not stylistic preferences.

- **`clip-path` clips both `outline` and `box-shadow`.** Anything with `@include chamfer` cannot show a normal focus ring. Use a thickened, high-contrast **border** instead. `.nav-search__input` carries a deliberate `outline: none` at `_nav-primary.scss:630` for exactly this reason, with the border replacement documented at line 640.
- **Every interactive element needs a visible focus indicator.** If a chamfered control appears to have none, that is a bug, not a design choice.
- **The cursor spotlight is gated twice** — the site's `main.js` skips the listener, and `_base.scss:409` hides `body::after` entirely under `prefers-reduced-motion`. Keep both gates.
- **`.rail-tx` uses `opacity: 0`, not `display: none`.** The labels stay in the accessibility tree so screen readers announce "Contact" and "Announcements". Switching to `display: none` or `visibility: hidden` would silently strip the rail's accessible names. The rail is icon-only *visually* by deliberate design decision; that is a usability tradeoff, not a conformance failure.
- **Any new accent must clear 4.5:1 on `--surface-4`**, the worst case it is allowed to sit on. `--surface-5` is ink-only; see Surfaces.
- **Marble surfaces are dark islands in both themes.** `@include dark-island;` on any new marble/chrome surface — see Light mode above.
- **Reach for a token before a literal.** Colour, spacing, radius, elevation, line-height, weight and font stack all have scales. A literal is a claim that none of the steps fit; if that is true, add a named exception (as `--space-card` and `--radius-round` are) rather than an anonymous number. This is what keeps a theme flip from having to chase hardcoded values.

## Typography

- **Lora** — serif, body and headings (`--font-body`)
- **Inter** — sans, UI and labels (`--font-sans`)
- **JetBrains Mono** — code (`--font-mono`, which carries the `ui-monospace, SFMono-Regular, Menlo` fallback chain)
- **Cormorant SC** — nav wordmark (`family=Cormorant+SC:wght@400;600;700`)

Loaded via Google Fonts CDN in the consuming site's `_layouts/default.html`, not by this package.

Sizes are `--fs-1..11`. Steps 1–6 are the text range and 7–11 the display range:

| | 1 | 2 | 3 | 4 | 5 | 6 |
|---|---|---|---|---|---|---|
| **rem** | 0.8 | 0.9 | 1 | 1.2 | 1.4 | 1.6 |

Steps 7–11 are all `clamp()`ed and fluid: `--fs-7` 1.2→1.45, `--fs-8` 1.5→2.1, `--fs-9` 2→3, `--fs-10` 2.4→4, `--fs-11` 3.5→8.

## License

MIT
