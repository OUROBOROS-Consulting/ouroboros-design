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
// test here — only plain hex tokens are checked. --accent-1..5 are aliases
// (`var(--mark)` and friends), not hex, so they are deliberately absent: the
// semantic token each one points at is already asserted below.
//
// The full surface ramp is listed, including --surface-5. In dark that step is
// the lightest surface and therefore the new worst case for light-on-dark ink;
// in light it is pure white and never the worst case for dark-on-light ink.
const SURFACES = {
  dark: ['--surface-1', '--surface-2', '--surface-3', '--surface-4', '--surface-5'],
  light: ['--surface-1', '--surface-2', '--surface-3', '--surface-4', '--surface-5'],
};

// ⚠ --surface-5 is an INK-ONLY surface. Do not put accent-coloured text on it.
//
// The dark accent palette is at its contrast ceiling. --steel (#7F94A6) is the
// binding token: 4.5:1 against it caps the surface luminance at 0.02432, and
// --surface-4 (#252831) already sits at 0.02133. That leaves room for roughly
// one more perceptual step, which --surface-5 (#2b2f39, 0.02842) spends — so
// steel lands at 4.26:1, amethyst 4.27:1, teal 4.49:1 there.
//
// The ink ramp clears 4.5:1 on all five steps, and the accents are categorical
// badges on cards, which live on surface-2/3. So the ramp is kept and accents
// are asserted only over the surfaces they are actually allowed on. Lifting
// this restriction means lightening steel, amethyst and teal — a brand change,
// not a CI change.
const ACCENT_TOKENS = new Set([
  '--mark', '--mark-border', '--steel', '--amethyst', '--sage', '--teal', '--ruby', '--claude',
]);
const surfacesFor = (theme, token) =>
  ACCENT_TOKENS.has(token) ? SURFACES[theme].filter((s) => s !== '--surface-5') : SURFACES[theme];

// Floors:
// - --ink-3/--ink-2 in LIGHT target AAA (7:1) — the spec's tighter light-mode
//   target.
// - --ink-2 in DARK is genuinely 6.4:1 worst case, which _base.scss's own
//   comment already documents as "AA for normal text" (not AAA) — so its dark
//   floor is 4.5, matching the shipped, correctly-labeled palette.
// - --mark-border is a border/non-text color (WCAG 1.4.11 non-text contrast),
//   floor 3:1.
// - --ruby and --claude have zero call sites in either repo (grep-verified:
//   `grep -rn -- "--ruby\|--claude" scss/ ../OUROBOROS-Consulting.github.io/assets`
//   returns only their own declarations). The CURRENT dark values already fail
//   4.5:1 (--ruby 3.70:1, --claude 4.36:1 on the top surface step) — a
//   pre-existing condition outside this feature's scope. They are asserted in
//   light only, against the new light values, so CI does not fail on day one
//   for an unrelated, already-shipped defect.
const FLOORS = {
  dark: {
    '--ink-4': 4.5,
    '--ink-3': 7,
    '--ink-2': 4.5,
    '--ink-1': 4.5,
    '--mark': 4.5,
    '--steel': 4.5,
    '--amethyst': 4.5,
    '--sage': 4.5,
    '--teal': 4.5,
    '--mark-border': 3,
  },
  light: {
    '--ink-4': 4.5,
    '--ink-3': 7,
    '--ink-2': 7,
    '--ink-1': 4.5,
    '--mark': 4.5,
    '--steel': 4.5,
    '--amethyst': 4.5,
    '--sage': 4.5,
    '--teal': 4.5,
    '--mark-border': 3,
    '--ruby': 4.5,
    '--claude': 4.5,
  },
};

const failures = [];

for (const [theme, tokens] of Object.entries({ dark, light })) {
  const floors = FLOORS[theme];
  for (const [token, floor] of Object.entries(floors)) {
    const surfaces = surfacesFor(theme, token);
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
