# SCSS Restructure Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Consolidate all card definitions into `_cards.scss`, all font-family choices into `_typography.scss`, and all button components into `_buttons.scss`, eliminating silent overrides and dead code.

**Architecture:** Three targeted surgeries — (1) lift `$font-*` vars out of `_base.scss` into `_typography.scss` and reorder the import chain, (2) migrate the authoritative card classes from `_home.scss` into `_cards.scss` and scope what remains, (3) move `_cards.scss`-resident CV utilities to `_cv.scss`. Buttons need no changes — nav controls are nav-scoped, not global components.

**Tech Stack:** SCSS, Hugo static site

---

## File Map

| File | Change |
|------|--------|
| `scss/index.scss` | Reorder: `typography` before `base` |
| `scss/_base.scss` | Remove `$font-*` variable block (lines 1–6) |
| `scss/_typography.scss` | Add `$font-*` vars to top; receive card-associated text classes |
| `scss/_cards.scss` | Replace weak card definitions with authoritative home versions; add responsive rule; remove `.cv-cards` |
| `scss/_home.scss` | Remove `.cards`, `.card`, `.card-tag`, `.card-title`, `.card-desc`, `.card-link`, `.card blockquote` blocks; remove responsive card/grid rule |
| `scss/_cv.scss` | Receive `.cv-cards` |

---

### Task 1: Move font variables into `_typography.scss`

**Files:**
- Modify: `scss/_base.scss` (remove lines 1–6)
- Modify: `scss/_typography.scss` (add vars at top)
- Modify: `scss/index.scss` (reorder imports)

- [ ] **Step 1: Add font vars to top of `_typography.scss`**

Open `scss/_typography.scss` and prepend:

```scss
// ── Font family choices (single source of truth) ─────────────────────────────
$font-serif:     'Lora', Georgia, serif;
$font-sans:      'Inter', 'DejaVu Sans', system-ui, sans-serif;
$font-mono:      'JetBrains Mono', monospace;
$font-cormorant: 'Cormorant SC', 'Cormorant Garamond', Georgia, serif;

```

- [ ] **Step 2: Remove the font var block from `_base.scss`**

Delete lines 1–6 from `scss/_base.scss`:

```scss
// ── SCSS font variables (single source of truth — used by every partial) ──────
$font-serif: 'Lora', Georgia, serif;
$font-sans: 'Inter', 'DejaVu Sans', system-ui, sans-serif;
$font-mono: 'JetBrains Mono', monospace;
$font-cormorant: 'Cormorant SC', 'Cormorant Garamond', Georgia, serif;
```

- [ ] **Step 3: Reorder imports in `index.scss`**

Change:

```scss
@import "base";
@import "typography";
```

To:

```scss
@import "typography";
@import "base";
```

- [ ] **Step 4: Verify build compiles**

```bash
npm run build
```
Expected: no SCSS compile errors. `$font-sans` must resolve in `_typography.scss` before it's used in the `label-caps` mixin.

- [ ] **Step 5: Commit**

```bash
git add scss/_typography.scss scss/_base.scss scss/index.scss
git commit -m "refactor(scss): move font-family variables into _typography.scss"
```

---

### Task 2: Move authoritative card classes from `_home.scss` to `_cards.scss`

**Context:** `_home.scss` defines `.cards`, `.card`, `.card-tag`, `.card-title`, `.card-desc`, `.card-link`, and `.card blockquote` with the FINAL styles. Since `home` is imported after `cards` in `index.scss`, the home versions globally override the `_cards.scss` versions on every page. The fix: move the authoritative definitions to `_cards.scss`, delete the now-duplicate weaker versions in `_cards.scss`, and remove the originals from `_home.scss`.

**Files:**
- Modify: `scss/_cards.scss`
- Modify: `scss/_home.scss`

- [ ] **Step 1: Replace `.cards` definition in `_cards.scss`**

Find in `_cards.scss`:

```scss
// ── Cards grid ───────────────────────────────────────────────────────────────
.cards {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(500px, 1fr));
  gap: 1.5px;
}
```

Replace with the authoritative home version:

