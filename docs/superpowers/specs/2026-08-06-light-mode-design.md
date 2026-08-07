# Light Mode — Design Spec

**Date:** 2026-08-06
**Repos:** `ouroboros-design` (primary), `OUROBOROS-Consulting.github.io` (secondary)
**Status:** Approved, pending implementation plan

## Goal

Give readers a genuine light theme. The driving constraint is accessibility: some senior
citizens cannot read light-on-dark text comfortably. The current system is dark only, with
`color-scheme: dark` hardcoded and no light path at any layer.

### Rejected framing

The original request was "make `--bg1` 10% lighter in light mode." That was rejected as
insufficient, not as wrong. `#0c101a` lightened 10% is roughly `#0d121c`: still near-black,
visually indistinguishable, and of no help to a reader who needs a light background. The
approved scope is a full second palette.

## Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Scope | Full light theme | A lifted dark floor does not serve the stated audience |
| Switching | `prefers-color-scheme` default + explicit toggle | Seniors often have never touched an OS appearance setting; a visible control is the accessible path |
| Toggle placement | New item in the left rail | The rail is an existing icon toolbar with an established item pattern. Additive, not a redesign. Visible without scrolling |
| Palette character | Cool navy-tinted, hue ~223° | Preserves the one-material invariant from the README. Light mode reads as the same system, not a second one |
| Contrast target | AAA (7:1) for `--text` and `--subdued`; AA (4.5:1) elsewhere | Strongest service of the accessibility goal without flattening the four-step luminance ramp |
| Effects | Re-tuned for light, not dropped | Light mode must be a peer of dark, not a lesser fallback |
| Marble surfaces | Permanently dark in both themes, text included | Marble.png is black stone. No light variant exists or will be invented |
| CI preview | Repaired as part of this work | Two palettes and four re-tuned texture mixins cannot be verified by reading a diff |

## Architecture

### Token layering

Dark remains the default in `:root`. Light is an override applied through two selectors that
share one definition:

```scss
@mixin light-tokens {
  color-scheme: light;
  // ~30 token values
}

@media (prefers-color-scheme: light) {
  :root:not([data-theme="dark"]) { @include light-tokens; }
}
:root[data-theme="light"] { @include light-tokens; }
```

- No `data-theme` attribute → follow the OS.
- `data-theme="light"` or `"dark"` → explicit reader choice, wins over the OS.

`_base.scss:15` changes from `color-scheme: dark` to `color-scheme: light dark`, with each
theme block asserting its own value. The adjacent comment ("The system has no light mode")
is rewritten, not left stale.

### The elevation ramp does not restructure

`--bg1` remains the page floor. `--calloutbg` remains the most elevated surface. Only the
direction of luminance flips: in dark, elevated means lighter; in light, elevated means
closer to white. Every partial that consumes these tokens through `var()` is therefore correct
in both themes with no edit.

What is *not* free is the SCSS that hardcodes color instead of referencing a token. See
"Chrome tokenization" below: 42 such values exist across 8 partials, and most of them are
structural dark-mode assumptions rather than decoration.

## Palette

Ratios are worst case, measured against `--calloutbg` (`#FCFDFE`, the lightest light-mode
surface). This mirrors the methodology the README already applies to the dark ramp.

### Surfaces

| Token | Dark | Light |
|---|---|---|
| `--bg1` | `#0c101a` | `#E7EAF0` |
| `--bg-hero` | `#1e213e` | `#DDE2ED` |
| `--bg2` | `#1a1d26` | `#EFF1F5` |
| `--bg3` | `#22262f` | `#F5F7FA` |
| `--calloutbg` | `#252831` | `#FCFDFE` |
| `--border` | `#30343e` | `#C9CFDA` |
| `--shadow` | `#06080d` | `rgba(28, 32, 41, 0.12)` |

`--shadow` changes from an opaque hex to an rgba. It is consumed only inside `box-shadow`
declarations, where both forms are valid, so no call site changes.

