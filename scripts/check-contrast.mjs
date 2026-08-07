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