```scss
// ── Cards grid ───────────────────────────────────────────────────────────────
.cards {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(500px, 2fr));
  gap: 1px; // border-collapse effect
  background: var(--border);
}
```

- [ ] **Step 2: Replace `.card` definition in `_cards.scss`**

Find in `_cards.scss` (the full `.card { ... }` block with the elevation mixin, border, hover underline, etc.):

```scss
// ── Card component ───────────────────────────────────────────────────────────
.card {
  @include elevation-standard;
  padding: 2.5rem;
  border: 1px solid var(--border);
  position: relative;
  overflow: hidden;
  transition: border-color 0.3s, transform 0.3s, box-shadow 0.3s;

  // Gold underline reveal on hover
  &::after {
    content: '';
    position: absolute;
    bottom: 0;
    left: 0;
    width: 100%;
    height: 2px;
    background: var(--gold-border);
    transform: scaleX(0);
    transform-origin: left;
    transition: transform 0.4s;
  }

  &:hover {
    border-color: var(--gold);
    transform: translateY(-4px);
    box-shadow: 0 8px 24px var(--shadow), 0 0 20px var(--gold-ghost);

    &::after {
      transform: scaleX(1);
    }
  }
}
```

Replace with:

```scss
// ── Card component ───────────────────────────────────────────────────────────
.card {
  background: var(--bg1);
  padding: 2rem 2rem 2.5rem;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  transition: background 0.3s;

  &:hover {
    background: var(--bg2);
  }

  // Values and testimonials cards use bg2 as base, so invert hover
  #values &,
  #testimonials & {
    background: var(--bg2);

    &:hover {
      background: var(--bg3);
    }
  }
}
```

- [ ] **Step 3: Replace `.card-tag`, `.card-title`, `.card-desc`, `.card-link` in `_cards.scss`**

Find the four blocks in `_cards.scss`:

```scss
.card-tag {
  font-size: 0.78rem;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: var(--gold);
  margin-bottom: 1rem;
}

.card-title {
  font-family: $font-serif;
  font-size: 1.3rem;
  font-weight: 400;
  margin-bottom: 0.8rem;
  line-height: 1.3;
}

.card-desc {
  color: var(--subdued);
  font-size: 0.93rem;
  line-height: 1.85;
}

.card-link {
  display: inline-block;
  margin-top: 1.5rem;
  font-size: 0.78rem;
  letter-spacing: 0.15em;
  text-transform: uppercase;
  color: var(--gold);
  text-decoration: none;
  transition: letter-spacing 0.3s;

  &:hover {
    letter-spacing: 0.22em;
  }

  &--soon {
    color: var(--muted);
    font-style: italic;
    letter-spacing: 0.1em;
  }
}
```

Replace with the authoritative home versions:

```scss
.card-tag {
  @include label-caps(0.65rem, 0.2em);

  // Strip margins from markdownify
  p {
    margin: 0;
  }
}

.card-title {
  font-family: $font-serif;
  font-size: clamp(1.1rem, 2vw, 1.4rem);
  font-weight: 400;
  line-height: 1.3;
  color: var(--text);
}

.card-desc {
  font-size: 0.88rem;
  color: var(--subdued);
  line-height: 1.85;
  flex-grow: 1; // pushes card-link to bottom

  // Strip margins from markdownify
  p {
    margin: 0;
  }
}

.card-link {
  display: inline-block;
  margin-top: auto;
  font-size: 0.75rem;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--gold);
  text-decoration: none;
  transition: opacity 0.2s;

  &:hover {
    opacity: 0.7;
  }
}

// Scoped to .card so it doesn't affect .post-body blockquote
.card blockquote {
  border: none;
  background: none;
  padding: 0;
  margin: 0;

  p {
    margin: 0;
  }

  cite {
    display: block;
    margin-top: 1rem;
    font-family: $font-sans;
    font-size: 0.72rem;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: var(--gold);
    font-style: normal;
  }
}
```

- [ ] **Step 4: Add responsive card rule to `_cards.scss`**

At the bottom of `_cards.scss`, add:

```scss
@media (max-width: 768px) {
  .cards,
  .testimonials-grid {
    grid-template-columns: 1fr;
  }
}
```

- [ ] **Step 5: Delete the migrated blocks from `_home.scss`**