### Text

| Token | Dark | Light | Light ratio | Level |
|---|---|---|---|---|
| `--bright` | `#FFFFFF` | `#0A0D14` | ~19:1 | AAA |
| `--text` | `#E8E4DC` | `#1C2029` | 15.9:1 | AAA |
| `--subdued` | `#B0AAA0` | `#4A5160` | 7.8:1 | AAA |
| `--muted` | `#999999` | `#5E6675` | 5.6:1 | AA |

`--muted` lands at AA rather than AAA. This is deliberate and symmetric with dark mode, where
`--muted` is likewise the single token at AA (5.2:1). The approved contrast decision scoped
AAA to body text and subdued text only.

### Accents

All five accents fail on a light surface at their current values (gold 2.29:1, steel 3.14:1,
the rest ~3.2:1). Each gets a darkened light-mode variant targeting ≥4.5:1.

| Token | Dark | Light (target) | Light ratio |
|---|---|---|---|
| `--gold` | `#C9A84C` | `#8A6E2E` | 4.7:1 |
| `--steel` | `#7F94A6` | `#4F6273` | 6.2:1 |
| `--amethyst` | `#A284CA` | `#6B4E96` | 6.5:1 |
| `--sage` | `#6DA187` | `#3D6B54` | 6.0:1 |
| `--teal` | `#5DA19C` | `#2F6B67` | 6.0:1 |
| `--ruby` | `#ba6868` | `#8E3A3A` | 7.3:1 |
| `--gold-border` | `#b39f7b` | `#8A7A55` | ≥3:1 (non-text) |
| `--claude` | `#E8640A` | `#A34606` | 6.0:1 |

These are computed starting points, not final. The verification script (below) confirms or
adjusts each one. No value ships on the strength of having been eyeballed.

The `-dim` (0.35 alpha) and `-ghost` (0.12 alpha) variants re-derive from the new light base at
the same alphas. They remain decorative-only; `--gold-border` stays the opaque token for
visible 1px borders, preserving the existing structure.

`--sapphire` and `--emerald` are aliases (`var(--steel)`, `var(--sage)`) and inherit the flip
for free.

## Dark islands

**Every surface backed by `Marble.png` stays dark in both themes, text included.** The marble
is black stone; a light treatment of it does not exist and will not be invented.

### The seven islands

| Surface | Declared in |
|---|---|
| Primary navbar | `main.scss:96`, `_nav-primary.scss:36` |
| Secondary navbar | `main.scss:96`, `_nav-secondary.scss` |
| Footer | `_footer.scss` |
| Section headers (all pages) | `main.scss:138` |
| Service hero | `main.scss:81`, `_service.scss` `.page-hero-*` |
| Marble header bands | `_service.scss:428` `marble-band` mixin, `_home.scss:274` |
| Sidebar / rail | `_sidebar.scss:6`, `_sidebar-rail.scss` |
| Intake page | `intake.scss:18` (site repo) |

The homepage `#hero` also counts: it carries a dimmed marble watermark (`main.scss:201`) over
`#0C0E20`.

### Mechanism

Custom properties cascade, so an island re-declares the dark token values on its own root
selector and every descendant inherits correctly. No per-property edits.

```scss
@mixin dark-island {
  --bg1: #0c101a;  --bg2: #1a1d26;  --bg3: #22262f;
  --calloutbg: #252831;  --border: #30343e;  --shadow: #06080d;
  --bright: #FFFFFF;  --text: #E8E4DC;  --subdued: #B0AAA0;  --muted: #999999;
  --gold: #C9A84C;  --steel: #7F94A6;  --amethyst: #A284CA;
  --sage: #6DA187;  --teal: #5DA19C;  --ruby: #ba6868;
  --gold-border: #b39f7b;  --claude: #E8640A;
  color-scheme: dark;
}
```

Applied unconditionally, not only inside a light-mode branch. In dark mode it is a no-op; in
light mode it protects the island. Idempotent, so it cannot drift out of sync with the theme
blocks.

