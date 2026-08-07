# OUROBOROS Light Mode Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an explicit light theme to the OUROBOROS design system that defaults to the visitor's OS preference, can be toggled and persisted, keeps all seven "dark island" marble/chrome surfaces visually identical in both themes, and is enforced by an automated WCAG contrast checker in CI.

**Architecture:** Two Sass mixins (`dark-tokens`, `light-tokens`) hold the full custom-property palette for each theme. `:root` loads `dark-tokens` unconditionally as the baseline. A `prefers-color-scheme: light` media query wrapped in `:root:not([data-theme="dark"])` applies `light-tokens` when the OS prefers light and the visitor hasn't explicitly chosen dark; `:root[data-theme="light"]` applies it unconditionally when the visitor has explicitly chosen light. A third mixin, `light-mode`, gives non-token effects (textures, shadows, vignette) the same two-selector override pattern. A fourth, `dark-island`, is a trivial wrapper around `dark-tokens` used on marble/chrome surfaces so they never inherit light values regardless of nesting. A blocking inline script in the site's `<head>` reads `localStorage` and sets `data-theme` before first paint, avoiding a flash of the wrong theme.

**Tech Stack:** Dart Sass (`sass` npm package, `^1.77.0`), vanilla JS (no framework), GitHub Actions, Node.js (contrast checker script, ESM).

## Global Constraints

- **Push `ouroboros-design` before `OUROBOROS-Consulting.github.io`.** The site's CI checks out this repo's default branch with no `ref:`. Tasks 1–7 (design repo) must be committed, merged to `main`, and pushed before any of Tasks 8–9 (site repo) begin. Task 10 verifies this order held.
- **Never redefine design tokens in the consuming site.** `dashboard.scss` is the one file that must duplicate token *values* (it has no `@use` of this package — see Task 9), and even there it must copy the literal values this plan defines, not invent new ones.
- **Never restore pre-2026-07-25 accent values or pre-2026-07-26 neutral-grey surfaces.** Both were deliberate accessibility fixes documented in `README.md`. The light palette this plan adds is new — it does not touch the existing dark values at all.
- **The navbar and hero are locked** by user direction. This plan touches their *background/texture rendering* (dark-island wrapping, scallop-dark texture) but not their layout, markup, or visual structure. If any step here would change what the navbar or hero *look like* in dark mode, stop — that step is wrong.
- **Never use bare element selectors** (`header {}`, `nav {}`) for *new* rules — the site is multi-layout. Adding `@include dark-island;` inside the *existing* `nav {}` block in `_nav-primary.scss` is not a new bare selector and is fine.
- **`assets/js/toc.js` in the site repo queries `section.page-section[id]` and `.page-section-label p`.** No task in this plan renames those selectors, but if a future edit touches them, that file must be checked.
- **Marble.png tiles at exactly two sizes site-wide: 380px and 720px.** No task in this plan changes tile sizes. Do not invent a third.
- **A green CI run is not proof of production.** Task 10 curls the live CSS.

---

## Task 1: Contrast checker + token layering

**Files:**
- Create: `/Users/apostolos/Claude/Code/OUROBOROS/ouroboros-design/scripts/check-contrast.mjs`
- Modify: `/Users/apostolos/Claude/Code/OUROBOROS/ouroboros-design/package.json`
- Modify: `/Users/apostolos/Claude/Code/OUROBOROS/ouroboros-design/scss/_base.scss:11-91`
- Modify: `/Users/apostolos/Claude/Code/OUROBOROS/ouroboros-design/.github/workflows/ci.yml`

**Interfaces:**
- Produces (consumed by Tasks 2–5): Sass mixins `dark-tokens`, `light-tokens`, `light-mode`, `dark-island`, all defined in `_base.scss` before line 100, all with no required arguments.
  - `dark-tokens` — outputs every dark-theme custom property declaration (surfaces, luminance ink, five accents + dim/ghost, ruby/claude).
  - `light-tokens` — outputs the same property names with light-theme values.
  - `light-mode { @content }` — wraps `@content` in the two override selectors (`@media (prefers-color-scheme: light) { :root:not([data-theme="dark"]) & { @content } }` and `:root[data-theme="light"] & { @content }`).
  - `dark-island` — `@include dark-tokens;` verbatim. Used on marble/chrome surfaces so descendants never see light values.
- Produces (consumed by Task 6): npm script `check:contrast` in `package.json`.
- Consumes: nothing from earlier tasks (this is the first task).

### Step 1: Verify Dart Sass compressed-output quoting (do not assume)

The checker below matches `:root[data-theme="light"]{...}` in compiled CSS with a regex. Compressed Sass output may or may not keep the quotes around the attribute value — verify it directly rather than guessing.

Run:
```bash
cd /Users/apostolos/Claude/Code/OUROBOROS/ouroboros-design
mkdir -p /tmp/light-mode-probe
printf '%s' '@media (prefers-color-scheme: light) { :root:not([data-theme="dark"]) { color: red; } } :root[data-theme="light"] { color: blue; --gold: #7A6028; }' > /tmp/light-mode-probe/probe.scss
npx sass /tmp/light-mode-probe/probe.scss --style=compressed
```

Expected output (one line):
```
@media(prefers-color-scheme: light){:root:not([data-theme=dark]){color:red}}:root[data-theme=light]{color:blue;--gold: #7A6028}
```

This confirms Dart Sass **strips quotes** from attribute-selector values in compressed output (`[data-theme=light]`, not `[data-theme="light"]`). The checker's regex in Step 2 uses `["']?` (an optional quote) around the value specifically to handle this — do not remove that optionality even though this probe shows quotes are absent; a future Sass version could change this, and the pattern is defensive either way.

Clean up:
```bash
rm -rf /tmp/light-mode-probe
```

### Step 2: Write the contrast checker

Create `/Users/apostolos/Claude/Code/OUROBOROS/ouroboros-design/scripts/check-contrast.mjs`:

```javascript
#!/usr/bin/env node
// Reads the compiled dist/ouroboros.css, extracts the dark (:root) and light
// (:root[data-theme="light"]) custom-property blocks, and asserts every
// text/accent token clears its WCAG contrast floor against the WORST-CASE
// surface in its theme. Run via `npm run check:contrast`.
import { readFileSync } from 'node:fs';

const css = readFileSync(new URL('../dist/ouroboros.css', import.meta.url), 'utf8');

function declarations(re) {
  const out = {};
  for (const m of css.matchAll(re)) {
    for (const decl of m[1].split(';')) {
      const c = decl.indexOf(':');
      if (c === -1) continue;
      const name = decl.slice(0, c).trim();
      if (name.startsWith('--')) out[name] = decl.slice(c + 1).trim();
    }
  }
  return out;
}