Remove from `scss/_home.scss`:

1. The entire `// ── Card grid ──` comment + `.cards { ... }` block (lines ~260–268)
2. The entire `// ── Card ──` comment + `.card { ... }` block (lines ~270–292)
3. `.card-tag { ... }` block (lines ~294–301)
4. `.card-title { ... }` block (lines ~303–309)
5. `.card-desc { ... }` block (lines ~311–321)
6. `.card-link { ... }` block (lines ~323–336)
7. `// ── Blockquote inside testimonial / values cards ──` comment + `.card blockquote { ... }` block (lines ~338–360)
8. Inside the `@media (max-width: 768px)` block, remove the `.cards, .testimonials-grid { grid-template-columns: 1fr; }` rule (lines ~394–397) — keep the rest of the media query intact.

- [ ] **Step 6: Verify build and check all pages visually**

```bash
npm run build
```

Check home, services, and essay pages — card styles must be unchanged. The border-collapse grid (`background: var(--border); gap: 1px`) must render on home.

- [ ] **Step 7: Commit**

```bash
git add scss/_cards.scss scss/_home.scss
git commit -m "refactor(scss): consolidate card classes into _cards.scss"
```

---

### Task 3: Move `.cv-cards` from `_cards.scss` to `_cv.scss`

**Files:**
- Modify: `scss/_cards.scss` (remove `.cv-cards`)
- Modify: `scss/_cv.scss` (receive `.cv-cards`)

- [ ] **Step 1: Remove `.cv-cards` from `_cards.scss`**

Find and delete from the bottom of `scss/_cards.scss`:

```scss
// In _cards.scss or your CV stylesheet
.cv-cards {
  display: flex;
  flex-direction: column;
  gap: 3px; // keep this small so cards feel grouped
  margin-bottom: 4rem; // ← space after each section's card stack
  border-left: 1px solid var(--border);
}
```

- [ ] **Step 2: Add `.cv-cards` to `_cv.scss`**

At the top of the CV card section in `scss/_cv.scss` (search for the first `.cv-` class), add:

```scss
// ── CV card stack ─────────────────────────────────────────────────────────────
.cv-cards {
  display: flex;
  flex-direction: column;
  gap: 3px;
  margin-bottom: 4rem;
  border-left: 1px solid var(--border);
}
```

- [ ] **Step 3: Verify build — CV page renders correctly**

```bash
npm run build
```

Check the CV page — the `.cv-cards` stacking layout must be identical before and after.

- [ ] **Step 4: Commit**

```bash
git add scss/_cards.scss scss/_cv.scss
git commit -m "refactor(scss): move .cv-cards to _cv.scss"
```

---

### Task 4: Move `.carousel-btn` from `_home.scss` to `_buttons.scss`

**Context:** `.carousel-btn` is a genuine button component — gold border, background/color hover states, identical pattern to `.btn`. `.hero-cta` is just `margin-top: 0.5rem` (a layout wrapper) and stays in `_home.scss`.

**Files:**
- Modify: `scss/_home.scss` (remove `.carousel-btn`)
- Modify: `scss/_buttons.scss` (receive `.carousel-btn`)

- [ ] **Step 1: Remove `.carousel-btn` from `_home.scss`**

Find and delete from `scss/_home.scss`:

```scss
.carousel-btn {
  background: transparent;
  border: 1px solid var(--gold);
  color: var(--gold);
  width: 2.4rem;
  height: 2.4rem;
  cursor: pointer;
  font-size: 1rem;
  line-height: 1;
  transition: background 0.2s, color 0.2s;
  flex-shrink: 0;

  &:hover {
    background: var(--gold);
    color: var(--bg1);
  }
}
```

- [ ] **Step 2: Add `.carousel-btn` to `_buttons.scss`**

Append to `scss/_buttons.scss`:

```scss
// ── Carousel prev/next button ─────────────────────────────────────────────────
.carousel-btn {
  background: transparent;
  border: 1px solid var(--gold);
  color: var(--gold);
  width: 2.4rem;
  height: 2.4rem;
  cursor: pointer;
  font-size: 1rem;
  line-height: 1;
  transition: background 0.2s, color 0.2s;
  flex-shrink: 0;

  &:hover {
    background: var(--gold);
    color: var(--bg1);
  }
}
```