The dark values must be authored once and shared between `:root` and `dark-island` (a SCSS map
or a `dark-tokens` mixin) so they cannot diverge. Two hand-maintained copies of 18 hex values
is a defect waiting to happen.

### Consequence for the hardcoded values

The 42 hardcoded colors were the reason chrome tokenization looked necessary. Under the
dark-island model, almost none of them need to change:

| Disposition | Count | Detail |
|---|---|---|
| On a dark island, leave untouched | 39 | All of `_nav-primary`, `_nav-secondary`, `_footer`, `_sidebar-rail`, plus `.page-hero-*`, `#hero`, `.hero-emblem`, and both `marble-band` sites |
| Theme-independent, leave untouched | 2 | `.exit-bar__btn` (`_framework.scss:122,124`): white on `#8b1a1a` is 9.3:1 and reads correctly on any background. A survivor-facing safety control should look identical in both themes |
| Needs a light value | 1 | `.safety-exit` box-shadow (`_safety-exit.scss:27`), `rgba(8,8,8,0.55)`. A hard black shadow is too heavy on a light page |

No new chrome tokens. No scrim inversion. No light marble variant.

### Pre-existing drift, not fixed here

`#141414`, `#0e0e0e`, and `#0D0D0D` in the chrome are **neutral greys**, which non-negotiable #3
says must never be reintroduced. The 2026-07-26 navy migration missed them.

This spec does not fix that. Under the dark-island model those values never flip, so the drift
does not affect light mode, and correcting it would be an unrelated visible change to dark
mode. Recorded here so it is not lost. Separate PR if you want it.

## Effects re-tuning

Four things assume a dark floor.

### 1. Textures (the constrained one)

`scallop-recessed`, `scallop-standard`, `scallop-elevated`, and `snakeskin` compile gold
strokes into SVG data URIs. A data URI cannot read a CSS custom property at runtime, so these
cannot flip via tokens.

Fix at the mixin, not the call site. A shared helper emits both selector forms:

```scss
@mixin light-mode {
  @media (prefers-color-scheme: light) {
    :root:not([data-theme="dark"]) & { @content; }
  }
  :root[data-theme="light"] & { @content; }
}
```

Each texture mixin gains a nested `@include light-mode { background-image: /* darkened
stroke, raised opacity */ }`.

**Dark islands must opt out.** `:root[data-theme="light"] .card` (0,2,1) outranks a
`.nav-menu .card` island rule (0,2,0), so an auto-flipping mixin would repaint a texture that
sits on black marble. Rather than fight specificity with `:not()` chains, split the mixins:

- `snakeskin` / `scallop-*` — emits dark plus the light override. Content surfaces.
- `snakeskin-dark` / `scallop-*-dark` — emits the dark data URI only, never flips. Island
  surfaces.

Each of the 15 call sites is classified during implementation. `_nav-primary.scss` and
`_footer.scss` take the `-dark` variants; `_cards.scss`, `_framework.scss`, and
`_design-system.scss` take the flipping ones; `_service.scss` and `_home.scss` are mixed and
need per-rule inspection.

Stroke opacity must rise in light mode. The dark values (0.076 / 0.09 / 0.10) were tuned for a
light stroke on a dark ground; a dark stroke at 0.10 on near-white is invisible. Target
equivalent perceptual weight, validated by eye against the preview build.

**Cost:** this roughly doubles the emitted CSS for those 15 rules, and data URIs are bulky.
CI already reports `dist/ouroboros.css` size on every run. Record the before and after in the
implementation plan.

### 2. Vignette

`body::after` uses `rgba(8, 8, 8, 0.35)`. On a light page that reads as dirt. Light mode uses a
cool edge at roughly `rgba(60, 72, 96, 0.10)`.

### 3. Cursor spotlight

Gold at 0.06 / 0.03 alpha is invisible on near-white. Light mode uses the darkened gold at
comparable low alpha.