// Matches the base `:root{...}` block. Requires `:root` to be followed
// immediately by `{` so it does NOT match `:root:not([data-theme=dark]){...}`.
const dark = declarations(/(?:^|[};]):root\{([^}]*)\}/g);
// Matches the explicit-choice `:root[data-theme="light"]{...}` block.
// Optional quotes handle both quoted and unquoted compiled output (verified
// against a real Dart Sass build — see plan Task 1, Step 1).
const light = declarations(/:root\[data-theme=["']?light["']?\]\{([^}]*)\}/g);

if (Object.keys(light).length === 0) {
  console.error('FAIL: no :root[data-theme="light"] token block found in dist/ouroboros.css.');
  console.error('Either the light theme was never compiled in, or the selector changed.');
  process.exit(1);
}

function srgbChannel(v) {
  const c = v / 255;
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

function luminance(hex) {
  const h = hex.replace('#', '').trim();
  const n = h.length === 3 ? h.split('').map((x) => x + x).join('') : h;
  const r = parseInt(n.slice(0, 2), 16);
  const g = parseInt(n.slice(2, 4), 16);
  const b = parseInt(n.slice(4, 6), 16);
  return 0.2126 * srgbChannel(r) + 0.7152 * srgbChannel(g) + 0.0722 * srgbChannel(b);
}

function ratio(hexA, hexB) {
  const la = luminance(hexA);
  const lb = luminance(hexB);
  const [hi, lo] = la > lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

function isHex(v) {
  return /^#[0-9a-fA-F]{3}([0-9a-fA-F]{3})?$/.test(v);
}

// rgba(...) dim/ghost tokens and --shadow are not text/border colors under
// test here — only plain hex tokens are checked.
const SURFACES = {
  dark: ['--bg1', '--bg2', '--bg3', '--calloutbg'],
  light: ['--bg1', '--bg2', '--bg3', '--calloutbg'],
};

// Floors:
// - --text/--subdued in LIGHT target AAA (7:1) — the spec's tighter light-mode
//   target.
// - --subdued in DARK is genuinely 6.4:1 worst case, which _base.scss's own
//   comment already documents as "AA for normal text" (not AAA) — so its dark
//   floor is 4.5, matching the shipped, correctly-labeled palette.
// - --gold-border is a border/non-text color (WCAG 1.4.11 non-text contrast),
//   floor 3:1.
// - --ruby and --claude have zero call sites in either repo (grep-verified:
//   `grep -rn -- "--ruby\|--claude" scss/ ../OUROBOROS-Consulting.github.io/assets`
//   returns only their own declarations). The CURRENT dark values already fail
//   4.5:1 (--ruby 3.70:1, --claude 4.36:1 on --calloutbg) — a pre-existing
//   condition outside this feature's scope. They are asserted in light only,
//   against the new light values this plan defines, so CI does not fail on
//   day one for an unrelated, already-shipped defect.
const FLOORS = {
  dark: {
    '--bright': 4.5,
    '--text': 7,
    '--subdued': 4.5,
    '--muted': 4.5,
    '--gold': 4.5,
    '--steel': 4.5,
    '--amethyst': 4.5,
    '--sage': 4.5,
    '--teal': 4.5,
    '--gold-border': 3,
  },
  light: {
    '--bright': 4.5,
    '--text': 7,
    '--subdued': 7,
    '--muted': 4.5,
    '--gold': 4.5,
    '--steel': 4.5,
    '--amethyst': 4.5,
    '--sage': 4.5,
    '--teal': 4.5,
    '--gold-border': 3,
    '--ruby': 4.5,
    '--claude': 4.5,
  },
};

const failures = [];

for (const [theme, tokens] of Object.entries({ dark, light })) {
  const floors = FLOORS[theme];
  const surfaces = SURFACES[theme];
  for (const [token, floor] of Object.entries(floors)) {
    const value = tokens[token];
    if (!value || !isHex(value)) {
      failures.push({ theme, token, surface: '(all)', ratioStr: 'n/a', floor, note: `token missing or not a hex color: ${value}` });
      continue;
    }
    let worst = Infinity;
    let worstSurface = '';
    for (const surfaceToken of surfaces) {
      const surfaceValue = tokens[surfaceToken];
      if (!surfaceValue || !isHex(surfaceValue)) continue;
      const r = ratio(value, surfaceValue);
      if (r < worst) {
        worst = r;
        worstSurface = surfaceToken;
      }
    }
    if (worst < floor) {
      failures.push({ theme, token, surface: worstSurface, ratioStr: worst.toFixed(2), floor });
    }
  }
}

if (failures.length > 0) {
  console.error('Contrast check FAILED\n');
  console.error('theme  token           surface       ratio   floor');
  for (const f of failures) {
    console.error(
      `${f.theme.padEnd(6)} ${f.token.padEnd(15)} ${f.surface.padEnd(13)} ${f.ratioStr.padEnd(7)} ${f.floor}` +
        (f.note ? `  (${f.note})` : '')
    );
  }
  process.exit(1);
}

console.log('Contrast check PASSED — all tokens meet their declared floor in both themes.');
```

### Step 3: Wire the checker into `package.json`

Read `/Users/apostolos/Claude/Code/OUROBOROS/ouroboros-design/package.json`. Find this exact block:

```json
  "scripts": {
    "build": "sass scss/index.scss dist/ouroboros.css --style=compressed",
    "build:dev": "sass scss/index.scss dist/ouroboros.css --style=expanded",
    "watch": "sass --watch scss/index.scss dist/ouroboros.css --style=expanded",
    "prepublishOnly": "npm run build",
    "test": "echo \"Error: no test specified\" && exit 1"
  },
```

Replace with:

```json
  "scripts": {
    "build": "sass scss/index.scss dist/ouroboros.css --style=compressed",
    "build:dev": "sass scss/index.scss dist/ouroboros.css --style=expanded",
    "watch": "sass --watch scss/index.scss dist/ouroboros.css --style=expanded",
    "check:contrast": "npm run build && node scripts/check-contrast.mjs",
    "prepublishOnly": "npm run build",
    "test": "echo \"Error: no test specified\" && exit 1"
  },
```

### Step 4: Run the checker and verify it FAILS (no light theme exists yet)

```bash
cd /Users/apostolos/Claude/Code/OUROBOROS/ouroboros-design
npm run check:contrast
```

Expected: exits non-zero with:
```
FAIL: no :root[data-theme="light"] token block found in dist/ouroboros.css.
```

If instead you see a Node syntax error, re-check Step 2's file for typos before continuing.

### Step 5: Restructure `_base.scss` — add the four mixins and the light palette

Read `/Users/apostolos/Claude/Code/OUROBOROS/ouroboros-design/scss/_base.scss`. Find this exact block (lines 11–91):

```scss
// ── CSS custom properties — Ouroboros v5 ──────────────────────────────────────
:root {
  // The system has no light mode. Declaring it stops the UA from rendering form
  // controls, scrollbars, and the default link colour for a light page.
  color-scheme: dark;

  --nav-h: 13rem; // desktop: primary (~96px)
  --pad:  2.5rem;
  --label-size: var(--fs-base);

  // Surfaces — all one navy family (hue ~223°) so the elevation ramp reads as
  // the same material lifted, not a different material. Values were chosen to
  // match the luminance of the neutral greys they replaced on 2026-07-26, so
  // every text-on-surface contrast ratio is unchanged. Do not reintroduce
  // neutral greys here.
  --bg1: #0c101a;
  --bg-hero: #1e213e; // dark navy — homepage + service hero background
  --bg2: #1a1d26; // was #1E1E1E
  --bg3: #22262f; // was #252525
  --border: #30343e; // was #333333
  --calloutbg: #252831; // was #2A2A2A — nudged darker to give the accents
  // headroom on the site's lightest surface: steel/amethyst were 4.57:1 on the
  // old grey, which is barely over AA. Now 4.69:1.
  --shadow: #06080d; // was #080808

  // Luminance hierarchy. Ratios below are the WORST case across all five
  // surfaces (calloutbg, the lightest), not the bg1 figure — quoting bg1 hid
  // roughly 1.5 points of headroom and made the ramp look safer than it is.
  // bg1 figures follow in parentheses.
  --bright: #FFFFFF; // 14.7:1 (19.0 on bg1)
  --text: #E8E4DC; // 11.6:1 (15.0)
  --subdued: #B0AAA0; // 6.4:1  (8.2) — AA for normal text on every surface
  --muted: #999999; // 5.2:1  (6.7) — AA for normal text on every surface

  // Accent: Gold
  --gold: #C9A84C;
  --gold-dim: rgba(201, 168, 76, 0.35);
  --gold-ghost: rgba(201, 168, 76, 0.12);
  --gold-border: #b39f7b; // opaque — for visible 1px borders

  // Accent: Steel (replaces sapphire)
  --steel: #7F94A6;
  --steel-dim: rgba(127, 148, 166, 0.35);
  --steel-ghost: rgba(127, 148, 166, 0.12);

  // Accent: Amethyst
  --amethyst: #A284CA;
  --amethyst-dim: rgba(162, 132, 202, 0.35);
  --amethyst-ghost: rgba(162, 132, 202, 0.12);

  // Accent: Sage
  --sage: #6DA187;
  --sage-dim: rgba(109, 161, 135, 0.35);
  --sage-ghost: rgba(109, 161, 135, 0.12);

  // Accent: Teal (logo hex frame colour)
  --teal: #5DA19C;
  --teal-dim: rgba(93, 161, 156, 0.35);
  --teal-ghost: rgba(93, 161, 156, 0.12);

  // Semantic aliases — active use only
  --ruby: #ba6868; // timeline error/alert states (_timeline.scss)
  --sapphire: var(--steel);
  --emerald: var(--sage);

  // Claude orange
  --claude: #E8640A;

  /* ── Type scale ── */
  --fs-xs: 0.8rem;
  --fs-sm: 0.9rem;
  --fs-base: 1rem;
  --fs-md: 1.2rem;
  --fs-lg: 1.4rem;
  --fs-xl: 1.6rem;
  --fs-display-xs: clamp(1.2rem, 2vw, 1.45rem);
  --fs-display-sm: clamp(1.5rem, 3vw, 2.1rem);
  --fs-display-md: clamp(2rem, 4vw, 3rem);
  --fs-display-lg: clamp(2.4rem, 5vw, 4rem);
  --fs-display-xl: clamp(3.5rem, 10vw, 8rem);
}
```

Replace it with:

```scss
// ── Theme mixins — Ouroboros v5 + light mode ──────────────────────────────────
// Two palettes (dark-tokens, light-tokens), a two-selector override pattern
// (light-mode) for non-token effects, and a trivial wrapper (dark-island) for
// marble/chrome surfaces that must render identically in both themes.
//
// Default is dark, unconditionally, on :root. Light applies in two cases:
//   1. OS prefers light AND the visitor has not explicitly chosen dark
//      (:root:not([data-theme="dark"]) inside a prefers-color-scheme: light
//      media query).
//   2. The visitor explicitly chose light (:root[data-theme="light"]),
//      regardless of OS preference.
// An explicit data-theme="dark" needs no extra rule — dark is already the
// unconditional :root default, so choosing dark just means "no override
// applies."
@mixin dark-tokens {
  --bg1: #0c101a;
  --bg2: #1a1d26;
  --bg3: #22262f;
  --border: #30343e;
  --calloutbg: #252831;
  --shadow: #06080d;

  --bright: #FFFFFF; // 14.7:1 (19.0 on bg1)
  --text: #E8E4DC; // 11.6:1 (15.0)
  --subdued: #B0AAA0; // 6.4:1 (8.2) — AA for normal text on every surface
  --muted: #999999; // 5.2:1 (6.7) — AA for normal text on every surface

  --gold: #C9A84C;
  --gold-dim: rgba(201, 168, 76, 0.35);
  --gold-ghost: rgba(201, 168, 76, 0.12);
  --gold-border: #b39f7b;

  --steel: #7F94A6;
  --steel-dim: rgba(127, 148, 166, 0.35);
  --steel-ghost: rgba(127, 148, 166, 0.12);

  --amethyst: #A284CA;
  --amethyst-dim: rgba(162, 132, 202, 0.35);
  --amethyst-ghost: rgba(162, 132, 202, 0.12);

  --sage: #6DA187;
  --sage-dim: rgba(109, 161, 135, 0.35);
  --sage-ghost: rgba(109, 161, 135, 0.12);

  --teal: #5DA19C;
  --teal-dim: rgba(93, 161, 156, 0.35);
  --teal-ghost: rgba(93, 161, 156, 0.12);

  --ruby: #ba6868; // pre-existing 3.70:1 on --calloutbg — zero call sites,
  // out of scope for this feature, not asserted by the dark contrast floor.
  --claude: #E8640A; // pre-existing 4.36:1 on --calloutbg — same as above.
}

// Light palette. Cool navy-tinted family (hue ~223°, same character as dark)
// so the two themes read as one material, not two different systems. The
// surface ramp keeps the SAME ORDER as dark — --bg1 is the page floor and the
// darkest of the four, --calloutbg is the lightest — so "further forward" still
// means "brighter" in both themes. That keeps three things working: the
// elevation gradient in elevation-elevated (a --bg3 wash at the TOP of a card)
// stays a lightening highlight rather than inverting into a dark band against
// its paired rgba(255,255,255,0.04) inset; callouts keep a visible step off the
// page floor; and hover-to---bg3 still reads as "lift", not "sink".
// --bg1 (#E7EAF0) is therefore the worst-case backdrop for dark-on-light text —
// the mirror of dark mode, where --calloutbg was the worst case for
// light-on-dark. Every ratio below was computed by hand against WCAG 2.1
// relative luminance (sRGB companding) using --bg1 as the worst-case surface,
// and verified against `npm run check:contrast` in Step 6.
@mixin light-tokens {
  --bg1: #E7EAF0;
  --bg2: #EFF1F5;
  --bg3: #F5F7FA;
  --border: #C7CBD6;
  --calloutbg: #FCFDFE;
  --shadow: rgba(28, 32, 41, 0.18);

  --bright: #1C2029; // 13.53:1 on --bg1
  --text: #34394A; // 9.52:1 on --bg1
  --subdued: #3D4353; // 8.20:1 on --bg1 — AAA, matches the tighter light target
  --muted: #535971; // 5.74:1 on --bg1

  --gold: #7A6028; // 4.93:1 on --bg1
  --gold-dim: rgba(122, 96, 40, 0.35);
  --gold-ghost: rgba(122, 96, 40, 0.12);
  --gold-border: #8A7550; // 3.68:1 on --bg1 — non-text, 3:1 floor

  --steel: #4A5A68; // 5.90:1 on --bg1
  --steel-dim: rgba(74, 90, 104, 0.35);
  --steel-ghost: rgba(74, 90, 104, 0.12);

  --amethyst: #6B4F94; // 5.49:1 on --bg1
  --amethyst-dim: rgba(107, 79, 148, 0.35);
  --amethyst-ghost: rgba(107, 79, 148, 0.12);

  --sage: #38624C; // 5.77:1 on --bg1
  --sage-dim: rgba(56, 98, 76, 0.35);
  --sage-ghost: rgba(56, 98, 76, 0.12);

  --teal: #295F5A; // 6.05:1 on --bg1
  --teal-dim: rgba(41, 95, 90, 0.35);
  --teal-ghost: rgba(41, 95, 90, 0.12);

  --ruby: #8A3E3E; // 6.14:1 on --bg1 — zero call sites, given a real passing
  // value anyway for palette completeness.
  --claude: #A34608; // 5.07:1 on --bg1 — zero call sites, same rationale.
}

// Wraps @content in both light-theme override selectors. Use for non-token
// effects (textures, shadows, gradients) that can't be expressed as a single
// custom property. `&` is whatever selector this is @include'd inside.
@mixin light-mode {
  @media (prefers-color-scheme: light) {
    :root:not([data-theme="dark"]) & {
      @content;
    }
  }

  :root[data-theme="light"] & {
    @content;
  }
}

// Forces dark-tokens on a marble/chrome surface regardless of the active
// theme. A trivial wrapper (not a hand-copied property list) so there is
// structurally zero chance of drifting from dark-tokens as the palette
// changes. Every island in this system (nav, footer, rail, page-toc, service
// hero, marble bands, section headers) gets this include — see Task 4.
@mixin dark-island {
  @include dark-tokens;
}

// ── CSS custom properties — Ouroboros v5 ──────────────────────────────────────
:root {
  // Baseline is dark. `color-scheme: light dark` lets the UA render its own
  // chrome (form controls, scrollbars, default link colour) for whichever
  // theme is actually active; the two override blocks below set it to
  // `light` explicitly when light-tokens is in effect.
  color-scheme: dark;

  --nav-h: 13rem; // desktop: primary (~96px)
  --pad:  2.5rem;
  --label-size: var(--fs-base);
  --bg-hero: #1e213e; // dark navy — homepage + service hero. Unconditional in
  // BOTH themes: the hero is a photographic/marble surface, not flat colour,
  // so it does not participate in the light/dark flip. See Task 4.

  /* ── Type scale ── */
  --fs-xs: 0.8rem;
  --fs-sm: 0.9rem;
  --fs-base: 1rem;
  --fs-md: 1.2rem;
  --fs-lg: 1.4rem;
  --fs-xl: 1.6rem;
  --fs-display-xs: clamp(1.2rem, 2vw, 1.45rem);
  --fs-display-sm: clamp(1.5rem, 3vw, 2.1rem);
  --fs-display-md: clamp(2rem, 4vw, 3rem);
  --fs-display-lg: clamp(2.4rem, 5vw, 4rem);
  --fs-display-xl: clamp(3.5rem, 10vw, 8rem);

  @include dark-tokens;
}

@media (prefers-color-scheme: light) {
  :root:not([data-theme="dark"]) {
    color-scheme: light;
    @include light-tokens;
  }
}

:root[data-theme="light"] {
  color-scheme: light;
  @include light-tokens;
}
```

### Step 6: Build and verify the checker PASSES

```bash
cd /Users/apostolos/Claude/Code/OUROBOROS/ouroboros-design
npm run check:contrast
```

Expected:
```
Contrast check PASSED — all tokens meet their declared floor in both themes.
```

If it fails, the failure table names the exact theme/token/surface/ratio that missed its floor — fix the hex in `light-tokens` (Step 5) and re-run. Do not lower a floor to make a failure disappear.

### Step 7: Add the contrast check to CI

Read `/Users/apostolos/Claude/Code/OUROBOROS/ouroboros-design/.github/workflows/ci.yml`. Find this exact block inside the `build` job:

```yaml
      - name: Build CSS
        run: npm run build

      - name: Report output size
```

Replace with:

```yaml
      - name: Build CSS
        run: npm run build

      - name: Check contrast
        run: node scripts/check-contrast.mjs

      - name: Report output size
```

(The `build` step already ran `npm run build`, so this step calls the checker script directly rather than `npm run check:contrast`, which would rebuild redundantly.)

### Step 8: Commit

```bash
cd /Users/apostolos/Claude/Code/OUROBOROS/ouroboros-design
git add scripts/check-contrast.mjs package.json scss/_base.scss .github/workflows/ci.yml
git commit -m "feat(theme): add light palette, theme mixins, and contrast checker

- dark-tokens/light-tokens/light-mode/dark-island mixins in _base.scss
- :root loads dark unconditionally; two override selectors apply light
  (OS-preference-default with explicit data-theme override)
- scripts/check-contrast.mjs asserts WCAG floors against worst-case
  surface in both themes; wired into package.json and CI

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Task 2: Texture mixin refactor + call-site classification

**Files:**
- Modify: `/Users/apostolos/Claude/Code/OUROBOROS/ouroboros-design/scss/_base.scss` (texture + elevation mixins, currently lines 178–223 before Task 1's edit shifts them down — locate by content, not line number)
- Modify: `/Users/apostolos/Claude/Code/OUROBOROS/ouroboros-design/scss/_nav-primary.scss:24`
- Modify: `/Users/apostolos/Claude/Code/OUROBOROS/ouroboros-design/scss/_footer.scss:10`
- Modify: `/Users/apostolos/Claude/Code/OUROBOROS/ouroboros-design/scss/_service.scss:11`

**Interfaces:**
- Consumes: `light-mode` mixin from Task 1.
- Produces (consumed by Task 3, Task 4): `scallop-recessed-dark`, `scallop-standard-dark`, `scallop-elevated-dark`, `snakeskin-dark` (no-arg-default mixins, same signatures as their flipping counterparts including `scallop-elevated-dark`'s `$prefix` param), `elevation-recessed-dark`, `elevation-standard-dark`, `elevation-elevated-dark`. The existing `scallop-recessed`, `scallop-standard`, `scallop-elevated`, `snakeskin`, `elevation-recessed`, `elevation-standard`, `elevation-elevated` keep their exact names and signatures but now flip to light values under `light-mode`.

### Step 1: Classify every texture/elevation call site

Run this from the `ouroboros-design` repo root to confirm the six call sites this task edits, plus the ones it deliberately leaves untouched:

```bash
cd /Users/apostolos/Claude/Code/OUROBOROS/ouroboros-design
grep -rn "@include scallop-\|@include snakeskin\|@include elevation-" scss/
```

Expected output includes (among others):
```
scss/_base.scss:180:@mixin scallop-recessed($accent: 'C9A84C') {
scss/_base.scss:185:@mixin scallop-standard($accent: 'C9A84C') {
scss/_base.scss:190:@mixin scallop-elevated($accent: 'C9A84C', $prefix: null) {
scss/_base.scss:208:  @include scallop-recessed;
scss/_base.scss:214:  @include scallop-standard;
scss/_base.scss:219:  @include scallop-elevated($prefix: linear-gradient(180deg, var(--bg3) 0%, transparent 40%));
scss/_base.scss:237:@mixin snakeskin($accent: 'C9A84C') {
scss/_cards.scss:21:  @include snakeskin;
scss/_cards.scss:83:    @include snakeskin;
scss/_cards.scss:186:    @include snakeskin;
scss/_cards.scss:356:    @include snakeskin;
scss/_design-system.scss:51:  @include scallop-standard;
scss/_footer.scss:10:  @include scallop-elevated;
scss/_framework.scss:37:  @include elevation-standard;
scss/_home.scss:117:  @include scallop-standard;
scss/_home.scss:188:  @include elevation-standard;
scss/_nav-primary.scss:24:  @include scallop-recessed;
scss/_nav-primary.scss:664:  @include elevation-standard;
scss/_service.scss:11:  @include elevation-standard;
```

Dispositions (each verified by reading the enclosing selector, not guessed):

| Site | Selector | Verdict | Why |
|---|---|---|---|
| `_nav-primary.scss:24` | `nav {}` | **Island → `-dark`** | Fixed chrome bar, `background-color: rgba(20, 20, 20, 0.92)`, matches the marble family. Locked navbar. |
| `_footer.scss:10` | `footer {}` | **Island → `-dark`** | Same rgba(20,20,20,0.92) chrome pattern as nav. |
| `_service.scss:11` | `.page-hero {}` | **Island → `-dark`** | `background-color: var(--bg-hero)`, which Task 1 made unconditional/unthemed — the hero is a fixed marble surface. |
| `_cards.scss:21,83,186,356` | `.card`, `.card__interior`, two others | **Content → leave as-is** | Card fills use `var(--bg2)`/`var(--bg3)` (themed surfaces), not a hardcoded dark rgba. They are meant to flip. |
| `_home.scss:117` | `.stat { background-color: var(--bg1); @include scallop-standard; }` | **Content → leave as-is** | Background is `var(--bg1)`, the page floor token — it already flips with the theme. Not marble. |
| `_home.scss:188` | `&__surface { ... @include elevation-standard; }` inside a testimonial flip-card component | **Content → leave as-is** | Flip-card front/back faces, standard card surface, not marble. |
| `_nav-primary.scss:664` | `.search-page-result { @include elevation-standard; }` | **Content → leave as-is** | Search results list item, co-located in this file by history only, not part of the nav chrome itself. |
| `_framework.scss:37` | `.framework-pillar { @include elevation-standard; }` | **Content → leave as-is** | Framework grid card. |
| `_design-system.scss:51` | `.color-swatch .swatch-box` | **No action** | This partial is never forwarded (`// @forward "design-system";` is commented out in `index.scss`) — it does not ship. Leave untouched; its `@include scallop-standard` call remains syntactically valid against the new flipping mixin regardless. |

So this task edits exactly three call sites (`_nav-primary.scss:24`, `_footer.scss:10`, `_service.scss:11`) plus the mixin definitions in `_base.scss`. Everything else in the table above is confirmed correct as-is and gets no edit.

### Step 2: Refactor the four texture mixins into function + dark/flipping pairs

Read `/Users/apostolos/Claude/Code/OUROBOROS/ouroboros-design/scss/_base.scss`. Find this exact block:

```scss
// ── Scallop pattern mixins — v5 depth hierarchy ──────────────────────────────
// Coarser = closer to viewer (elevated), finer = recedes (recessed)
@mixin scallop-recessed($accent: 'C9A84C') {
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12'%3E%3Cpath d='M0 12 Q3 7.5 6 4.5 Q9 7.5 12 12' fill='none' stroke='%23#{$accent}' stroke-width='0.3' stroke-opacity='0.076'/%3E%3Cpath d='M-6 6 Q-3 1.5 0 -1.5 Q3 1.5 6 6' fill='none' stroke='%23#{$accent}' stroke-width='0.3' stroke-opacity='0.076'/%3E%3Cpath d='M6 6 Q9 1.5 12 -1.5 Q15 1.5 18 6' fill='none' stroke='%23#{$accent}' stroke-width='0.5' stroke-opacity='0.076'/%3E%3C/svg%3E");
  background-size: 10px 10px;
}

@mixin scallop-standard($accent: 'C9A84C') {
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16'%3E%3Cpath d='M0 16 Q4 10 8 6 Q12 10 16 16' fill='none' stroke='%23#{$accent}' stroke-width='0.4' stroke-opacity='0.09'/%3E%3Cpath d='M-8 8 Q-4 2 0 -2 Q4 2 8 8' fill='none' stroke='%23#{$accent}' stroke-width='0.4' stroke-opacity='0.09'/%3E%3Cpath d='M8 8 Q12 2 16 -2 Q20 2 24 8' fill='none' stroke='%23#{$accent}' stroke-width='0.4' stroke-opacity='0.09'/%3E%3C/svg%3E");
  background-size: 13px 13px;
}

@mixin scallop-elevated($accent: 'C9A84C', $prefix: null) {
  $-svg: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24'%3E%3Cpath d='M0 24 Q6 15 12 9 Q18 15 24 24' fill='none' stroke='%23#{$accent}' stroke-width='0.7' stroke-opacity='0.10'/%3E%3Cpath d='M-12 12 Q-6 3 0 -3 Q6 3 12 12' fill='none' stroke='%23#{$accent}' stroke-width='0.5' stroke-opacity='0.10'/%3E%3Cpath d='M12 12 Q18 3 24 -3 Q30 3 36 12' fill='none' stroke='%23#{$accent}' stroke-width='0.7' stroke-opacity='0.10'/%3E%3C/svg%3E");

  @if $prefix !=null {
    background-image: $prefix, $-svg;
    background-size: 100% 100%, 20px 20px;
  }

  @else {
    background-image: $-svg;
    background-size: 20px 20px;
  }
}

// ── Elevation mixins ─────────────────────────────────────────────────────────
@mixin elevation-recessed {
  background-color: var(--bg1);
  color: var(--subdued);
  @include scallop-recessed;
}

@mixin elevation-standard {
  background-color: var(--bg2);
  box-shadow: 0 2px 8px var(--shadow);
  @include scallop-standard;
}

@mixin elevation-elevated {
  background-color: var(--bg2);
  @include scallop-elevated($prefix: linear-gradient(180deg, var(--bg3) 0%, transparent 40%));
  box-shadow:
    0 4px 16px var(--shadow),
    0 1px 0 rgba(255, 255, 255, 0.04) inset;
}
```

Replace it with:

```scss
// ── Scallop pattern mixins — v5 depth hierarchy ──────────────────────────────
// Coarser = closer to viewer (elevated), finer = recedes (recessed). Each
// texture is a function (returns the url()) plus two mixins: a "-dark"
// variant (always the dark stroke, for islands) and a flipping default
// variant (dark stroke normally, light stroke under light-mode, for content).
@function scallop-recessed-url($accent, $op) {
  @return url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12'%3E%3Cpath d='M0 12 Q3 7.5 6 4.5 Q9 7.5 12 12' fill='none' stroke='%23#{$accent}' stroke-width='0.3' stroke-opacity='#{$op}'/%3E%3Cpath d='M-6 6 Q-3 1.5 0 -1.5 Q3 1.5 6 6' fill='none' stroke='%23#{$accent}' stroke-width='0.3' stroke-opacity='#{$op}'/%3E%3Cpath d='M6 6 Q9 1.5 12 -1.5 Q15 1.5 18 6' fill='none' stroke='%23#{$accent}' stroke-width='0.5' stroke-opacity='#{$op}'/%3E%3C/svg%3E");
}

@mixin scallop-recessed-dark($accent: 'C9A84C') {
  background-image: scallop-recessed-url($accent, 0.076);
  background-size: 10px 10px;
}

@mixin scallop-recessed($accent: 'C9A84C') {
  @include scallop-recessed-dark($accent);

  @include light-mode {
    background-image: scallop-recessed-url('7A6028', 0.12);
  }
}

@function scallop-standard-url($accent, $op) {
  @return url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16'%3E%3Cpath d='M0 16 Q4 10 8 6 Q12 10 16 16' fill='none' stroke='%23#{$accent}' stroke-width='0.4' stroke-opacity='#{$op}'/%3E%3Cpath d='M-8 8 Q-4 2 0 -2 Q4 2 8 8' fill='none' stroke='%23#{$accent}' stroke-width='0.4' stroke-opacity='#{$op}'/%3E%3Cpath d='M8 8 Q12 2 16 -2 Q20 2 24 8' fill='none' stroke='%23#{$accent}' stroke-width='0.4' stroke-opacity='#{$op}'/%3E%3C/svg%3E");
}

@mixin scallop-standard-dark($accent: 'C9A84C') {
  background-image: scallop-standard-url($accent, 0.09);
  background-size: 13px 13px;
}

@mixin scallop-standard($accent: 'C9A84C') {
  @include scallop-standard-dark($accent);

  @include light-mode {
    background-image: scallop-standard-url('7A6028', 0.14);
  }
}

@function scallop-elevated-url($accent, $op) {
  @return url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24'%3E%3Cpath d='M0 24 Q6 15 12 9 Q18 15 24 24' fill='none' stroke='%23#{$accent}' stroke-width='0.7' stroke-opacity='#{$op}'/%3E%3Cpath d='M-12 12 Q-6 3 0 -3 Q6 3 12 12' fill='none' stroke='%23#{$accent}' stroke-width='0.5' stroke-opacity='#{$op}'/%3E%3Cpath d='M12 12 Q18 3 24 -3 Q30 3 36 12' fill='none' stroke='%23#{$accent}' stroke-width='0.7' stroke-opacity='#{$op}'/%3E%3C/svg%3E");
}

@mixin scallop-elevated-dark($accent: 'C9A84C', $prefix: null) {
  $-svg: scallop-elevated-url($accent, 0.10);

  @if $prefix !=null {
    background-image: $prefix, $-svg;
    background-size: 100% 100%, 20px 20px;
  }

  @else {
    background-image: $-svg;
    background-size: 20px 20px;
  }
}

@mixin scallop-elevated($accent: 'C9A84C', $prefix: null) {
  @include scallop-elevated-dark($accent, $prefix);

  @include light-mode {
    $-svg-light: scallop-elevated-url('7A6028', 0.16);

    @if $prefix !=null {
      background-image: $prefix, $-svg-light;
      background-size: 100% 100%, 20px 20px;
    }

    @else {
      background-image: $-svg-light;
      background-size: 20px 20px;
    }
  }
}

// ── Elevation mixins ─────────────────────────────────────────────────────────
@mixin elevation-recessed-dark {
  background-color: var(--bg1);
  color: var(--subdued);
  @include scallop-recessed-dark;
}

@mixin elevation-recessed {
  background-color: var(--bg1);
  color: var(--subdued);
  @include scallop-recessed;
}

@mixin elevation-standard-dark {
  background-color: var(--bg2);
  box-shadow: 0 2px 8px var(--shadow);
  @include scallop-standard-dark;
}

@mixin elevation-standard {
  background-color: var(--bg2);
  box-shadow: 0 2px 8px var(--shadow);
  @include scallop-standard;
}

@mixin elevation-elevated-dark {
  background-color: var(--bg2);
  @include scallop-elevated-dark($prefix: linear-gradient(180deg, var(--bg3) 0%, transparent 40%));
  box-shadow:
    0 4px 16px var(--shadow),
    0 1px 0 rgba(255, 255, 255, 0.04) inset;
}

@mixin elevation-elevated {
  background-color: var(--bg2);
  @include scallop-elevated($prefix: linear-gradient(180deg, var(--bg3) 0%, transparent 40%));
  box-shadow:
    0 4px 16px var(--shadow),
    0 1px 0 rgba(255, 255, 255, 0.04) inset;
}
```

Note: `elevation-elevated`'s inset-highlight light-mode flip is deliberately **not** added here — that is Task 3, which edits only the `box-shadow` line so this task's diff stays scoped to the mechanical dark/flip split.

Also refactor `snakeskin` the same way. Find this exact block (still in `_base.scss`):

```scss
@mixin snakeskin($accent: 'C9A84C') {
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16'%3E%3Cpath d='M0 16 Q4 10 8 6 Q12 10 16 16' fill='none' stroke='%23#{$accent}' stroke-width='0.7' stroke-opacity='0.10'/%3E%3Cpath d='M-8 8 Q-4 2 0 -2 Q4 2 8 8' fill='none' stroke='%23#{$accent}' stroke-width='0.7' stroke-opacity='0.10'/%3E%3Cpath d='M8 8 Q12 2 16 -2 Q20 2 24 8' fill='none' stroke='%23#{$accent}' stroke-width='0.7' stroke-opacity='0.10'/%3E%3C/svg%3E");
  background-size: 9px 9px;
}
```

Replace with:

```scss
@function snakeskin-url($accent, $op) {
  @return url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16'%3E%3Cpath d='M0 16 Q4 10 8 6 Q12 10 16 16' fill='none' stroke='%23#{$accent}' stroke-width='0.7' stroke-opacity='#{$op}'/%3E%3Cpath d='M-8 8 Q-4 2 0 -2 Q4 2 8 8' fill='none' stroke='%23#{$accent}' stroke-width='0.7' stroke-opacity='#{$op}'/%3E%3Cpath d='M8 8 Q12 2 16 -2 Q20 2 24 8' fill='none' stroke='%23#{$accent}' stroke-width='0.7' stroke-opacity='#{$op}'/%3E%3C/svg%3E");
}

@mixin snakeskin-dark($accent: 'C9A84C') {
  background-image: snakeskin-url($accent, 0.10);
  background-size: 9px 9px;
}

@mixin snakeskin($accent: 'C9A84C') {
  @include snakeskin-dark($accent);

  @include light-mode {
    background-image: snakeskin-url('7A6028', 0.16);
  }
}
```

### Step 3: Build and check for Sass errors

```bash
cd /Users/apostolos/Claude/Code/OUROBOROS/ouroboros-design
npm run build
```

Expected: exits 0, no Sass errors. If you see "Undefined mixin" or "Undefined function", the mixin/function block was placed after its first use — `dark-tokens`/`light-tokens`/`light-mode`/`dark-island` from Task 1 must appear before this block in `_base.scss`, and this block's functions must appear before its own mixins (they already do, top to bottom, in the replacement above).

### Step 4: Apply the `-dark` variants at the three island call sites

Read `/Users/apostolos/Claude/Code/OUROBOROS/ouroboros-design/scss/_nav-primary.scss`. Find:

```scss
  @include scallop-recessed;
```

Replace with:

```scss
  @include scallop-recessed-dark;
```

Read `/Users/apostolos/Claude/Code/OUROBOROS/ouroboros-design/scss/_footer.scss`. Find:

```scss
  @include scallop-elevated;
```

Replace with:

```scss
  @include scallop-elevated-dark;
```

Read `/Users/apostolos/Claude/Code/OUROBOROS/ouroboros-design/scss/_service.scss`. Find (inside `.page-hero {}`):

```scss
  @include elevation-standard;
```

Replace with:

```scss
  @include elevation-standard-dark;
```

### Step 5: Build and verify contrast still passes

```bash
cd /Users/apostolos/Claude/Code/OUROBOROS/ouroboros-design
npm run check:contrast
```

Expected: `Contrast check PASSED — all tokens meet their declared floor in both themes.` (This task doesn't touch tokens, so this should still pass from Task 1 — it's a regression check.)

### Step 6: Commit

```bash
cd /Users/apostolos/Claude/Code/OUROBOROS/ouroboros-design
git add scss/_base.scss scss/_nav-primary.scss scss/_footer.scss scss/_service.scss
git commit -m "refactor(theme): split texture/elevation mixins into dark + flipping variants

- scallop-recessed/standard/elevated and snakeskin now function+mixin pairs
- each has a -dark (island) variant and a flipping default (content) variant
- nav, footer, and service hero call sites switched to -dark (confirmed
  islands); all other call sites verified as content and left unchanged

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Task 3: Effects re-tune

**Files:**
- Modify: `/Users/apostolos/Claude/Code/OUROBOROS/ouroboros-design/scss/_base.scss` (`body::after`, `elevation-elevated`)
- Modify: `/Users/apostolos/Claude/Code/OUROBOROS/ouroboros-design/scss/_safety-exit.scss:27`

**Interfaces:**
- Consumes: `light-mode` mixin from Task 1; `elevation-elevated` mixin from Task 2.
- Produces: nothing new consumed by later tasks — this task only adds `light-mode` overrides to existing rules.

### Step 1: Re-tune the vignette + cursor spotlight

Read `/Users/apostolos/Claude/Code/OUROBOROS/ouroboros-design/scss/_base.scss`. Find this exact block:

```scss
body::after {
  content: '';
  position: fixed;
  inset: 0;
  z-index: 9998;
  pointer-events: none;
  background:
    radial-gradient(ellipse 70% 60% at 50% 40%,
      transparent 0%,
      rgba(8, 8, 8, 0.35) 100%),
    radial-gradient(600px circle at var(--cx, -9999px) var(--cy, -9999px),
      rgba(201, 168, 76, 0.06) 0%,
      rgba(201, 168, 76, 0.03) 35%,
      transparent 100%);
}
```

Replace with:

```scss
body::after {
  content: '';
  position: fixed;
  inset: 0;
  z-index: 9998;
  pointer-events: none;
  background:
    radial-gradient(ellipse 70% 60% at 50% 40%,
      transparent 0%,
      rgba(8, 8, 8, 0.35) 100%),
    radial-gradient(600px circle at var(--cx, -9999px) var(--cy, -9999px),
      rgba(201, 168, 76, 0.06) 0%,
      rgba(201, 168, 76, 0.03) 35%,
      transparent 100%);

  @include light-mode {
    // Cool navy edge (matches the light surface family) instead of a black
    // vignette, and the spotlight uses the darkened light-mode gold at the
    // same alphas as the dark version so it stays a subtle glow, not a smear.
    background:
      radial-gradient(ellipse 70% 60% at 50% 40%,
        transparent 0%,
        rgba(60, 72, 96, 0.10) 100%),
      radial-gradient(600px circle at var(--cx, -9999px) var(--cy, -9999px),
        rgba(122, 96, 40, 0.06) 0%,
        rgba(122, 96, 40, 0.03) 35%,
        transparent 100%);
  }
}
```

### Step 2: Flip the elevated inset highlight

Read `/Users/apostolos/Claude/Code/OUROBOROS/ouroboros-design/scss/_base.scss`. Find this exact block (the flipping `elevation-elevated`, added by Task 2 — do not confuse with `elevation-elevated-dark`, which stays unchanged):

```scss
@mixin elevation-elevated {
  background-color: var(--bg2);
  @include scallop-elevated($prefix: linear-gradient(180deg, var(--bg3) 0%, transparent 40%));
  box-shadow:
    0 4px 16px var(--shadow),
    0 1px 0 rgba(255, 255, 255, 0.04) inset;
}
```

Replace with:

```scss
@mixin elevation-elevated {
  background-color: var(--bg2);
  @include scallop-elevated($prefix: linear-gradient(180deg, var(--bg3) 0%, transparent 40%));
  box-shadow:
    0 4px 16px var(--shadow),
    0 1px 0 rgba(255, 255, 255, 0.04) inset;

  @include light-mode {
    // The dark theme's inset is a thin light line simulating light hitting
    // the top edge. On a light surface a light-on-light inset is invisible,
    // so flip to a thin dark line at the BOTTOM inner edge instead — same
    // "lit from above, shadow pools at the bottom" read, opposite polarity.
    // rgb(28, 32, 41) is the light theme's own --bright ink color.
    box-shadow:
      0 4px 16px var(--shadow),
      0 1px 0 rgba(28, 32, 41, 0.14) inset;
  }
}
```

### Step 3: Lighten the safety-exit shadow (package file)

Read `/Users/apostolos/Claude/Code/OUROBOROS/ouroboros-design/scss/_safety-exit.scss`. Find:

```scss
  box-shadow: 0 2px 12px rgba(8, 8, 8, 0.55);
  transition: background 0.2s, border-color 0.2s;
```

Replace with:

```scss
  box-shadow: 0 2px 12px rgba(8, 8, 8, 0.55);
  transition: background 0.2s, border-color 0.2s;

  @include light-mode {
    // The dark theme's near-opaque black shadow reads as far too heavy on a
    // light page. Same offsets, lighter and more transparent.
    box-shadow: 0 2px 12px rgba(28, 32, 41, 0.18);
  }
```

Note: `.safety-exit` in this package file has zero visual effect on the live site — the site repo defines its own competing `.safety-exit` rule in `main.scss` that wins the cascade (later in load order). This edit is still required for correctness and for any other consumer of this package, but Task 9 (site repo) is the one that actually changes what visitors see. Do not skip either.

### Step 4: Build and verify

```bash
cd /Users/apostolos/Claude/Code/OUROBOROS/ouroboros-design
npm run check:contrast
```

Expected: `Contrast check PASSED — all tokens meet their declared floor in both themes.` (regression check — this task touches no tokens).

### Step 5: Commit

```bash
cd /Users/apostolos/Claude/Code/OUROBOROS/ouroboros-design
git add scss/_base.scss scss/_safety-exit.scss
git commit -m "feat(theme): re-tune vignette, spotlight, elevation inset, and safety-exit shadow for light mode

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Task 4: Apply `dark-island` to design-repo islands

**Files:**
- Modify: `/Users/apostolos/Claude/Code/OUROBOROS/ouroboros-design/scss/_nav-primary.scss` (`nav {}`)
- Modify: `/Users/apostolos/Claude/Code/OUROBOROS/ouroboros-design/scss/_nav-secondary.scss` (`.nav-secondary {}`)
- Modify: `/Users/apostolos/Claude/Code/OUROBOROS/ouroboros-design/scss/_footer.scss` (`footer {}`)
- Modify: `/Users/apostolos/Claude/Code/OUROBOROS/ouroboros-design/scss/_sidebar-rail.scss` (`.rail {}`)
- Modify: `/Users/apostolos/Claude/Code/OUROBOROS/ouroboros-design/scss/_sidebar.scss` (`.page-toc {}`)
- Modify: `/Users/apostolos/Claude/Code/OUROBOROS/ouroboros-design/scss/_service.scss` (`.page-hero {}`)
- Modify: `/Users/apostolos/Claude/Code/OUROBOROS/ouroboros-design/scss/_service.scss` (`marble-band` mixin)
- Modify: `/Users/apostolos/Claude/Code/OUROBOROS/ouroboros-design/scss/_home.scss` (`.work-header, .testimonials-header, .about-header`)
- Modify: `/Users/apostolos/Claude/Code/OUROBOROS/ouroboros-design/scss/_home.scss` (`#hero {}`)

**Interfaces:**
- Consumes: `dark-island` mixin from Task 1.
- Produces: nothing new — this is the last design-repo mixin-application task before README (Task 7) and CI (Task 6).

### Step 1: Primary nav

Read `/Users/apostolos/Claude/Code/OUROBOROS/ouroboros-design/scss/_nav-primary.scss`. Find:

```scss
nav {
  position: relative;
  width: 100%;
  padding: 0.5rem var(--pad);
  display: flex;
  justify-content: flex-start;
  gap: 0.75rem;
  align-items: center;
  @include scallop-recessed-dark;
  background-color: rgba(20, 20, 20, 0.92);
```

Replace with:

```scss
nav {
  position: relative;
  width: 100%;
  padding: 0.5rem var(--pad);
  display: flex;
  justify-content: flex-start;
  gap: 0.75rem;
  align-items: center;
  @include dark-island;
  @include scallop-recessed-dark;
  background-color: rgba(20, 20, 20, 0.92);
```

### Step 2: Secondary nav

Read `/Users/apostolos/Claude/Code/OUROBOROS/ouroboros-design/scss/_nav-secondary.scss`. Find:

```scss
.nav-secondary {
  width: 100%;
  display: flex;
  align-items: center;
  padding: 5px 1.5rem;
  border-bottom: 1px solid var(--border);
  background: rgba(14, 14, 14, 0.96);
```

Replace with:

```scss
.nav-secondary {
  @include dark-island;
  width: 100%;
  display: flex;
  align-items: center;
  padding: 5px 1.5rem;
  border-bottom: 1px solid var(--border);
  background: rgba(14, 14, 14, 0.96);
```

### Step 3: Footer

Read `/Users/apostolos/Claude/Code/OUROBOROS/ouroboros-design/scss/_footer.scss`. Find:

```scss
footer {
  padding: 0.75rem 3rem;
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  align-items: center;
  gap: 0.75rem;
  @include scallop-elevated-dark;
```

Replace with:

```scss
footer {
  @include dark-island;
  padding: 0.75rem 3rem;
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  align-items: center;
  gap: 0.75rem;
  @include scallop-elevated-dark;
```

### Step 4: Left rail

Read `/Users/apostolos/Claude/Code/OUROBOROS/ouroboros-design/scss/_sidebar-rail.scss`. Find:

```scss
.rail {
  position: fixed;
  top: var(--rail-top);
  left: 0;
  bottom: 0;
  z-index: 90;
  width: var(--rail-w);
  overflow: hidden;
  background: rgba(20, 20, 20, 0.92);
```

Replace with:

```scss
.rail {
  @include dark-island;
  position: fixed;
  top: var(--rail-top);
  left: 0;
  bottom: 0;
  z-index: 90;
  width: var(--rail-w);
  overflow: hidden;
  background: rgba(20, 20, 20, 0.92);
```

### Step 5: Right TOC panel

Read `/Users/apostolos/Claude/Code/OUROBOROS/ouroboros-design/scss/_sidebar.scss`. Find:

```scss
.page-toc {
  position: fixed;
  top: var(--rail-top);
  right: 0;
  bottom: 0;
  z-index: 90;
  width: var(--toc-w);
  overflow-y: auto;
  padding: 2rem 1.4rem 2rem;
```

Replace with:

```scss
.page-toc {
  @include dark-island;
  position: fixed;
  top: var(--rail-top);
  right: 0;
  bottom: 0;
  z-index: 90;
  width: var(--toc-w);
  overflow-y: auto;
  padding: 2rem 1.4rem 2rem;
```

`_sidebar.scss` does not currently `@use "base"`. Check the top of the file:

```bash
head -3 /Users/apostolos/Claude/Code/OUROBOROS/ouroboros-design/scss/_sidebar.scss
```

If it does not already show `@use "base" as *;`, add it. Find:

```scss
@use "typography" as *;
```

Replace with:

```scss
@use "typography" as *;
@use "base" as *;
```

### Step 6: Service hero

Read `/Users/apostolos/Claude/Code/OUROBOROS/ouroboros-design/scss/_service.scss`. Find:

```scss
.page-hero {
  padding: var(--nav-h) 10vw 2.5rem;
  min-height: 100svh;
  display: flex;
  flex-direction: column;
  border-bottom: 2px solid var(--border);
  position: relative;
  @include elevation-standard-dark;
```

Replace with:

```scss
.page-hero {
  @include dark-island;
  padding: var(--nav-h) 10vw 2.5rem;
  min-height: 100svh;
  display: flex;
  flex-direction: column;
  border-bottom: 2px solid var(--border);
  position: relative;
  @include elevation-standard-dark;
```

### Step 7: Marble band mixin

Read `/Users/apostolos/Claude/Code/OUROBOROS/ouroboros-design/scss/_service.scss`. Find:

```scss
@mixin marble-band {
  background-color: #0D0D0D;
  border-top: 1px solid rgba(177, 147, 93, 0.22);
  border-bottom: 1px solid rgba(177, 147, 93, 0.22);
  margin-left: -5vw;
```

Replace with:

```scss
@mixin marble-band {
  @include dark-island;
  background-color: #0D0D0D;
  border-top: 1px solid rgba(177, 147, 93, 0.22);
  border-bottom: 1px solid rgba(177, 147, 93, 0.22);
  margin-left: -5vw;
```

### Step 8: Home page section headers

Read `/Users/apostolos/Claude/Code/OUROBOROS/ouroboros-design/scss/_home.scss`. Find:

```scss
.work-header,
.testimonials-header,
.about-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  background-color: #0D0D0D; // fallback under the black-marble raster (site main.scss)
```

Replace with:

```scss
.work-header,
.testimonials-header,
.about-header {
  @include dark-island;
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  background-color: #0D0D0D; // fallback under the black-marble raster (site main.scss)
```

### Step 9: Homepage hero

Read `/Users/apostolos/Claude/Code/OUROBOROS/ouroboros-design/scss/_home.scss`. Find the top of the file:

```bash
sed -n '1,10p' /Users/apostolos/Claude/Code/OUROBOROS/ouroboros-design/scss/_home.scss
```

This shows `#hero {` at line 5. Add `@include dark-island;` as the first declaration inside that rule (the exact surrounding lines vary — locate the `#hero {` opening brace and insert immediately after it):

```scss
#hero {
  @include dark-island;
```

### Step 10: Build and verify

```bash
cd /Users/apostolos/Claude/Code/OUROBOROS/ouroboros-design
npm run check:contrast
```

Expected: `Contrast check PASSED — all tokens meet their declared floor in both themes.`

### Step 11: Commit

```bash
cd /Users/apostolos/Claude/Code/OUROBOROS/ouroboros-design
git add scss/_nav-primary.scss scss/_nav-secondary.scss scss/_footer.scss scss/_sidebar-rail.scss scss/_sidebar.scss scss/_service.scss scss/_home.scss
git commit -m "feat(theme): apply dark-island to nav, footer, rail, TOC, hero, marble bands

Locks nav, footer, rail, page-toc, page-hero, marble-band, section headers,
and the homepage hero to dark tokens in both themes.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Task 5: Rail toggle button styling

**Files:**
- Modify: `/Users/apostolos/Claude/Code/OUROBOROS/ouroboros-design/scss/_sidebar-rail.scss`

**Interfaces:**
- Consumes: `.rail-item`, `.rail-ic`, `.rail-tx` classes already defined in this file.
- Produces (consumed by Task 8): CSS class `.rail-item--button` and its `i.fa-sun`/`i.fa-moon` icon states. Task 8 (site repo) emits a `<button class="rail-item rail-item--button">` with an `<i class="fas fa-moon">` inside — the icon class Task 8's JS toggles between `fa-moon` and `fa-sun`.

### Step 1: Add the button-reset modifier class

Read `/Users/apostolos/Claude/Code/OUROBOROS/ouroboros-design/scss/_sidebar-rail.scss`. Find:

```scss
.rail-item {
  display: flex;
  align-items: center;
  gap: 0.9rem;
  height: 3rem;
  padding: 0 0 0 calc((var(--rail-w) - 1.35rem) / 2); // centres icon when collapsed
  text-decoration: none;
  color: var(--subdued);
  white-space: nowrap;
  transition: color 0.18s ease, background 0.18s ease;

  &:hover {
    color: var(--gold);
    background: var(--gold-ghost);
  }
}
```

Replace with:

```scss
.rail-item {
  display: flex;
  align-items: center;
  gap: 0.9rem;
  height: 3rem;
  padding: 0 0 0 calc((var(--rail-w) - 1.35rem) / 2); // centres icon when collapsed
  text-decoration: none;
  color: var(--subdued);
  white-space: nowrap;
  transition: color 0.18s ease, background 0.18s ease;

  &:hover {
    color: var(--gold);
    background: var(--gold-ghost);
  }
}

// ── Button variant (theme toggle) ────────────────────────────────────────────
// .rail-item is normally an <a>. The toggle is a <button> (no navigation, no
// href) so it needs its own reset: no native button chrome, full width to
// match the anchor items, and a visible pointer cursor.
.rail-item--button {
  width: 100%;
  background: none;
  border: none;
  font: inherit;
  cursor: pointer;
  text-align: left;
}
```

### Step 2: Build

```bash
cd /Users/apostolos/Claude/Code/OUROBOROS/ouroboros-design
npm run build
```

Expected: exits 0, no Sass errors.

### Step 3: Commit

```bash
cd /Users/apostolos/Claude/Code/OUROBOROS/ouroboros-design
git add scss/_sidebar-rail.scss
git commit -m "feat(theme): add .rail-item--button reset for the rail theme toggle

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Task 6: CI preview repair

**Files:**
- Modify: `/Users/apostolos/Claude/Code/OUROBOROS/ouroboros-design/.github/workflows/ci.yml`

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces: a working `preview`/`cleanup` job pair using `GITHUB_TOKEN` instead of the currently-required `WEBSITE_PAT` secret, mirroring the site repo's own known-good `jekyll-gh-pages.yml` pattern (checkout paths, ruby/setup-ruby, `bundle exec jekyll build`).

### Step 1: Confirm the reference pattern in the site repo

```bash
cat /Users/apostolos/Claude/Code/OUROBOROS/OUROBOROS-Consulting.github.io/.github/workflows/jekyll-gh-pages.yml
```

Confirm it uses `ruby/setup-ruby@v1` with `ruby-version: "3.3"`, `bundler-cache: true`, and `bundle exec jekyll build`. This task's `preview`/`cleanup` jobs follow the same pattern but build to a PR-specific subpath instead of the site root.

### Step 2: Replace the entire workflow

Read `/Users/apostolos/Claude/Code/OUROBOROS/ouroboros-design/.github/workflows/ci.yml` in full (already confirmed above in Task 1 planning — reproduced here for the edit). Replace the **entire file contents** with:

```yaml
name: Build & Preview

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]
    types: [opened, synchronize, reopened, closed]

jobs:
  # ── 1. Always: compile the SCSS ───────────────────────────────────────────────
  build:
    name: Compile SCSS
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Build CSS
        run: npm run build

      - name: Check contrast
        run: node scripts/check-contrast.mjs

      - name: Report output size
        run: |
          SIZE_KB=$(echo "scale=1; $(wc -c < dist/ouroboros.css) / 1024" | bc)
          echo "### Build successful" >> $GITHUB_STEP_SUMMARY
          echo "" >> $GITHUB_STEP_SUMMARY
          echo "| File | Size |" >> $GITHUB_STEP_SUMMARY
          echo "|------|------|" >> $GITHUB_STEP_SUMMARY
          echo "| \`dist/ouroboros.css\` | ${SIZE_KB} KB |" >> $GITHUB_STEP_SUMMARY

      - name: Upload compiled CSS
        uses: actions/upload-artifact@v4
        with:
          name: ouroboros-css-${{ github.sha }}
          path: dist/ouroboros.css
          retention-days: 7

  # ── 2. PRs only: build website with PR's SCSS source and deploy a preview ────
  # Uses the built-in GITHUB_TOKEN (contents: write) instead of a PAT — no
  # secret to configure, works for any fork with write access to this repo.
  preview:
    name: Deploy website preview
    runs-on: ubuntu-latest
    needs: [build]
    if: >
      github.event_name == 'pull_request' &&
      github.event.action != 'closed'
    permissions:
      contents: write
      pull-requests: write

    steps:
      - name: Checkout design repo (this PR)
        uses: actions/checkout@v4
        with:
          path: ouroboros-design

      - name: Checkout website repo
        uses: actions/checkout@v4
        with:
          repository: OUROBOROS-Consulting/OUROBOROS-Consulting.github.io
          path: site

      - uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Install website deps against this PR's design source
        working-directory: site
        run: |
          npm install
          npm install "../ouroboros-design"

      - uses: ruby/setup-ruby@v1
        with:
          ruby-version: "3.3"
          bundler-cache: true
          working-directory: site

      - name: Build Jekyll site with preview baseurl
        working-directory: site
        env:
          JEKYLL_ENV: production
        run: |
          bundle exec jekyll build --baseurl "/ouroboros-design/preview/pr-${{ github.event.pull_request.number }}"

      - name: Checkout gh-pages
        uses: actions/checkout@v4
        with:
          ref: gh-pages
          path: gh-pages

      - name: Copy build into preview subdirectory and push
        run: |
          rm -rf "gh-pages/preview/pr-${{ github.event.pull_request.number }}"
          mkdir -p "gh-pages/preview/pr-${{ github.event.pull_request.number }}"
          cp -r site/_site/* "gh-pages/preview/pr-${{ github.event.pull_request.number }}/"
          cd gh-pages
          git config user.name "github-actions[bot]"
          git config user.email "github-actions[bot]@users.noreply.github.com"
          git add "preview/pr-${{ github.event.pull_request.number }}"
          git diff --staged --quiet && exit 0
          git commit -m "deploy: preview for PR #${{ github.event.pull_request.number }} (${{ github.sha }})"
          git push

      - name: Post preview link to PR
        uses: actions/github-script@v7
        with:
          script: |
            const pr = context.payload.pull_request.number;
            const sha = context.sha.slice(0, 7);
            const url = `https://ouroboros-consulting.github.io/ouroboros-design/preview/pr-${pr}/`;
            await github.rest.issues.createComment({
              ...context.repo,
              issue_number: pr,
              body: [
                '### Preview deployed',
                '',
                `[→ View website with this PR's CSS](${url})`,
                '',
                `_Built from ${sha}_`,
              ].join('\n'),
            });

  # ── 3. PR closed: clean up preview ───────────────────────────────────────────
  cleanup:
    name: Remove preview
    runs-on: ubuntu-latest
    if: >
      github.event_name == 'pull_request' &&
      github.event.action == 'closed'
    permissions:
      contents: write

    steps:
      - uses: actions/checkout@v4
        with:
          ref: gh-pages

      - name: Delete preview directory and push
        run: |
          git config user.name "github-actions[bot]"
          git config user.email "github-actions[bot]@users.noreply.github.com"
          git rm -rf "preview/pr-${{ github.event.pull_request.number }}" || true
          git diff --staged --quiet && exit 0
          git commit -m "chore: remove preview for PR #${{ github.event.pull_request.number }}"
          git push
```

This drops `check-pat`, `WEBSITE_PAT`, `npm pack`, and Hugo entirely, and replaces them with the site repo's actual toolchain (Ruby/Jekyll) using the default `GITHUB_TOKEN` (the `permissions: contents: write` block on `preview` and `cleanup` is what authorizes the push to `gh-pages` — no PAT secret needs to exist).

### Step 2: Validate YAML syntax

```bash
cd /Users/apostolos/Claude/Code/OUROBOROS/ouroboros-design
python3 -c "import yaml; yaml.safe_load(open('.github/workflows/ci.yml'))" && echo "YAML valid"
```

Expected: `YAML valid`. If `python3`/`yaml` is unavailable, use `npx js-yaml .github/workflows/ci.yml > /dev/null && echo "YAML valid"` instead.

### Step 3: Commit

```bash
cd /Users/apostolos/Claude/Code/OUROBOROS/ouroboros-design
git add .github/workflows/ci.yml
git commit -m "fix(ci): rewrite preview workflow for Jekyll, drop WEBSITE_PAT dependency

Preview job was building the site with Hugo; the site is Jekyll. Rewritten
to mirror the site's own jekyll-gh-pages.yml (ruby/setup-ruby, bundle exec
jekyll build). Uses the default GITHUB_TOKEN instead of the WEBSITE_PAT
secret — no secret to configure for the preview flow to work.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

Note: this preview workflow requires a `gh-pages` branch on `OUROBOROS-Consulting/ouroboros-design` (the design repo, not the site repo — the preview is hosted at `ouroboros-consulting.github.io/ouroboros-design/preview/...`), with Pages configured to serve from it. **Both are already done — this is NOT a blocker.** Resolved 2026-08-06: orphan branch `gh-pages` created (empty commit `ee9d469`), Pages `build_type` set to `legacy`, source set to `gh-pages` / `/`. No action needed here; do not attempt to recreate the branch. The Pages URL 404s until the first PR preview lands, which is expected.

---

## Task 7: README updates

**Files:**
- Modify: `/Users/apostolos/Claude/Code/OUROBOROS/ouroboros-design/README.md`

**Interfaces:**
- Consumes: nothing (documentation only).
- Produces: nothing consumed by other tasks.

### Step 1: Add the light palette table and two-selector pattern

Read `/Users/apostolos/Claude/Code/OUROBOROS/ouroboros-design/README.md`. Find:

```markdown
⚠ Surfaces were shifted from neutral grey into the navy family on 2026-07-26 at **matched luminance**, so every text-on-surface ratio moved by less than 0.15. The one deliberate exception is `--calloutbg`, darkened slightly: steel and amethyst sat at 4.57:1 on the old grey, barely over AA, and are now 4.69:1. Do not reintroduce neutral greys (`#1E1E1E`, `#252525`, `#333333`, `#2A2A2A`).

Worst case in the whole system is now **4.69:1** (steel/amethyst on `--calloutbg`). Anything you add must clear 4.5:1 against the surface it sits on.
```

Replace with:

```markdown
⚠ Surfaces were shifted from neutral grey into the navy family on 2026-07-26 at **matched luminance**, so every text-on-surface ratio moved by less than 0.15. The one deliberate exception is `--calloutbg`, darkened slightly: steel and amethyst sat at 4.57:1 on the old grey, barely over AA, and are now 4.69:1. Do not reintroduce neutral greys (`#1E1E1E`, `#252525`, `#333333`, `#2A2A2A`).

Worst case in the whole system is now **4.69:1** (steel/amethyst on `--calloutbg`). Anything you add must clear 4.5:1 against the surface it sits on.

### Light mode

Added 2026-08-06. Same navy-tinted character (hue ~223°). The ramp keeps the same **order** as dark, mirrored across the luminance midpoint: `--bg1` is the page floor and the darkest of the four, rising through `--bg2` and `--bg3` to `--calloutbg` as the lightest. Elevation still means "brighter" in both themes, so the `--bg3` wash at the top of `elevation-elevated` stays a highlight instead of inverting into a dark band. `--bg1` is therefore the worst-case backdrop for dark-on-light text.

```scss
--bg1: #E7EAF0       --bg2: #EFF1F5       --bg3: #F5F7FA
--border: #C7CBD6    --calloutbg: #FCFDFE --shadow: rgba(28, 32, 41, 0.18)

--bright: #1C2029  // 13.53:1 on --bg1
--text: #34394A    //  9.52:1 on --bg1
--subdued: #3D4353 //  8.20:1 on --bg1  AAA
--muted: #535971   //  5.74:1 on --bg1

--gold: #7A6028      --steel: #4A5A68      --amethyst: #6B4F94
--sage: #38624C      --teal: #295F5A       --gold-border: #8A7550 (3:1, non-text)
```

Default is dark. Two mechanisms bring in light:

1. **OS preference, no explicit choice.** `@media (prefers-color-scheme: light) { :root:not([data-theme="dark"]) { ... } }`.
2. **Explicit choice**, set by the rail toggle and persisted to `localStorage`. `:root[data-theme="light"] { ... }`.

`@include light-mode { ... }` (defined in `_base.scss`) wraps `@content` in both selectors — use it for any non-token effect (shadows, gradients, textures) that needs to flip.

⚠ **Marble surfaces are dark islands in both themes.** Nav, footer, rail, `.page-toc`, service hero, marble bands, and section headers all call `@include dark-island;`, which forces the full dark token set regardless of the active theme. Do not let a light-mode rule reach inside one of these — if a new component needs to sit on a marble surface, wrap it in `dark-island` too, or its text will inherit light-theme tokens against a dark background and become unreadable.
```

### Step 2: Add `dark-island`/`light-mode` to the Elevation section

Find:

```markdown
## Elevation

Three mixins in `_base.scss`. Each combines a scallop SVG tile with a background colour. Darker = further back, brighter = further forward.

| Mixin | Tile | Stroke opacity |
|---|---|---|
| `@include elevation-recessed` | 12px | 0.08 |
| `@include elevation-standard` | 16px | 0.18 |
| `@include elevation-elevated` | 24px | 0.28 |
```

Replace with:

```markdown
## Elevation

Three mixins in `_base.scss`. Each combines a scallop SVG tile with a background colour. Darker = further back, brighter = further forward. Each also has a `-dark` variant (`elevation-recessed-dark`, etc.) that never flips — use those on marble/chrome islands, the plain names on content that should theme normally.

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
| `dark-island` | `@include dark-tokens;`. Forces dark regardless of theme — use on marble/chrome surfaces. |
```

### Step 3: Add the non-negotiable to the invariants list

Find:

```markdown
- **Any new accent must clear 4.5:1 on `--bg1`.**
```

Replace with:

```markdown
- **Any new accent must clear 4.5:1 on `--bg1`.**
- **Marble surfaces are dark islands in both themes.** `@include dark-island;` on any new marble/chrome surface — see Light mode above.
```

### Step 4: Commit

```bash
cd /Users/apostolos/Claude/Code/OUROBOROS/ouroboros-design
git add README.md
git commit -m "docs: document light palette, theme mixins, and the dark-island invariant

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## ⛔ PUSH / MERGE BOUNDARY ⛔

**Before starting Task 8, all of Tasks 1–7 must be merged to `main` in `ouroboros-design` AND pushed.** The site's CI checks out `ouroboros-design`'s default branch with no `ref:` — Tasks 8–9 in the site repo are meaningless against an unpushed design repo, and if done out of order, production will serve new site markup against old CSS.

```bash
cd /Users/apostolos/Claude/Code/OUROBOROS/ouroboros-design
git status
# Confirm: on main, clean working tree, all Task 1-7 commits present.
git log --oneline -10
git push origin main
```

---

## Task 8: Site — theme script, toggle JS, toggle markup

**Files:**
- Modify: `/Users/apostolos/Claude/Code/OUROBOROS/OUROBOROS-Consulting.github.io/_layouts/default.html`
- Modify: `/Users/apostolos/Claude/Code/OUROBOROS/OUROBOROS-Consulting.github.io/assets/js/main.js`
- Modify: `/Users/apostolos/Claude/Code/OUROBOROS/OUROBOROS-Consulting.github.io/_includes/sidebar.html`

**Interfaces:**
- Consumes: `.rail-item--button` CSS class from Task 5; `data-theme` attribute mechanism from Task 1.
- Produces: `#theme-toggle` button element (consumed only by its own JS in this task — no later task depends on it).

### Step 0: Rebuild the design package into the site's dependency

```bash
cd /Users/apostolos/Claude/Code/OUROBOROS/ouroboros-design
npm run build
cd /Users/apostolos/Claude/Code/OUROBOROS/OUROBOROS-Consulting.github.io
npm install
```

### Step 1: Blocking inline theme script

Read `/Users/apostolos/Claude/Code/OUROBOROS/OUROBOROS-Consulting.github.io/_layouts/default.html`. Find:

```html
    <link rel="stylesheet" href="{{ '/assets/css/main.css' | relative_url }}" />
```

Replace with:

```html
    <script>
      // Blocking, inline, runs before any stylesheet paints. Applies a
      // previously-chosen theme immediately so there is no flash of the
      // wrong theme. No stored choice = follow the OS preference, which is
      // handled purely in CSS (prefers-color-scheme) — nothing to do here.
      (function () {
        try {
          var stored = localStorage.getItem('ouroboros-theme');
          if (stored === 'light' || stored === 'dark') {
            document.documentElement.setAttribute('data-theme', stored);
          }
        } catch (err) { /* localStorage may be blocked; OS preference still applies via CSS */ }
      })();
    </script>
    <link rel="stylesheet" href="{{ '/assets/css/main.css' | relative_url }}" />
```

### Step 2: Toggle button markup in the rail

Read `/Users/apostolos/Claude/Code/OUROBOROS/OUROBOROS-Consulting.github.io/_includes/sidebar.html`. It currently reads, in full:

```html
<aside id="rail" class="rail" aria-label="Contact and announcements">
  <nav class="rail-nav">
    <div class="rail-group{% if page.url contains '/intake' %} rail-group--active{% endif %}">
      <a class="rail-item" href="{{ '/intake' | relative_url }}" title="Contact"{% if page.url contains '/intake' %} aria-current="page"{% endif %}>
        <span class="rail-ic"><i class="fas fa-envelope" aria-hidden="true"></i></span>
        <span class="rail-tx">Contact</span>
      </a>
    </div>
    <div class="rail-group{% if page.url contains '/announcements' %} rail-group--active{% endif %}">
      <a class="rail-item" href="{{ '/announcements' | relative_url }}" title="Announcements"{% if page.url contains '/announcements' %} aria-current="page"{% endif %}>
        <span class="rail-ic"><i class="fas fa-newspaper" aria-hidden="true"></i></span>
        <span class="rail-tx">Announcements</span>
      </a>
    </div>
  </nav>
</aside>
```

Replace it in full with:

```html
<aside id="rail" class="rail" aria-label="Contact and announcements">
  <nav class="rail-nav">
    <div class="rail-group{% if page.url contains '/intake' %} rail-group--active{% endif %}">
      <a class="rail-item" href="{{ '/intake' | relative_url }}" title="Contact"{% if page.url contains '/intake' %} aria-current="page"{% endif %}>
        <span class="rail-ic"><i class="fas fa-envelope" aria-hidden="true"></i></span>
        <span class="rail-tx">Contact</span>
      </a>
    </div>
    <div class="rail-group{% if page.url contains '/announcements' %} rail-group--active{% endif %}">
      <a class="rail-item" href="{{ '/announcements' | relative_url }}" title="Announcements"{% if page.url contains '/announcements' %} aria-current="page"{% endif %}>
        <span class="rail-ic"><i class="fas fa-newspaper" aria-hidden="true"></i></span>
        <span class="rail-tx">Announcements</span>
      </a>
    </div>
    <div class="rail-group">
      <button type="button" id="theme-toggle" class="rail-item rail-item--button" title="Toggle theme" aria-label="Switch to light theme">
        <span class="rail-ic"><i class="fas fa-moon" aria-hidden="true"></i></span>
        <span class="rail-tx">Dark</span>
      </button>
    </div>
  </nav>
</aside>
```

### Step 3: Toggle JS

Read `/Users/apostolos/Claude/Code/OUROBOROS/OUROBOROS-Consulting.github.io/assets/js/main.js`. Find the end of the file (the safety-exit IIFE that ends the file):

```javascript
  // Double-tap Escape within 500ms triggers exit.
  let lastEsc = 0;
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    const now = Date.now();
    if (now - lastEsc < 500) performExit();
    lastEsc = now;
  });
})();
```

Append after it (do not replace — this adds a new block at the end of the file):

```javascript

// ── Theme toggle ───────────────────────────────────────────────────────────
// Persists an explicit choice in localStorage under 'ouroboros-theme'. No
// stored value = follow the OS preference, handled purely in CSS. The
// blocking inline script in <head> already applied any stored choice before
// this file loaded, so this only wires the button and keeps its icon/label
// in sync.
(function initThemeToggle() {
  const STORAGE_KEY = 'ouroboros-theme';
  const btn = document.getElementById('theme-toggle');
  if (!btn) return;

  const icon = btn.querySelector('i');
  const label = btn.querySelector('.rail-tx');

  function currentTheme() {
    const stored = document.documentElement.getAttribute('data-theme');
    if (stored === 'light' || stored === 'dark') return stored;
    return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
  }

  function applyIcon(theme) {
    if (icon) {
      icon.classList.toggle('fa-moon', theme === 'dark');
      icon.classList.toggle('fa-sun', theme === 'light');
    }
    if (label) label.textContent = theme === 'dark' ? 'Dark' : 'Light';
    btn.setAttribute('aria-label', theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme');
  }

  applyIcon(currentTheme());

  btn.addEventListener('click', () => {
    const next = currentTheme() === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch (err) { /* storage may be blocked; theme still applies for this page load */ }
    applyIcon(next);
  });
})();
```

### Step 4: Verify with a local build

```bash
cd /Users/apostolos/Claude/Code/OUROBOROS/OUROBOROS-Consulting.github.io
bundle exec jekyll build
grep -c "theme-toggle" _site/index.html
```

Expected: a number ≥ 1 (the button markup made it into the rendered HTML). If `bundle` is not on PATH, run `rbenv exec bundle exec jekyll build` per this repo's Ruby setup (rbenv, Ruby 3.3.x).

### Step 5: Commit

```bash
cd /Users/apostolos/Claude/Code/OUROBOROS/OUROBOROS-Consulting.github.io
git add _layouts/default.html assets/js/main.js _includes/sidebar.html
git commit -m "feat(theme): blocking theme script, rail toggle button, and toggle JS

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Task 9: Site — dark-island application, C5 cleanup, safety-exit patch, hardcoded-color audit

**Files:**
- Modify: `/Users/apostolos/Claude/Code/OUROBOROS/OUROBOROS-Consulting.github.io/assets/css/main.scss`
- Modify: `/Users/apostolos/Claude/Code/OUROBOROS/OUROBOROS-Consulting.github.io/assets/css/dashboard.scss`
- Modify: `/Users/apostolos/Claude/Code/OUROBOROS/OUROBOROS-Consulting.github.io/assets/css/quiz.scss`

**Interfaces:**
- Consumes: `dark-island` mixin from Task 1 (available in `main.scss` via its existing `@use "@ouroboros-consulting/ouroboros-design/scss/index" as *;`). `dashboard.scss` and `quiz.scss` have no `@use` of the package — they get literal custom-property redeclarations instead (see Step 2).
- Produces: nothing consumed by later tasks.

### Step 1: Delete the stale light-mode block in `main.scss` (this is the site's own light-mode leftover, now fully superseded)

Read `/Users/apostolos/Claude/Code/OUROBOROS/OUROBOROS-Consulting.github.io/assets/css/main.scss`. Find this exact block:

```scss
// ── Light-mode overrides for dark-background sections ────────────────────
// Nav, footer and heroes keep dark backgrounds in light mode, so their links
// inherit cream rather than gold to stay legible against that dark surface.
//
// This block used to also re-declare nine design tokens (--bg1/2/3, --border,
// --bright, --subdued, --muted, --gold, --gold-border) scoped to nav+footer.
// Removed 2026-07-26. The design system has no light mode at all — tokens are
// defined once on :root, unconditionally — so those declarations only ever
// restated values that were already in effect, while silently freezing them at
// whatever they happened to be when the block was written. They had already
// drifted (--bg1 #141414 vs the real #0c101a, --gold-border #B1935D vs
// #b39f7b) and would have excluded nav and footer from the navy surface shift.
// Do not reintroduce token declarations here.
@media (prefers-color-scheme: light) {
  nav.nav-menu,
  footer,
  #hero,
  .page-hero {
    color: var(--text);

    a { color: inherit; }
  }
}
```

Replace with:

```scss
// ── Light mode ─────────────────────────────────────────────────────────────
// The design system now has a real light mode (_base.scss dark-tokens /
// light-tokens / light-mode / dark-island — see its README). Nav, footer,
// #hero, and .page-hero are dark-island surfaces in the package itself
// (_nav-primary.scss, _footer.scss, _home.scss, _service.scss) and the
// marble surfaces below in this file are dark-island too, so none of them
// need a manual color/link override here anymore — dark-island keeps their
// --text/--gold tokens pinned to dark regardless of the active theme.
// Do not reintroduce token declarations here.
```

### Step 2: Add `dark-island` to the site's own marble surfaces

Read `/Users/apostolos/Claude/Code/OUROBOROS/OUROBOROS-Consulting.github.io/assets/css/main.scss`. Find:

```scss
.page-hero {
  background-image:
    linear-gradient(rgba(30, 33, 62, 0.74), rgba(12, 14, 32, 0.88)),
    url("../images/Marble.png");
```

Replace with:

```scss
.page-hero {
  @include dark-island;
  background-image:
    linear-gradient(rgba(30, 33, 62, 0.74), rgba(12, 14, 32, 0.88)),
    url("../images/Marble.png");
```

Find:

```scss
nav.nav-menu,
.rail,
.page-toc {
  background-image:
    linear-gradient(rgba(18, 18, 18, 0.88), rgba(10, 10, 10, 0.93)),
    url("../images/Marble.png");
```

Replace with:

```scss
nav.nav-menu,
.rail,
.page-toc {
  @include dark-island;
  background-image:
    linear-gradient(rgba(18, 18, 18, 0.88), rgba(10, 10, 10, 0.93)),
    url("../images/Marble.png");
```

Find (the section-header marble comment block and selector):

```scss
.work-header,
.testimonials-header,
.about-header,
.page-body--banded .page-section-label,
```

Read the next few lines after this selector list to find its opening `{` and the first declaration:

```bash
grep -n -A5 "^\.work-header,$" /Users/apostolos/Claude/Code/OUROBOROS/OUROBOROS-Consulting.github.io/assets/css/main.scss
```

Add `@include dark-island;` as the first declaration inside that rule's `{ }` block (the exact selector list and property that follows it — insert immediately after the opening `{`).

### Step 3: Intake page — confirm no change needed

```bash
grep -n "scallop-standard\|intake-body" /Users/apostolos/Claude/Code/OUROBOROS/OUROBOROS-Consulting.github.io/assets/css/main.scss
```

Confirms `.intake-body { @include scallop-standard; }` — this uses the **flipping** default (not `-dark`), because the comment above it in the file says it's layered over `--bg2` (a themed content surface, not marble). This is correct as-is — no edit.

### Step 4: Patch the site's `.safety-exit` shadow

Read `/Users/apostolos/Claude/Code/OUROBOROS/OUROBOROS-Consulting.github.io/assets/css/main.scss`. Find:

```scss
.safety-exit {
  position: fixed;
  bottom: 1rem;
  right: 1rem;
  z-index: 9999;
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.6rem 0.9rem;
  font-family: Inter, system-ui, sans-serif;
  font-size: 0.8rem;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  text-decoration: none;
  color: #fff;
  background: #4f0606;
  border: 1px solid var(--gold-border);
  border-radius: 3px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.4);
  transition: background 0.15s ease, transform 0.15s ease;
```

Replace with:

```scss
.safety-exit {
  position: fixed;
  bottom: 1rem;
  right: 1rem;
  z-index: 9999;
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.6rem 0.9rem;
  font-family: Inter, system-ui, sans-serif;
  font-size: 0.8rem;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  text-decoration: none;
  color: #fff;
  background: #4f0606;
  border: 1px solid var(--gold-border);
  border-radius: 3px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.4);
  transition: background 0.15s ease, transform 0.15s ease;

  @include light-mode {
    box-shadow: 0 2px 10px rgba(28, 32, 41, 0.2);
  }
```

This site rule is the one that actually reaches visitors (it wins the cascade over the package's own `.safety-exit`, which was already patched in Task 3). Both are now patched.

### Step 5: `dashboard.scss` — extend the hand-rolled island pattern

`dashboard.scss` has no `@use` of the design package (confirmed: `head -6` shows only front matter and the local `:root {}` block). `@include dark-island;` is not callable here — extend its existing manual pattern instead.

Read `/Users/apostolos/Claude/Code/OUROBOROS/OUROBOROS-Consulting.github.io/assets/css/dashboard.scss`. Find:

```scss
.gate-hero {
  margin: -3rem -1.5rem 3rem;
  padding: var(--nav-h) 10vw 4rem;
  background-color: var(--bg-hero, #1e213e);
  --text: #E8E4DC;
  --subdued: #B0AAA0;
  --gold: #C9A84C;
  color: var(--text);
```

Replace with:

```scss
.gate-hero {
  margin: -3rem -1.5rem 3rem;
  padding: var(--nav-h) 10vw 4rem;
  background-color: var(--bg-hero, #1e213e);
  // Full dark-island token set, hand-copied because this file has no @use of
  // the design package (see plan Task 9). Keep this in sync with
  // ouroboros-design/scss/_base.scss's dark-tokens mixin if that ever changes.
  --bg1: #0c101a;
  --bg2: #1a1d26;
  --bg3: #22262f;
  --border: #30343e;
  --calloutbg: #252831;
  --shadow: #06080d;
  --bright: #FFFFFF;
  --text: #E8E4DC;
  --subdued: #B0AAA0;
  --muted: #999999;
  --gold: #C9A84C;
  --gold-dim: rgba(201, 168, 76, 0.35);
  --gold-ghost: rgba(201, 168, 76, 0.12);
  --gold-border: #b39f7b;
  --steel: #7F94A6;
  --steel-dim: rgba(127, 148, 166, 0.35);
  --steel-ghost: rgba(127, 148, 166, 0.12);
  --amethyst: #A284CA;
  --amethyst-dim: rgba(162, 132, 202, 0.35);
  --amethyst-ghost: rgba(162, 132, 202, 0.12);
  --sage: #6DA187;
  --sage-dim: rgba(109, 161, 135, 0.35);
  --sage-ghost: rgba(109, 161, 135, 0.12);
  --teal: #5DA19C;
  --teal-dim: rgba(93, 161, 156, 0.35);
  --teal-ghost: rgba(93, 161, 156, 0.12);
  color: var(--text);
```

### Step 6: `quiz.scss` — one confirmed island

Read `/Users/apostolos/Claude/Code/OUROBOROS/OUROBOROS-Consulting.github.io/assets/css/quiz.scss`. Find:

```scss
.quiz-map-area {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 4rem 1.5rem 3rem;
  background-color: #17171e;
```

`#17171e` is a hardcoded near-black matching the dark chrome family, layered with the same gold scallop texture pattern used by islands elsewhere. Classify as an island. `quiz.scss` also has no `@use` — check:

```bash
head -3 /Users/apostolos/Claude/Code/OUROBOROS/OUROBOROS-Consulting.github.io/assets/css/quiz.scss
```

If no `@use` is present, this surface has no CSS custom properties to protect (its background is a literal hex, not `var(--bg1)` etc.), so there is nothing for a light override to corrupt — a plain hex background never changes with the theme regardless. **No edit needed**: `#17171e` already behaves like an island (it's a constant), it just isn't spelled with `dark-island` because it was never token-based to begin with.

Leave these `quiz.scss` values unchanged (confirmed content, not islands, and their alpha is low enough that the theme change doesn't break legibility):
- `rgba(150, 122, 187, 0.3)` (line ~99) — decorative divider line.
- `rgba(201,168,76,0.18)` (line ~153) — drop-shadow glow filter.
- `rgba(106, 142, 127, 0.08)`, `rgba(177, 147, 93, 0.08)` (lines ~468, ~473) — low-alpha answer-state background tints.

### Step 7: Build and manually verify

```bash
cd /Users/apostolos/Claude/Code/OUROBOROS/OUROBOROS-Consulting.github.io
bundle exec jekyll build
grep -c "data-theme" _site/index.html
```

Expected: ≥ 1 (the blocking inline script from Task 8 references `data-theme`, confirming it built in).

### Step 8: Commit

```bash
cd /Users/apostolos/Claude/Code/OUROBOROS/OUROBOROS-Consulting.github.io
git add assets/css/main.scss assets/css/dashboard.scss assets/css/quiz.scss
git commit -m "feat(theme): dark-island on site marble surfaces, remove stale light-mode block, patch safety-exit shadow

- main.scss: delete the pre-2026-07-26 stale color-only light override,
  replaced by dark-island now living in the package + this file's own
  marble rules
- dark-island added to .page-hero, nav.nav-menu/.rail/.page-toc, and the
  section-header marble group
- .safety-exit box-shadow lightened under light-mode (this is the rule that
  actually wins the cascade — the package's own copy was patched separately)
- dashboard.scss .gate-hero: hand-copied full dark-tokens set (no @use in
  this file — see comment)
- quiz.scss: .quiz-map-area's hardcoded #17171e needs no dark-island (not
  token-based, already a constant); four low-alpha decorative rgba() values
  confirmed as content and left unchanged

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Task 10: Deploy-order verification

**Files:** none — this task pushes and verifies, it does not edit.

**Interfaces:**
- Consumes: everything from Tasks 1–9.
- Produces: nothing — terminal task.

### Step 1: Confirm design repo is already merged and pushed

```bash
cd /Users/apostolos/Claude/Code/OUROBOROS/ouroboros-design
git status
git log --oneline -1 origin/main
git log --oneline -1
```

Expected: both `log` commands show the same commit — `main` and `origin/main` match. If they don't, stop and push before continuing (see the PUSH / MERGE BOUNDARY section above Task 8 — this should already be satisfied, this is a final check).

### Step 2: Push the site repo

```bash
cd /Users/apostolos/Claude/Code/OUROBOROS/OUROBOROS-Consulting.github.io
git status
git push origin main
```

### Step 3: Wait for the site's deploy workflow, then curl production

```bash
sleep 90
curl -s https://ouroborosconsulting.org/assets/css/main.css | grep -c 'data-theme'
```

Expected: a number ≥ 1 (proof the compiled production CSS contains the `data-theme` selectors, i.e., the light-mode CSS actually shipped — not just that CI went green).

If the count is 0, the site's GitHub Actions run may still be in progress — check `https://github.com/OUROBOROS-Consulting/OUROBOROS-Consulting.github.io/actions` before concluding it failed. A green CI run is not itself proof; only the curl is.

### Step 4: Visual sign-off (blocked on Apostolos)

Automated checks (contrast, build, curl) confirm the CSS is correct and deployed. They cannot confirm the light theme *looks* right. This step needs Apostolos:

**Needs you:**
- Visit `https://ouroborosconsulting.org`, click the new rail toggle (bottom of the left icon rail), confirm the page switches to light and back, and confirm the marble nav/footer/rail/hero stay dark in both states.
- If the site's GitHub Pages source is not already set to serve from Actions (vs. a branch), confirm that in repo Settings → Pages — this plan does not touch that setting.

---

## Self-Review

**Spec coverage:** every section of the approved spec maps to a task above — token architecture and contrast enforcement (Task 1), texture/elevation re-tuning (Tasks 2–3), dark islands (Task 4), toggle UI (Tasks 5, 8), CI preview repair (Task 6), documentation (Task 7), site-side application (Task 9), and deploy verification with the explicit "Needs Apostolos" sign-off (Task 10).

**Placeholder scan:** no task contains "TBD," "similar to above," or an undemonstrated code step — every `Replace with:` block is complete, copy-pasteable code. Nothing is left open. The `gh-pages` branch and Pages configuration Task 6 depends on were resolved on 2026-08-06, before implementation began.

**Post-authorship correction (2026-08-06).** The light surface ramp originally shipped in this plan inverted `--bg1`/`--bg3` relative to dark (`--bg1: #F4F5F8` … `--bg3: #DEE1E9`), making elevation read as *darker* in light mode. That inverted the `--bg3` gradient at the top of `elevation-elevated` into a dark band fighting its own `rgba(255,255,255,0.04)` inset highlight, and collapsed `--calloutbg` to within 1.05:1 luminance of the page floor, making callouts effectively invisible. The four surface values were replaced with an order-preserving mirror (`--bg1: #E7EAF0`, `--bg2: #EFF1F5`, `--bg3: #F5F7FA`, `--calloutbg: #FCFDFE`). **All twelve accent/ink values are unchanged** — they were verified correct to 0.01 against the original ramp and clear their floors with more margin against the new one (worst case `--gold` at 4.93:1, up from 4.55:1). `--border` and `--shadow` are unchanged. The contrast checker derives its worst-case surface dynamically from the parsed CSS, so it needs no edit.

**Type/name consistency:** `dark-tokens`/`light-tokens`/`light-mode`/`dark-island` (Task 1) are the exact names used, unchanged, in every later task that consumes them (Tasks 2, 3, 4, 9). `scallop-*-dark`/`elevation-*-dark` (Task 2) match exactly at their three call sites (Task 2 Step 4) and are never referenced again after that. `.rail-item--button` (Task 5) matches exactly the class Task 8's markup emits. `#theme-toggle` (Task 8 markup) matches exactly the ID Task 8's JS queries — same task, verified consistent.

**Two findings beyond the corrections carried into this plan, surfaced for visibility:**
1. **`dark-island` is defined as a trivial `@include dark-tokens;` wrapper**, not a hand-copied property list. An earlier sketch of this mixin (seen during research, not reproduced in this plan) listed only ~18 base hex values and omitted the ten `-dim`/`-ghost` rgba variants — which are real, active call sites (`_sidebar-rail.scss`'s `.rail-item:hover { background: var(--gold-ghost); }` is one). Had `dark-island` been hand-copied without them, any island nested under a light-theme `:root` would leak light-derived `-dim`/`-ghost` values through cascade inheritance. The wrapper approach in Task 1 makes this structurally impossible rather than relying on a maintained-by-hand list staying in sync.
2. **The dark `--subdued` comment already correctly says "AA," not "AAA."** During research, an earlier pass (based on a compacted summary, not the live file) suspected `_base.scss` mislabeled `--subdued`'s 6.4:1 dark ratio as AAA. Re-reading the actual file for this plan showed the comment already says "6.4:1 (8.2) — AA for normal text on every surface" — accurate as written. No correction was needed; the checker's dark floor for `--subdued` (4.5, not 7) simply matches what the file already documents.

Plan complete and saved to `docs/superpowers/plans/2026-08-06-light-mode.md`. Two execution options:

**1. Subagent-Driven (recommended)** — dispatch a fresh subagent per task, review between tasks, fast iteration.

**2. Inline Execution** — execute tasks in this session using executing-plans, batch execution with checkpoints.

**Which approach?**