- [ ] **Step 3: Verify build — carousel buttons render correctly on home**

```bash
npm run build
```

Check the testimonials/values carousel on the home page — prev/next buttons must be unchanged.

- [ ] **Step 4: Commit**

```bash
git add scss/_buttons.scss scss/_home.scss
git commit -m "refactor(scss): move .carousel-btn to _buttons.scss"
```

---

### Task 5: Rename unprefixed timeline classes to `tl-` prefix

**Context:** `_timeline.scss` uses `.dot`, `.interval-track`, `.interval-band` — all timeline-specific but missing the `tl-` prefix unlike every other class in that file. `.dot` is also used in `_includes/timeline.html` in the GitHub repo `OUROBOROS-Consulting/OUROBOROS.github.io`. `.interval-track` and `.interval-band` are SCSS-only (no HTML usage found).

**Files:**
- Modify: `scss/_timeline.scss` (rename all three classes)
- Modify: `OUROBOROS-Consulting/OUROBOROS.github.io/_includes/timeline.html` (rename `.dot` → `.tl-dot`)

- [ ] **Step 1: Rename `.dot` → `.tl-dot` in `_timeline.scss`**

In `scss/_timeline.scss`, find:

```scss
.dot {
```

Replace with:

```scss
.tl-dot {
```

- [ ] **Step 2: Rename `.interval-track` → `.tl-interval-track` in `_timeline.scss`**

In `scss/_timeline.scss`, find:

```scss
.interval-track {
```

Replace with:

```scss
.tl-interval-track {
```

- [ ] **Step 3: Rename `.interval-band` → `.tl-interval-band` in `_timeline.scss`**

In `scss/_timeline.scss`, find:

```scss
.interval-band {
```

Replace with:

```scss
.tl-interval-band {
```

- [ ] **Step 4: Update HTML in GitHub repo**

In `OUROBOROS-Consulting/OUROBOROS.github.io`, edit `_includes/timeline.html` line 33.

Change:

```html
<div class="dot"></div>
```

To:

```html
<div class="tl-dot"></div>
```

Use `gh api` to commit directly:

```bash
# Get current file SHA
SHA=$(gh api repos/OUROBOROS-Consulting/OUROBOROS.github.io/contents/_includes/timeline.html --jq '.sha')

# Get current content, patch it, re-encode
CONTENT=$(gh api repos/OUROBOROS-Consulting/OUROBOROS.github.io/contents/_includes/timeline.html --jq '.content' | python3 -c "import sys,base64; print(base64.b64decode(sys.stdin.read()).decode())" | sed 's/class="dot"/class="tl-dot"/g' | base64)

# Commit
gh api repos/OUROBOROS-Consulting/OUROBOROS.github.io/contents/_includes/timeline.html \
  --method PUT \
  --field message="refactor(timeline): rename .dot to .tl-dot for naming consistency" \
  --field content="$CONTENT" \
  --field sha="$SHA"
```

- [ ] **Step 5: Verify build**

```bash
npm run build
```

Check the timeline page — dots and interval bands must render identically.

- [ ] **Step 6: Commit**

```bash
git add scss/_timeline.scss
git commit -m "refactor(scss): add tl- prefix to .dot, .interval-track, .interval-band"
```

---

## Self-Review Checklist

- [x] Spec coverage: typography vars ✓, card consolidation ✓, cv-cards ✓, `.carousel-btn` → buttons ✓, timeline renames ✓
- [x] No placeholders — all steps include exact code
- [x] `$font-sans` is defined at top of `_typography.scss` before `label-caps` mixin uses it
- [x] Import reorder: `typography` before `base` so `body { font-family: $font-serif }` still resolves
- [x] Responsive `.cards` rule migrated to `_cards.scss` alongside the class definition
- [x] `.card blockquote` migrated — prevents post-body blockquote bleed
- [x] HTML in OUROBOROS-Consulting/OUROBOROS.github.io updated for `.dot` → `.tl-dot`
- [x] `.interval-track` and `.interval-band` SCSS-only — no HTML changes needed