### 4. Inset highlight

`elevation-elevated` carries `0 1px 0 rgba(255, 255, 255, 0.04) inset`, a top-light that reads
as nothing on a light card. Light mode flips it to a subtle dark bottom-inset so elevation
still reads as lit from above.

## Toggle

### Behavior

Two states, not three. "Auto" is the initial condition before any choice has been made; once
the reader picks, the control flips between light and dark. A three-way cycle is a usability
tax on precisely the audience this feature exists for.

### Markup

A new `.rail-item` in `_includes/nav.html`, following the existing rail item pattern. Carries a
`.rail-tx` label like every other item (present in markup, visually hidden) plus an
`aria-label` that JS keeps in sync with the action the button will perform.

### Flash prevention

A synchronous inline script in the `<head>` of `_layouts/default.html`, before any stylesheet,
reads `localStorage` and stamps `data-theme` on `<html>`.

This is not optional. Without it, every reader who has chosen light gets a dark flash on every
page load. For a reader who chose light *because* dark is hard on their eyes, that is the worst
possible first impression. It must be inline and blocking; a deferred or external script is
too late.

### Persistence

`localStorage`, single key. Toggle logic lives in `assets/js/main.js` alongside the existing
rail and nav behavior.

## Verification

CI currently compiles SCSS and reports file size. Nothing guards contrast. After this change
there are two palettes making explicit AAA and AA claims, and the README notes that
accessibility values have regressed before.

Add `npm run check:contrast`: a Node script that parses both token sets out of the compiled
CSS, computes WCAG relative luminance and contrast ratios, and exits non-zero if any token
drops below its declared floor. Wire it into the existing `build` CI job.

This is the only new tooling in the plan. It is what turns the ratios in this document from
comments into assertions.

## CI preview repair

### Actual state

| Finding | Evidence |
|---|---|
| Job builds with Hugo | `ci.yml` uses `peaceiris/actions-hugo`, `hugo --minify` |
| Site is Jekyll 4.3 | `Gemfile`, and `package.json` → `bundle exec jekyll build` |
| No `gh-pages` branch exists | branches are `main`, `typography-scale`, two `claude/*` |
| Pages serves from `main` at `/` | `gh api .../pages` → `"source":{"branch":"main","path":"/"}` |
| Preview has never run | every recent run is 13-30s on `push`, the compile job alone |

Even with Hugo fixed, the job would push to a branch nothing serves. The preview URL would 404.

The repo *name* in `ci.yml` (`OUROBOROS-Consulting/OUROBOROS.github.io`) is correct. The local
working directory is named `OUROBOROS-Consulting.github.io`, which does not match the remote.

### Repairs

1. **Replace Hugo with Ruby/Jekyll**, mirroring the site's own known-good
   `jekyll-gh-pages.yml`: `ruby/setup-ruby@v1`, `ruby-version: "3.3"`, `bundler-cache: true`.
2. **Drop the `npm pack` tarball.** The site declares
   `"@ouroboros-consulting/ouroboros-design": "file:../ouroboros-design"`. Check the design
   repo out to path `ouroboros-design` and the site to `site`, exactly as the site's own
   workflow does, and plain `npm install` resolves the PR's CSS directly.
3. **Delete the `check-pat` job and the `WEBSITE_PAT` dependency.** Both repos are public, so
   checkout needs no token, and the job deploys to the design repo's own `gh-pages` using the
   built-in `GITHUB_TOKEN` with `contents: write`.
4. **Build with a baseurl:**
   `bundle exec jekyll build --baseurl "/ouroboros-design/preview/pr-N"`. The site uses
   `relative_url` filters (confirmed in `_includes/nav.html`), so baseurl is respected.
5. **Switch Pages source to `gh-pages`.** Approved. The design repo has no `index.html`, so
   `main` currently renders only `README.md` at the Pages URL. Nothing of value is lost.

The `cleanup` job on PR close stays, minus its PAT dependency.

