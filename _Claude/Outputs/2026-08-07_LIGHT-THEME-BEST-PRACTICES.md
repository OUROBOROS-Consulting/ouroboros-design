# Light theme: external best practice applied to open decisions

Research pass on four open questions. Findings mapped to the specific decision each one settles.

## 1. Body gradient vs WCAG

- **Rule:** contrast over a gradient is judged at the worst point under the text, not the average. Most decorative gradient backgrounds fail because authors test the midpoint.
- **This gradient is safe by construction.** Both stops derive from tokens already asserted by `npm run check:contrast`, so neither stop leaves the audited range.
  - Dark top stop resolves to `#141721`. Darker than `--calloutbg` (`#252831`), which is the asserted worst-case dark surface. Every ink token scores higher on the gradient than on the floor it was certified against. Lowest: `--muted` at 6.28:1 vs the 5.17:1 already accepted.
  - Light top stop resolves to `#ebeef3`. Lighter than `--bg1` (`#E7EAF0`), the asserted worst-case light surface. Dark ink on a lighter field means higher contrast, not lower. Lowest: `--gold` at 5.11:1 vs 4.93:1.
- **Named gap:** the checker tests flat token values. It does not evaluate the `color-mix()` stop. The safety above holds by argument, not by assertion. If the surface ramp is ever retuned, that argument has to be re-run by hand.

## 2. `background-attachment: fixed`

- **Rule:** `fixed` forces a full repaint on every scroll frame. Measured penalties around 10 FPS. iOS Safari ignores the keyword outright.
- **Recommendation: drop `fixed`.** Two reasons converge.
  - Mobile Safari already renders the document-length version, so keeping `fixed` buys a desktop-only difference and pays a scroll cost for it.
  - The alternative fix (a `position: fixed` pseudo-element on its own compositing layer) is more machinery than a subtle floor tint justifies.
- Tradeoff, stated plainly: without `fixed` the top stop appears once at the top of the document rather than on every screenful. On a long page the gradient becomes a masthead effect instead of an ambient one.

## 3. Light-mode elevation direction

- **Rule (Material Design):** shadow carries elevation in light mode. Lightness carries it in dark mode. Higher surface equals lighter surface. It is explicitly not an inverted system.
- **No change needed.** The existing decision documented at `scss/_base.scss:72-85` keeps the same ramp order in both palettes, and the `elevation-*` mixins already paint `box-shadow: … var(--shadow)` with a themed `--shadow` (`rgba(28, 32, 41, 0.18)` in light). Both halves of Material's rule are already satisfied.
- This closes the long-open "light surface ramp direction" question. Keep the ramp as is.

## 4. CSS size ceiling

- **Rule:** under 20 KB gzipped is "very good." No real concern until 50-100 KB. Render-blocking is why it matters at all.
- **Measured:** 130,637 B raw, 17,370 B on the wire with `content-encoding: gzip`.
- **Close this item.** The light theme's added token set is not a size problem.

## Still the user's call

- **Home-page section backgrounds.** `scss/_home.scss:364` paints `#values, #services, #work, #testimonials, #cta` with an opaque `background: var(--bg1)`. Until one of those gives up its fill, the body gradient is invisible on `/`. No best-practice source settles this. It is a composition choice.

## Defects surfaced during the pass

- **`--gold` drift.** Package `dark-tokens` carries `#b39f7b`. All three hand-copied island sets (`quiz.scss:53`, `intake.scss:40`, `dashboard.scss:127`) carry `#C9A84C`. Exactly the drift the sync comments warn about.
- **Pre-existing, adjacent:** `--gold-dim` and `--gold-ghost` in the package still use `rgba(201, 168, 76, …)`, which is `#C9A84C`. They were not updated when `--gold` darkened. Flagged, not touched.
- **`#psa-section-header` vs `.psa-section-header`** at `main.scss:138`. One character. Restores marble to two bands on `psas.html` and `tutorials.html` that currently render flat black.
- **`.service-card-icon` vs `.card-icon`** in `intake.scss`. The old selector never matched, so intake icons render white today. The new corner-icon rule sets `--gold`, which changes them on next deploy.
- **Font Awesome fallback glyphs** stayed at 2.4rem / 1.6rem while the SVG boxes grew 10%. Glyph cards now read smaller than SVG cards.

## Sources

- [CSS-Tricks — The Fixed Background Attachment Hack](https://css-tricks.com/the-fixed-background-attachment-hack/)
- [Four Kitchens — Fix scrolling performance with the CSS will-change property](https://www.fourkitchens.com/blog/article/fix-scrolling-performance-css-will-change-property/)
- [Chen Hui Jing — On fixed elements and backgrounds](https://chenhuijing.com/blog/on-fixed-elements-and-backgrounds/)
- [Material Components for Android — Dark theme](https://github.com/material-components/material-components-android/blob/master/docs/theming/Dark.md)
- [Muzli — Dark mode design systems: patterns, tokens, and hierarchy](https://muz.li/blog/dark-mode-design-systems-a-complete-guide-to-patterns-tokens-and-hierarchy/)
- [DebugBear — How CSS affects page speed](https://www.debugbear.com/blog/css-page-speed)
- [CSS Auditors — CSS file sizes and file count](https://css-auditors.com/blog/the-second-css-report-about-css-file-sizes-and-file-count/)
- [MDN — CSS performance optimization](https://developer.mozilla.org/en-US/docs/Learn_web_development/Extensions/Performance/CSS)
- [AChecks — Accessible colour contrasts with gradient backgrounds](https://www.achecks.org/gradients-accessible-colour-contrasts-with-gradient-backgrounds/)
- [WebAIM — Contrast and Color Accessibility](https://webaim.org/articles/contrast/)
- [Instant Gradient — Accessible gradient guide](https://instantgradient.com/blog/accessible_gradient_guide)