## Cross-repo split and deploy order

**`ouroboros-design` — push first.**

- `dark-tokens` / `light-tokens` mixins and the two override blocks
- `light-mode` helper mixin
- `dark-island` mixin, applied to the seven island surfaces
- Texture mixins split into flipping and `-dark` variants; 15 call sites classified
- Vignette, spotlight, inset highlight, `.safety-exit` shadow
- Rail toggle button styling
- `check:contrast` script and CI wiring
- CI preview repair
- README updates: light palette table, the two-selector pattern, the new non-negotiable

**`OUROBOROS-Consulting.github.io` — push second.**

- Rail toggle item in `_includes/nav.html`
- Blocking theme script in `<head>` of `_layouts/default.html`
- Toggle logic in `assets/js/main.js`
- `@include dark-island` on the marble surfaces declared here: navbars (`main.scss:96`),
  section headers (`main.scss:138`), service hero (`main.scss:81`), hero watermark
  (`main.scss:201`), intake (`intake.scss:18`)
- Audit of the 67 hardcoded color values in the site's own SCSS. Expect most to sit on marble
  surfaces and need no change, mirroring the 39-of-42 result in the design repo.
  `dashboard.scss` and `quiz.scss` are the likely exceptions, being content-heavy

Order is mandatory. The site's workflow re-checks-out the design repo with no `ref:`, so CI
always pulls the design repo's default branch. Reversed order serves new markup against old CSS.

## Out of scope

- Any redesign of the navbar or hero beyond adding one rail item
- A light variant of `Marble.png`. Marble surfaces are dark islands in both themes
- The neutral-grey chrome drift (`#141414`, `#0e0e0e`, `#0D0D0D`). Recorded above, separate PR
- The `.ruby-version` file is empty in the site repo; not touched here
- Print stylesheet
- Per-page or per-section theme overrides beyond the dark-island mixin

## Risks

| Risk | Mitigation |
|---|---|
| Light-mode pages show full-width black bands at every section header | Accepted by design. This is the approved look, not a defect. Confirm against the preview |
| Island boundaries are visually abrupt where a dark header meets a light body | Inspect the seams in preview: section header edges, nav underside, footer top. May need a transition rule |
| `dark-island` duplicates 18 token values that could drift from `:root` | Author once in a shared `dark-tokens` mixin; both consume it. Never two literal copies |
| A texture call site is given the wrong mixin variant, flipping on marble | Enumerate all 15 in the plan with an explicit variant per site. Visual check in preview |
| Doubling texture CSS inflates bundle size | CI reports size on every run; record before/after |
| Toggle sits in markup owned by `_includes/nav.html`, adjacent to locked navbar | Additive only. No changes to existing nav structure |
| `logo.svg` was authored for a dark ground | It sits in the navbar, which is an island. No exposure |

## Success criteria

1. `npm run check:contrast` passes for both palettes.
2. `prefers-color-scheme: light` with no stored choice renders the light theme.
3. The rail toggle flips themes and survives a page reload.
4. No flash of the wrong theme on load in either direction.
5. A PR against `ouroboros-design` posts a working preview link that renders the Jekyll site.
6. Every text and accent token meets its declared level on the lightest surface.
7. In light mode, all seven island surfaces render identically to dark mode: same marble, same
   scrim, same text colors, same texture. Verified by screenshot comparison.
8. No texture on an island flips. No texture on a content surface fails to flip.
9. `dist/ouroboros.css` size change is recorded and accepted.

## Needs Apostolos

- **Switch GitHub Pages source** on `ouroboros-design` from `main` to `gh-pages`. Doable via
  `gh api` with admin rights, or through Settings → Pages. Blocks success criterion 5.
- **Visual sign-off** on the light palette against a rendered preview. Contrast math is
  automatable; whether it looks like OUROBOROS is not. Pay particular attention to the island
  seams: black section headers against a light page body is the single biggest visual change
  and the hardest thing to judge from a spec.
