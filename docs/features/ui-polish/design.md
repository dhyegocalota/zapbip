# UI polish: design

**Feature:** [ui-polish](spec.md)
**Written by:** `frontend-designer`
**Scope:** every backoffice page (sign-in, home, numbers list, register, number detail, verification result, metrics, audit, error pages) and the Mintlify docs theme, logo, background, Overview hero and chat mockup.
**Builds on:** [backoffice design](../backoffice/design.md). Its screens, states, copy keys, focus orders and options 1 to 8 stay as decided; this document changes how they look, adds the hooks the new look needs and nothing else.

## 0. Starting point

What is on screen today, from the walks of the shipped features (git-ignored, in the owner's checkout):

| Surface | Screenshots |
|---|---|
| Backoffice 1280 | `.pr-media/backoffice/home-1280-en.png`, `numbers-empty-1280-en.png`, `register-form-1280-en.png`, `number-detail-pending-1280-en.png`, `verification-result-1280-en.png`, `audit-1280-en.png`, `error-404-1280-ptbr.png`, `sign-in-wrong-code-1280-ptbr.png` |
| Backoffice 375 | `.pr-media/backoffice/sign-in-375-ptbr.png`, `home-375-ptbr.png`, `numbers-one-375-ptbr.png`, `number-detail-375-ptbr.png`, `audit-375-ptbr.png` |
| Docs | `.pr-media/docs-experience/overview-en-1280.png`, `overview-en-375.png`, `pt-br-index-375.png` |

The fresh `before-*.png` set is taken by the `recorder` on merged `main` (the metrics page included) into `/Users/dhyegocalota/Projects/zapbip/zapbip/.pr-media/ui-polish/` before lane A or lane B changes anything (plan step 1, owner delegated 2026-11-06). The tester takes the after set on the same ports and data.

What those screens show, and what this design fixes:

| Today | Consequence | Fixed by |
|---|---|---|
| Number detail: four cards stacked with no gap (only `main > .card` gets a margin) | reads as one broken box | §8 flow spacing, §9.6 two-column layout |
| Header: locale buttons and sign-out are full secondary buttons with uneven gaps | the busiest thing on every page is the language switch | §8 segmented controls |
| Six-digit code inputs are as wide as the card (1 054 px on number detail) | the input says "type a paragraph" | §8 `--measure-code` |
| Audit at 375: the page is 400 px wide; long mono targets push the stacked row out | horizontal scroll, the header no longer spans the page | §8 tables at 375 (`min-width: 0`) |
| `.chart-reference` has no rule on `feat/backoffice-metrics` | the budget limit and 80% threshold lines are invisible (an SVG `line` with no stroke) | §8 charts |
| Docs: `colors.primary` `#128C7E` is the link and active-nav colour | 4.14:1 on white, fails AA for text | §10 `colors.primary` `#0B6B60` |
| Docs chat mockup: header `#128C7E` with white 15 px text, sender names `#128C7E`, time `#667781` on the sent bubble | 4.14:1, 4.14:1 and 4.19:1, all fail AA | §10 chat palette |

## 1. Constraints

Unchanged from the backoffice design §1: CSP `default-src 'none'; style-src 'self'; img-src 'self'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'`, no script, no `style=""`, no external font. Everything below is one stylesheet. SVG presentation attributes (`x`, `width`, `rx`) are not styles and stay allowed.

Mintlify, checked against the client the CLI caches (`~/.mintlify/mint/apps/client`): `docs.json` accepts `theme` (`mint`, `maple`, `palm`, `willow`, `linden`, `almond`, `aspen`, `sequoia`, `luma`), `colors.primary`/`light`/`dark`, `background.decoration` (`gradient`, `grid`, `windows`), `background.color.light`/`dark`, `appearance.default`, `logo.light`/`dark`/`href`, `fonts.family` and `styling`. Every `.css` file in the docs folder is injected as `<style data-custom-css-path>`. The tester confirms both with `--client-version 0.0.4077` (test plan), because the cache is not pinned to that version.

## 2. Brand idea: "Signal"

zapbip is the moment your phone lights up because your AI needs you. The identity takes two things from that moment and uses nothing else:

1. **The bubble tail.** Every container (card, notice, table, figure, sign-in panel, hero) has three round corners and one tight corner, top-left, like an incoming WhatsApp message. Badges and buttons are full pills. The brand mark is the favicon's bubble with three dots, drawn in CSS in the backoffice and in SVG in the docs.
2. **The signal.** One luminous green, `#25D366`, used only as light: the live dot, the glow around the mark, the page's top glow, the hero chip. It never carries text in light mode. Text and buttons use the deep teal `#0B6B60`; in dark mode the green itself becomes the action colour.

The result is calm and dense like an operator console, with one living accent. Numbers use rounded display type (`ui-rounded`, SF Pro Rounded on Apple, the system face elsewhere), which echoes the bubbles without a font download.

## 3. Direction options

| | **A: Signal** (recommended) | **B: Console** |
|---|---|---|
| Idea | Light first; paper-mint page, white bubble-tail cards, signal-green light, rounded display numerals; deep night-green dark mode | Dark first; monospace everywhere, phosphor green `#39FF88` on near-black, square panels, prompt glyphs (`$`, `>`, `[ ok ]`), scanline background |
| Mockups | `.pr-media/ui-polish/design/option-a-*.png` (12 files, §9 lists them) | `.pr-media/ui-polish/design/option-b-home-1280.png` |
| Fit with the harness | "Light mode first; dark is a token switch" holds | Breaks it: light mode becomes the afterthought |
| Readability | System sans for prose; mono only for identifiers | Mono for pt-BR prose is 15 to 20% wider and slower to read; long help texts wrap badly at 375 |
| Docs | The same tokens map onto Mintlify's `mint` theme | Mintlify cannot be made mono-first without overriding its whole type scale in custom CSS |
| Audience | The operator and "anyone who uses AI" (docs) | Speaks to developers only, which the docs explicitly are not for |
| Risk | Low: same DOM, one stylesheet | Medium: heavy custom CSS on Mintlify, contrast of phosphor on black glows and blurs for low-vision users |

Recommendation: **A, Signal.** It is distinctive (the tail corner and the signal light are ownable, not template), it is readable in both locales, and it is the same identity on both surfaces.

## 4. Palette

Tokens live in `:root` of `apps/api/src/backoffice/assets/backoffice.css`; dark mode redefines the same names in the existing `@media (prefers-color-scheme: dark)` block. "New" marks a token this feature adds; "changed" marks a new value.

### 4.1 Colour tokens

| Token | Light | Dark | Role | Status |
|---|---|---|---|---|
| `--color-page` | `#F6F8F5` | `#07120F` | page | changed |
| `--color-surface` | `#FFFFFF` | `#0D1B17` | cards, tables, inputs | changed (dark) |
| `--color-sunken` | `#EEF3EF` | `#0A1613` | nav and locale tracks, table header, empty bubble | new |
| `--color-raised` | `#FFFFFF` | `#15261F` | the selected pill in the nav and locale switch | new |
| `--color-header` | `rgb(255 255 255 / 0.88)` | `rgb(13 27 23 / 0.88)` | sticky header behind `backdrop-filter: blur` | new |
| `--color-text` | `#0E1F1A` | `#E8F1ED` | body, headings | changed |
| `--color-text-muted` | `#4B5E57` | `#9DB2AA` | help, captions, eyebrows | changed |
| `--color-border` | `#DCE5E0` | `#1F332D` | decorative dividers | changed |
| `--color-border-control` | `#7A8C85` | `#5F7A71` | input, select, secondary button borders | changed |
| `--color-brand` | `#128C7E` | `#25D366` | mark, solid chart bars | changed (dark) |
| `--color-on-brand` | `#FFFFFF` | `#04140C` | dots inside the mark | new |
| `--color-signal` | `#25D366` | `#25D366` | live dot, glows, hero border start; never text in light | new |
| `--color-action` | `#0B6B60` | `#5BE39A` | links, primary fill, hatched series, success text | changed (dark) |
| `--color-action-hover` | `#08564D` | `#7DEAB0` | primary hover | new |
| `--color-on-action` | `#FFFFFF` | `#04140C` | text on primary | changed (dark) |
| `--color-success-surface` | `#DDF7E7` | `#0F2A21` | success notice, active badge | new |
| `--color-info-surface` | `#E8F3EF` | `#0F2A21` | info notice, row hover | changed |
| `--color-danger` | `#A32D2D` | `#FF9C9C` | | unchanged |
| `--color-on-danger` | `#FFFFFF` | `#0D1B17` | text on the danger button (today `--color-surface`) | new |
| `--color-danger-surface` | `#FDECEC` | `#3A1E1E` | | unchanged |
| `--color-warning` | `#7A4E00` | `#F2C46D` | warning text, threshold line | unchanged |
| `--color-warning-surface` | `#FFF4D6` | `#3A2E12` | | unchanged |
| `--color-focus` | `#1A56DB` | `#8AB4FF` | 3 px focus outline | unchanged |

### 4.2 Contrast, proven

WCAG 2.x relative luminance, computed per channel; AA needs 4.5:1 for text, 3:1 for large text and non-text.

| Pair | Light | Dark |
|---|---|---|
| text on page / surface / sunken / raised | 15.99 / 17.08 / 15.21 / 17.08 | 16.54 / 15.37 / 16.04 / 13.72 |
| text on success-surface / info-surface | 15.07 / 15.04 | 13.28 / 13.28 |
| muted on page / surface / sunken | 6.47 / 6.91 / 6.16 | 8.51 / 7.91 / 8.25 |
| action on page / surface / sunken | 5.98 / 6.39 / 5.69 | 11.70 / 10.87 / n/a |
| action on success-surface (active badge, success label) | 5.64 | 9.39 |
| on-action on action / on action-hover | 6.39 / 8.58 | 11.62 / 12.85 |
| danger on surface / on danger-surface | 7.07 / 6.19 | 8.84 / 7.58 |
| on-danger on danger | 7.07 | 8.84 |
| warning on surface / on warning-surface | 7.20 / 6.57 | 10.87 / 8.16 |
| non-text: border-control on surface / page | 3.55 / 3.32 | 3.80 / 4.09 |
| non-text: brand on surface / page / sunken (bars, mark) | 4.14 / 3.87 / 3.68 | 8.93 / 9.60 / 9.31 |
| non-text: focus on surface / page | 6.18 / 5.79 | 8.47 / 9.12 |
| signal on surface (decorative only) | 1.98, never the only signal | 8.93 |

The header is translucent: its text sits on `--color-header` at 88% over whatever scrolls under it. The floor is the pair above with 12% of the darkest content mixed in; the tester measures the header text with a dark table row under it (test plan), and the opacity is the token to raise if a pair drops under 4.5.

## 5. Typography

System stacks only; no font file, no CSP change.

| Token | Value | Use |
|---|---|---|
| `--font-sans` | `system-ui, -apple-system, "Segoe UI Variable Text", "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif` | everything by default (changed: adds Segoe UI Variable) |
| `--font-display` | `ui-rounded, "SF Pro Rounded", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif` | `h1`, brand, figure values, error code (new) |
| `--font-mono` | unchanged | identifiers, codes, axis labels |
| `--text-eyebrow` | `0.75rem`, weight 600, uppercase, `--tracking-eyebrow` | table headers, figure labels, eyebrows (new) |
| `--text-small` / `--text-body` / `--text-heading-3` / `--text-heading-2` | unchanged | |
| `--text-heading-1` | `clamp(1.75rem, 1.4rem + 1.4vw, 2.5rem)`, weight 700, line 1.1 | changed: 28 px at 375, 40 px at 1280 |
| `--text-figure` | `clamp(2rem, 1.6rem + 1.6vw, 2.75rem)`, weight 700, tabular | changed |
| `--text-display` | `clamp(4rem, 3rem + 4vw, 6rem)`, weight 800 | error code (new) |
| `--tracking-tight` | `-0.025em` | `h1`, brand, figures (new) |
| `--tracking-eyebrow` | `0.08em` | eyebrows (new) |

Every size stays in `rem`; `clamp` mixes `rem` and `vw`, so text zoom still scales it.

## 6. Space, radius, elevation

- **Space.** `--space-1` to `--space-8` unchanged. Vertical rhythm: `main > * + * { margin-top: var(--space-5) }` replaces `main > .card, main > .figure-grid`, so any two blocks in `main` are separated.
- **Radius.** `--radius-control` `0.625rem` (was `0.375rem`); `--radius-card` `1.25rem` (was `0.625rem`); new `--radius-tail` `0.375rem`; new `--radius-pill` `999px`. A bubble is `border-radius: var(--radius-tail) var(--radius-card) var(--radius-card) var(--radius-card)`.
- **Measure.** New `--measure-code` `11rem` (six mono digits at `0.35em` tracking plus padding).
- **Elevation** (all new; rgb values live inside the `:root` blocks):

| Token | Light | Dark |
|---|---|---|
| `--shadow-card` | `0 1px 2px rgb(14 31 26 / 0.05), 0 8px 24px -12px rgb(14 31 26 / 0.12)` | `0 0 0 1px rgb(232 241 237 / 0.02), 0 12px 32px -16px rgb(0 0 0 / 0.7)` |
| `--shadow-raised` | `0 2px 4px rgb(14 31 26 / 0.06), 0 32px 64px -24px rgb(14 31 26 / 0.28)` | `0 0 0 1px rgb(232 241 237 / 0.04), 0 40px 80px -24px rgb(0 0 0 / 0.8)` |
| `--shadow-highlight` | `inset 0 1px 0 rgb(255 255 255 / 0.16)` | `inset 0 1px 0 rgb(255 255 255 / 0.22)` |
| `--glow-signal` | `0 0 0 4px rgb(37 211 102 / 0.18)` | same |
| `--glow-signal-faded` | `0 0 0 7px rgb(37 211 102 / 0)` | same |
| `--gradient-page` | `radial-gradient(64rem 28rem at 50% -12rem, rgb(37 211 102 / 0.22), transparent 70%)` | same at `0.28` (the header glow band, §16) |
| `--gradient-hero-border` | `linear-gradient(135deg, var(--color-signal), var(--color-brand))` | same |
| `--elevation-hero` | `0 2px 4px rgb(14 31 26 / 0.06), 0 24px 48px -20px rgb(37 211 102 / 0.38)` | `0 0 0 1px rgb(232 241 237 / 0.04), 0 32px 64px -20px rgb(37 211 102 / 0.32)` |
| `--pattern-dots` | `radial-gradient(rgb(14 31 26 / 0.07) 1px, transparent 1.5px)` at `1.25rem` | `rgb(232 241 237 / 0.06)` |

Four levels: flat (tracks, table header), card (`--shadow-card`: cards, tables, figures, selected pills), raised (`--shadow-raised`: the sign-in panel only), hero (`--elevation-hero`: the one `.hero-card` per page).

**Hero-card border.** One technique, all colours as tokens inside `:root`, so the "no raw colour outside `:root`" scan passes: `.hero-card { border: 1px solid transparent; background: linear-gradient(var(--color-surface), var(--color-surface)) padding-box, var(--gradient-hero-border) border-box; box-shadow: var(--elevation-hero); }`. Under `@media (forced-colors: active)` the gradient is dropped and the system colours take over: `.hero-card { border-color: CanvasText; background: Canvas; box-shadow: none; }` (system-colour keywords are not raw colours). The gradient and glow are decorative; the card reads the same without them.

## 7. Motion

CSS only. Every animation and transition sits outside a guard that turns it off: `@media (prefers-reduced-motion: reduce) { *, *::before, *::after { animation: none !important; transition: none !important; } }`. Nothing moves for more than five seconds, so WCAG 2.2.2 needs no pause control.

| Token | Value |
|---|---|
| `--duration-quick` | `120ms` (hover, press) |
| `--duration-base` | `220ms` (arrow nudge, disclosure chevron) |
| `--duration-arrive` | `420ms` (notice arrival) |
| `--duration-chart` | `640ms` (bars) |
| `--ease-out` | `cubic-bezier(0.2, 0.8, 0.2, 1)` |
| `--ease-spring` | `cubic-bezier(0.34, 1.56, 0.64, 1)` |

| Moment | Motion |
|---|---|
| A notice after a redirect | "arrives like a message": from `opacity 0, translateY(0.5rem), scale(0.98)`, `--duration-arrive`, `--ease-spring`, once |
| Button press | `translateY(1px)` on `:active`; hover changes fill with `--duration-quick` |
| Arrow buttons (`button-arrow`) | the `→` nudges `3px` on hover |
| Chart bars | grow from the baseline (`transform-box: fill-box; transform-origin: bottom; scaleY(0)`), once, on load |
| `.live-dot` (freshness, environment chip on staging and development, each active number) | the glow pulses from `--glow-signal` to `--glow-signal-faded`, 2 s, 2 iterations |
| Empty-state bubble (96 px) | the three dots breathe once (opacity to 0.55 and back), 1.6 s, 1 iteration |
| `<details>` | the `›` chevron rotates 90° when open |

Mockups are captured with reduced motion on, which is the end state of every animation.

## 8. Components

All class names exist today unless marked new. "Hook" means the developer adds a class or wrapper in a view (listed in §15).

| Component | Look |
|---|---|
| Brand | `.brand::before`: a `1.75rem` bubble in `--color-brand`, tail corner bottom-left, three `--color-on-brand` dots from radial gradients, `--glow-signal` ring. Text in `--font-display`, `--tracking-tight`. Copy unchanged. |
| Environment badge | pill, `--color-warning-surface` fill, `--color-warning` text, eyebrow type, a `span.live-dot` before the word. Rendered on staging and development only, so the pulse never shows on production (owner delegated 2026-11-06). |
| Primary navigation | `nav` becomes a `--color-sunken` pill track with `--space-1` padding; links are pills `--size-tap` tall in `--color-text-muted`; `aria-current="page"` gets `--color-raised`, `--shadow-card`, `--color-text`, weight 650. Not colour alone: weight and the raised pill. |
| Locale switch | the same segmented track; the buttons lose their border and fill; `aria-pressed="true"` is the raised pill. |
| Header end (new hook) | `div.header-end` wraps the locale switch and sign-out, `margin-left: auto`. |
| Buttons | pills, `--size-tap` tall, `--space-5` side padding. Primary: `--color-action` fill, `--shadow-highlight` plus a soft action-coloured drop. Secondary: surface, `--color-border-control` border, action text. Danger: `--color-danger` fill, `--color-on-danger` text. `.button-arrow` (new modifier) adds `→` after the label for "go somewhere" links. Full width at 375 inside cards and the page head. |
| Inputs and selects | `--radius-control`; border `--color-border-control`; `[aria-invalid="true"]` border `--color-danger` at 2px. `.code-input`: `max-width: var(--measure-code)`, mono, `1.25rem`, `letter-spacing: 0.35em`. |
| Field | label 600, help `--text-small` muted, `--space-5` between fields. |
| Card | bubble radius, `--space-6` padding (`--space-5` at 375), `--shadow-card`, `--color-border` hairline. |
| Notice | bubble radius, the variant surface, a 1 px border in the variant colour, the label in bold variant colour; success uses `--color-success-surface` with `--color-text` message and `--color-action` label. Arrives with motion. |
| State badge | pill, glyph plus word (unchanged markup): active success-surface/action, pending warning-surface/warning, closed sunken/muted, disabled danger-surface/danger. |
| Tables (1280) | `border-collapse: separate`, bubble radius, `overflow: hidden`, `--shadow-card`; header row `--color-sunken` in eyebrow type; rows `--space-3` by `--space-4`; hover `--color-info-surface`; numeric cells right-aligned, tabular; the label cell link weight 600. |
| Tables (375) | each row a bubble card with `--shadow-card`, `--space-3` apart; `td { min-width: 0; overflow-wrap: anywhere; text-align: right }`; `td::before { flex: none; font-family: var(--font-sans) }` so mono cells keep a sans label. This removes today's 400 px overflow. |
| Key-value list | `dd { overflow-wrap: break-word }` (breaks at spaces, so "2026-11-07 21:41 UTC" stays whole); `dd.mono { overflow-wrap: anywhere }` for long IDs. |
| Breadcrumb (new hook) | `.crumb`: `←` before "Numbers", `--text-small`, 600, no underline until hover. |
| Page head (new hook) | `.page-head`: `h1` and the page's primary action on one line, wrapping; the button goes full width at 375. |
| Figure | bubble; label in eyebrow type; value in `--font-display`, `--text-figure`, `--tracking-tight`, tabular. |
| Freshness (new hooks) | `.freshness-live`: a `span.live-dot` and the word "Live". `.freshness-hourly`: a hollow `--color-text-muted` ring and "Updated hourly". The word is always there. |
| Live dot (new hook) | `.live-dot`: `0.5rem` circle in `--color-signal`, `--glow-signal` ring, `aria-hidden`, the pulse of §7. Always beside a word ("Live", the state badge text, the environment name). |
| Hero card (new hook) | `.hero-card` on the first card of a page: the gradient border and `--elevation-hero` of §6. Home: Numbers; number detail: the summary; metrics: the period summary. The other cards keep `--shadow-card`. |
| Sparkline (new hook) | `svg.sparkline`, 14 points, `viewBox`/`points` by attributes, `--color-brand` stroke 2 (non-text 4.14:1 on surface), area below in `--color-info-surface`, baseline `--color-border-control`, last point a dot. With `.sparkline-summary` beside it in `--text-small` muted: the total and the peak, or the empty sentence. §11 has the copy and the accessible name. |
| Filter form | one pill-shaped bar (bubble at 375) holding label-beside-select pairs and Apply; at 375 labels go above and Apply goes full width. |
| Charts | bars get `rx="2"` (a new `BAR_RADIUS` constant in `bar-chart.tsx`); solid `--color-brand`; hatched pattern stroke `--color-action`; baseline `--color-border-control`; `.chart-reference` (new rule) `--color-warning`, 1.5, dashed `4 4`; the reference label gets the new class `chart-reference-label`: `paint-order: stroke; stroke: var(--color-surface); stroke-width: 4px` so it reads over bars; axis labels mono, muted. Legend items show a swatch (solid, or a 45° hatch from `repeating-linear-gradient`) before the text, which still names the pattern. |
| Show values | `summary` is a sunken pill `--size-tap` tall with a rotating `›`. |
| Empty state (new hook) | `.empty-state` on the empty card: centred, `--space-8` padding, one `6rem` (96 px) brand bubble drawn by `::before` (`--color-brand`, tail corner bottom-left, three `--color-on-brand` dots from radial gradients) whose dots breathe once (§7), then the existing title, sentence and the action as the only primary button. This is the only empty-state bubble: the metrics `.empty-text` uses the same `.empty-state` markup once per section and the inline `1.75rem` variant is dropped. |
| Error page | the `h1` keeps its text "404 Page not found" and splits into `span.error-code` (`--font-display`, `--text-display`, `--color-brand`; 4.14:1 light and 8.93:1 dark, large text) and `span.error-title`, separated by a space so the accessible name is unchanged. |
| Signed-out shell (new hook) | `body.shell-signed-out` (sign-in, error pages): `main` centres a single bubble panel; sign-in sits on `--pattern-dots` with `--shadow-raised`. |
| Page | `body` background is `--gradient-page` over `--color-page`; the header is sticky at ≥ 40rem with `--color-header` and `backdrop-filter: saturate(1.6) blur(14px)`, static below; `html { scroll-padding-top: 6rem }` so a focused field is never under the header. |

## 9. Screens at 1280 and 375

States, copy and focus order per screen are the backoffice design's §4; they do not change. Below: the layout each state takes in this direction. Mockups (static HTML in the owner's tokens, rendered with Playwright, reduced motion on) are in `.pr-media/ui-polish/design/`:

`option-a-sign-in-1280-light.png`, `option-a-sign-in-375-dark.png`, `option-a-home-1280-light.png`, `option-a-numbers-375-light.png`, `option-a-numbers-empty-1280-light.png`, `option-a-number-detail-1280-light.png`, `option-a-metrics-1280-dark.png`, `option-a-audit-375-light.png`, `option-a-error-404-1280-light.png`, `option-a-docs-overview-hero-1280-light.png`, `option-a-docs-overview-hero-375-light.png`, `option-b-home-1280.png`.

### 9.1 Shell

```
1280
+--------------------------------------------------------------------------------------+
| (•••) zapbip backoffice  (• STAGING)  ( Home |[Numbers]| Metrics | Audit )    ( PT |[EN] ) (Sign out) |
+--------------------------------------------------------------------------------------+   sticky, blurred
  main: --measure-page, padding --space-7 / --space-5 / --space-8, blocks --space-5 apart
375
+-----------------------------------+
| (•••) zapbip backoffice (• STAGING)|
| ( Home | Numbers | Metrics |[Audit])|   track spans the width
| ( Português |[English] )  (Sair)   |   header-end spans the width
+-----------------------------------+   static, not sticky
```

### 9.2 Sign-in

```
1280: dotted field, centred bubble panel 32rem, raised     375: panel full width, --space-5 padding
   OPERATOR ACCESS                                          same order, Sign in full width
   Sign in                    (h1, display)
   Your backoffice key and a fresh code.
   [x Error  Sign-in failed.]   (arrives)
   Backoffice key / help / [··························]
   Authenticator code / help / [ · · · · · · ]  (11rem)
   [            Sign in            ]  pill, full width
```

Failure, session-ended and locked states keep their notices in the same slot.

### 9.3 Home

1280: `h1` Overview; the `notice=` notice; three bubble cards in `card-grid`. Numbers card: the total in `--text-figure` (the sum of the state counts it already renders), the state badges with counts, "Manage numbers →". Metrics and Audit cards: one muted line (`HomeMetricsBody`, `HomeAuditBody`) and their "Open … →" secondary buttons. Each of the three cards ends with its sparkline and `.sparkline-summary` (§8, §11). No-number state: the warning notice and "Register a number" primary replace the figure. 375: one card per row, buttons full width.

### 9.4 Numbers list

1280: `.page-head` (Numbers, "Register a number" primary on the right); the bubble table. Empty: one `.empty-state` card. Pending: the warning notice under the table. 375: page head stacks, rows are bubble cards (`option-a-numbers-375-light.png`).

### 9.5 Register a number

1280: the form card at `--measure-form`, fieldsets as sections with `h2`-sized legends and a `--color-border` rule between them; the code field at `--measure-code`; "Register number" primary and "Cancel" as a text link beside it. Invalid: the error summary notice first. 375: one column, button full width, Cancel under it.

### 9.6 Number detail

```
1280
< Numbers
Brazil  (○ Pending)                                  h1 display + badge
[! Warning  This number is not verified yet ...]
+------------------------+  +----------------------------------+
| Summary (sticky, top   |  | Verify with Meta  [code] [Verify]|
| 6rem) dl, 5fr          |  +----------------------------------+
|                        |  | State (radios or reason)         |
|                        |  +----------------------------------+
|                        |  | Replace access token             |
+------------------------+  | Replace app secret               |
                            +----------------------------------+  7fr
375: one column, summary first, dl stacked, forms after, every button full width
```

DOM order is summary then forms, the same as the visual order in both layouts. `disabled` state: the danger notice stays above the grid.

### 9.7 Verification result

One column at `--measure-form`: the result notice, "Meta reports" key-value card, the template table (bubble, stacked at 375), the warning notice when a template is not approved, "Back to Brazil" as a secondary `button-arrow`.

### 9.8 Metrics

1280 (`option-a-metrics-1280-dark.png`): `h1`; the filter bar; four figure bubbles in one row with live dots; then one card per section, each with its freshness line, inner figure pairs, the chart, the legend and the "Show values" pill. 375: filter stacks, figures two per row, charts full width (SVG scales), no horizontal scroll. Empty: every chart is replaced by the `.empty-state` 96 px bubble and "No data yet"; figures read 0. Budget at or above 80%: the warning status in bold `--color-warning` and the dashed threshold line labelled over a surface halo.

### 9.9 Audit

1280: the intro line under `h1` in muted; the bubble table with When and Target in mono, Outcome as glyph plus word (`✓ OK`, `✕ Failed`, `✕ Locked` in danger 600). 375: bubble cards (`option-a-audit-375-light.png`), no overflow.

### 9.10 Error pages (401, 403, 404, 429, 500, 503)

Signed-out shell, one centred bubble panel at `--measure-form`: the big code, the title, the sentence, the single action as a primary `button-arrow` (none for 503). 375: same, code at `4rem`.

## 10. Docs

### 10.1 `docs.json`

| Key | Today | Proposed | Why |
|---|---|---|---|
| `theme` | `mint` | `mint` | keeps the sidebar DOM the docs walk relies on (option 2) |
| `colors.primary` | `#128C7E` | `#0B6B60` | links and active nav: 6.39:1 on white, 5.98:1 on the page (today 4.14:1) |
| `colors.light` | absent | `#25D366` | the accent in dark mode: 9.60:1 on the dark page |
| `colors.dark` | absent | `#08564D` | button hover in light mode: white on it 8.58:1 |
| `background.color` | absent | `{ "light": "#F6F8F5", "dark": "#07120F" }` | the backoffice page colours |
| `background.decoration` | absent | `gradient` | Mintlify's top radial glow in the primary colour at 10% |
| `appearance.default` | absent | `system` | stated, not implied |
| `logo` | absent (the name renders as text) | `{ "light": "/logo/light.svg", "dark": "/logo/dark.svg", "href": "/" }` | the shared lockup |
| `fonts` | absent | absent | Mintlify's bundled face stays; it is close to the system stacks and adds no third-party request (option 3) |
| `favicon` | `/favicon.svg` | unchanged | already the bubble mark |

### 10.2 Logo

`apps/docs/logo/light.svg` and `dark.svg`, `viewBox="0 0 120 32"`: the favicon's bubble path scaled to 28 px (fill `#128C7E` light, `#25D366` dark; dots `#FFFFFF` light, `#04140C` dark), then `zapbip` as SVG `<text>` at x 36, `font-family` the `--font-display` stack, weight 700, letter-spacing −0.6, fill `#0E1F1A` light, `#E8F1ED` dark; `role="img"` with `<title>zapbip</title>`.

### 10.3 Overview hero

A new snippet `apps/docs/snippets/hero.jsx` exporting `Hero({ eyebrow, statement, accent, lead, primary, secondary, children })`, placed at the top of `index.mdx` and `pt-br/index.mdx` right after the imports, above "Why zapbip exists". It renders no heading: the page `h1` stays the frontmatter title, and the statement is a `p`. `children` is a `<Chat frame="phone" … />`.

Classes are styled in a new `apps/docs/zapbip.css` (Mintlify injects every `.css` file):

| Class | Light | Dark (`.dark` ancestor) |
|---|---|---|
| `.zapbip-hero` | flex, `flex-wrap: wrap`, gap 2.5rem, padding 2.5rem 2rem (1.25rem at < 40rem), bubble radius `0.375rem 1.75rem 1.75rem 1.75rem`, border `#DCE5E0`, background `radial-gradient(40rem 20rem at 85% 0%, rgb(37 211 102 / 0.22), transparent 70%)` over `linear-gradient(#FFFFFF, #F1F7F3)` | border `#1F332D`, the same glow at 0.14 over `#0D1B17` |
| `.zapbip-hero-copy`, `.zapbip-hero-visual` | `flex: 1 1 18rem` and `1 1 16rem`, `min-width: 0` | |
| `.zapbip-hero-eyebrow` | pill, `#DDF7E7` fill, `#0B6B60` text (5.64:1), 0.75rem 700 uppercase, a `#25D366` dot with glow | `#0F2A21` fill, `#5BE39A` text (9.39:1) |
| `.zapbip-hero-statement` | `clamp(2rem, 1.4rem + 2vw, 2.75rem)`, weight 750, line 1.05, tracking −0.035em, `#0E1F1A`; the accent line `#0B6B60` (5.88:1 on the lightest point) | `#E8F1ED`; accent `#5BE39A` |
| `.zapbip-hero-lead` | 1.0625rem, `#4B5E57` (6.37:1) | `#9DB2AA` |
| `.zapbip-button-primary` | pill, 2.75rem tall, `#0B6B60` fill, white text (6.39:1), `→` after | `#5BE39A` fill, `#04140C` text (11.62:1) |
| `.zapbip-button-secondary` | pill, `#7A8C85` border, `#0B6B60` text, white fill | `#5F7A71` border, `#5BE39A` text on `#0D1B17` (10.87:1) |

Layout comes from `flex-wrap`: side by side at 1280, stacked at 375 (copy first, phone second). Without the stylesheet the hero degrades to readable stacked text and links.

### 10.4 Chat mockup (`snippets/chat.jsx`)

The inline-style pattern stays; colours change for AA; two additions.

| Constant | Today | Proposed | Contrast |
|---|---|---|---|
| header background (new `header`) | `teal` `#128C7E` | `#075E54` | white 15 px on it 7.67:1 (today 4.14:1) |
| sender names, quote names, button and contact-action text, notice label | `teal` | `#0B6B60` | 6.39:1 on white, 5.76:1 on `#D9FDD3`, 5.59:1 on `#FFEECD` |
| `mutedInk` (time, captions) | `#667781` | `#54656F` | 6.06:1 on white, 5.46:1 on `#D9FDD3` (today 4.19:1) |
| `teal` | kept | `#128C7E` | only the document icon, the audio disc and the quote bar (non-text, 4.14:1) |
| ink on wallpaper | | unchanged | 13.99:1 |

Additions: `frame="phone"` wraps the chat in a 10 px `#0E1F1A` bezel with a 44 px outer radius, a status row ("9:41"), and the bubble avatar with three dots in `#25D366` on the header; `{ typing: true }` renders an incoming bubble with three dots (`aria-hidden`, class `zapbip-typing`, animated by `zapbip.css` for 4 iterations of 1.2 s, static under reduced motion). The four "What it looks like" cards keep the default frame.

### 10.4a Wide Overview

Both Overview pages carry frontmatter `mode: "wide"`, which the pinned client 0.0.4077 honours, so the hero sits side by side at 1280. The cost is accepted (owner delegated 2026-11-06): wide mode hides "On this page" on the Overview only. The Overview is a landing page; every other page keeps its table of contents (a walk assertion covers How to start). `zapbip.css` caps paragraphs, which the client renders as `span[data-as="p"]`, and lists at 44rem below the hero.

### 10.5 Docs motion

Only the typing dots (above) and Mintlify's own transitions. `zapbip.css` wraps the keyframes in `@media (prefers-reduced-motion: no-preference)`.

## 11. Copy

Backoffice: no existing key changes. New keys in `apps/api/src/backoffice/backoffice-copy.ts`:

| Key | pt_BR | en_US |
|---|---|---|
| `SignInEyebrow` | Acesso do operador | Operator access |
| `SignInLead` | Sua chave do backoffice e um código novo. | Your backoffice key and a fresh code. |
| `HomeMetricsBody` | Contas, mensagens, despertares e orçamento. | Accounts, messages, wakes and budget. |
| `HomeAuditBody` | Cada entrada, mudança e troca de segredo, por 365 dias. | Every sign-in, change and rotation, kept 365 days. |
| `HomeNumbersUnit` | números | numbers |
| `SparklineNumbersMetric` | Números registrados | Numbers registered |
| `SparklineMessagesMetric` | Mensagens | Messages |
| `SparklineAuditMetric` | Entradas de auditoria | Audit entries |
| `SparklineSummary` | {total} no total, pico de {peak} em um dia | {total} in total, peak of {peak} in one day |
| `SparklineEmpty` | Nenhuma atividade nos últimos {days} dias | No activity in the last {days} days |

Sparkline accessibility: the `svg` is `role="img"` and its first child is `<title>`, whose text is the existing `ChartTitle` (`{metric}, last {days} days`) followed by the summary or the empty sentence, so the accessible name carries the numbers. The same summary or empty sentence is visible in `.sparkline-summary` (the `svg` is not the only carrier). An all-zero series draws only the baseline and shows `SparklineEmpty`; it never draws a flat line as the signal. `{days}` is the `SPARKLINE_DAYS` constant (14).

Docs hero, as props in the two MDX files (the docs keep copy in MDX):

| Prop | en (`index.mdx`) | pt-BR (`pt-br/index.mdx`) |
|---|---|---|
| `eyebrow` | Official WhatsApp Cloud API | API oficial do WhatsApp Cloud |
| `statement` | Your AI messages you. | Sua IA manda mensagem. |
| `accent` | You answer on WhatsApp. | Você responde no WhatsApp. |
| `lead` | Decisions, finished work and questions with buttons, on the phone you already carry. One line to set up. | Decisões, trabalhos prontos e perguntas com botões, no celular que já está com você. Uma linha para configurar. |
| `primary` | How to start → `/get-started/how-to-start` | Como começar → `/pt-br/get-started/how-to-start` |
| `secondary` | Supported agents → `/agents/supported-agents` | IAs compatíveis → `/pt-br/agents/supported-agents` |
| chat, Claude | Your flight to Lisbon dropped to $410. Book it? | Seu voo para Lisboa caiu para R$ 2.100. Reservo? |
| chat options | Book it · Keep watching | Reservar · Continuar olhando |
| chat, you | Book it | Reservar |
| chat, Claude | Booked. I will send the boarding pass here. | Reservado. Mando o cartão de embarque aqui. |

Tone:

- **Backoffice, the operator's console.** Calm and exact. Second person, an action verb on every button, the effect named on dangerous ones, numerals for numbers, UTC dates, no exclamation marks, no emoji, no marketing. An eyebrow is two or three words.
- **Docs, a friend who set it up.** Warm and concrete: the reader's life (trips, research, a passport), not the architecture. "Your AI", never "bot". Hero lines stay under eight words. pt-BR uses "você" and everyday words ("celular", "manda mensagem"), never a literal translation of the English rhythm. Emoji only inside a simulated chat, where a real person would use one.

## 12. Interaction and accessibility

Everything in the backoffice design §6 holds. Additions and checks for this look:

- **Focus.** The 3 px `--color-focus` outline with 2 px offset stays on every focusable element; pills keep it because `outline` follows `border-radius` in current engines. `scroll-padding-top: 6rem` keeps a focused field clear of the sticky header (WCAG 2.4.11).
- **Not colour alone.** Current nav and pressed locale: weight plus the raised pill. Freshness: the word plus a filled or hollow dot. Badges and outcomes: glyph plus word. Chart series: pattern plus legend text plus swatch. Threshold: dashed line plus label.
- **Targets.** Nav links, locale buttons, summary pills and every button stay `--size-tap` tall.
- **Reflow.** At 375 and at 320 px with 400% zoom there is no horizontal scroll (the table fix in §8).
- **Motion.** §7; all off under reduced motion; nothing moves past five seconds.
- **Translucent header.** Measured per §4.2.
- **Docs hero.** No extra heading; links are real `a` elements with their own text; the phone is `role="group"` with `aria-label="WhatsApp: zapbip"` like today's mockup; the typing bubble and decorative dots are `aria-hidden`.

## 13. Further options

| # | Choice | A | B | Recommendation |
|---|---|---|---|---|
| 1 | Direction | Signal (§3) | Console (§3) | **A** |
| 2 | Docs theme | keep `mint`, retune colours, background, logo, hero | switch to `maple` or `almond` | **A**: B changes the sidebar and language-switch DOM the docs walk drives, for a look we can reach with tokens |
| 3 | Display type | system stacks with `ui-rounded` for display (0 bytes, CSP unchanged) | a self-hosted variable font (~50 KB woff2) served by the Worker, CSP gains `font-src 'self'`, docs load it through `fonts` | **A**: the identity comes from shape and colour; B adds a CSP change, a licence and a download to a console used by one operator |
| 4 | Header | sticky and translucent at ≥ 40rem, static below | static everywhere | **A**: the nav stays reachable on the long metrics and detail pages; on a phone the three-row header would eat the screen, so it scrolls away |
| 5 | Motion | the set in §7 (arrival, press, bars, live pulse, typing) | none, as today | **A**: each motion carries meaning (a message arrived, data is live), all are short and switch off under reduced motion |
| 6 | Number detail at 1280 | summary sticky on the left, actions on the right | one column, as today | **A**: the operator reads the summary while filling a form; same DOM order |
| 7 | Docs hero | a `Hero` snippet above the Overview content, sidebar kept | `mode: "custom"` landing page without the sidebar | **A**: the Overview stays a docs page in the navigation and the language switch keeps working |
| 8 | Docs styling vehicle | `zapbip.css` for the hero, its dark mode and the typing keyframes; the chat keeps inline styles | inline styles only | **A**: inline styles cannot follow Mintlify's dark mode or reduced motion; the hero still reads without the file |

## 14. Owner decisions

All answers are the recommended option, chosen under the owner's delegation. Nothing is pending.

| Decision | Choice | Answer |
|---|---|---|
| Option 1, direction | A: Signal | recommended: A (owner delegated 2026-11-06), 2026-11-08 |
| Option 2, docs theme | A: keep `mint`, retune | recommended: A (owner delegated 2026-11-06), 2026-11-08 |
| Option 3, display type | A: system stacks with `ui-rounded` | recommended: A (owner delegated 2026-11-06), 2026-11-08 |
| Option 4, header | A: sticky translucent at ≥ 40rem, static below | recommended: A (owner delegated 2026-11-06), 2026-11-08 |
| Option 5, motion | A: the §7 set, reduced-motion guarded | recommended: A (owner delegated 2026-11-06), 2026-11-08 |
| Option 6, number detail at 1280 | A: two columns, sticky summary | recommended: A (owner delegated 2026-11-06), 2026-11-08 |
| Option 7, docs hero | A: `Hero` snippet, sidebar kept | recommended: A (owner delegated 2026-11-06), 2026-11-08 |
| Option 8, docs styling vehicle | A: `zapbip.css` plus inline chat | recommended: A (owner delegated 2026-11-06), 2026-11-08 |
| Token set, §4 to §7 (new and changed colours, type, radius, measure, elevation, motion) | adopted as written | recommended (owner delegated 2026-11-06), 2026-11-08 |
| New copy, §11 | adopted as written | recommended (owner delegated 2026-11-06), 2026-11-08 |
| §16 amendment (header glow, hero card, sparklines, live state, numbers as type, empty state) | adopted, with the reconciliations of §6, §8 and §11 | recommended (owner delegated 2026-11-06), 2026-11-08 |
| Sparkline queries | three read-only `SELECT`s in the home `database.batch` | recommended (owner delegated 2026-11-06), 2026-11-08 |
| Environment-chip live dot | staging and development only, never production | recommended (owner delegated 2026-11-06), 2026-11-08 |
| Empty state | one 96 px bubble, dots animate once | recommended (owner delegated 2026-11-06), 2026-11-08 |
| Hero-card border | double background (`padding-box`/`border-box`) with a `CanvasText` fallback under `forced-colors` | recommended (owner delegated 2026-11-06), 2026-11-08 |

## 15. Hand-off to the plan

Markup hooks, each a class or wrapper with no new copy except §11:

- `layout.tsx`: `body` gets `class="shell-signed-out"` when not signed in; `div.header-end` wraps `LocaleSwitch` and `SignOutButton`.
- `views/sign-in.tsx`: the eyebrow and lead (`SignInEyebrow`, `SignInLead`) above and below the `h1`.
- `views/home.tsx`: the Numbers total as `p.tile-figure` with `span.tile-unit` (`HomeNumbersUnit`); `HomeMetricsBody`, `HomeAuditBody`; `button-arrow` on the three links; `hero-card` on the Numbers card; a `Sparkline` and `.sparkline-summary` on each card.
- `views/sparkline.tsx` (new): the `Sparkline` component (`svg.sparkline`, `role="img"`, `<title>`, no `style=`).
- `home-sparklines.ts` (new) and `routes/session-routes.tsx`: the three read-only `SELECT`s joined to the state counts in one `database.batch`; `SPARKLINE_DAYS` in `backoffice-constants.ts`.
- `.live-dot` (`span`, `aria-hidden`): in `layout.tsx` inside the environment badge (staging and development only), in `metrics/` freshness lines, and before the word of each active-state badge (`numbers/components/state-badge.tsx`).
- `.hero-card`: home Numbers card, `numbers/views/number-detail.tsx` summary card, the metrics period-summary card.
- `numbers/views/numbers-list.tsx`, `views/audit.tsx`, `metrics/metrics-page.tsx`: `div.page-head` around the `h1` and the page's primary action; `.empty-state` on the empty card.
- `numbers/views/number-detail.tsx`: `a.crumb`; `div.title-row` for `h1` and badge; `div.detail-grid` holding the summary card and `div.detail-actions`.
- `views/error-page.tsx`: `span.error-code` and `span.error-title` inside the `h1`, joined by a space.
- `metrics/metrics-page.tsx`, `metrics/figure-number.tsx`: `freshness freshness-live` or `freshness freshness-hourly` on every freshness line.
- `metrics/bar-chart.tsx`: `rx={BAR_RADIUS}` on bars; `chart-reference-label` on the reference text; a swatch `span` in each legend item.
- `assets/backoffice.css`: §4 to §8.
- Docs: `docs.json` per §10.1; `logo/light.svg`, `logo/dark.svg`; `snippets/hero.jsx`; `snippets/chat.jsx` per §10.4; `zapbip.css`; the `Hero` in `index.mdx` and `pt-br/index.mdx`.

Tests the plan adds or updates ([test-plan.md](test-plan.md) has the rows): the contrast unit test gains every pair in §4.2 for both themes, computed from the parsed CSS, plus the hero, eyebrow, chat and header-over-dark pairs; the stylesheet scan also asserts that every `animation` and `transition` declaration is covered by the reduced-motion guard and that no raw colour sits outside `:root`; a view test per hook above; a docs test that `colors.primary` passes 4.5:1 on white and that `chat.jsx` has no `#128C7E` on text; the Playwright MCP walk at 1280 and 375, light and dark, reduced motion on and off, with `before-*.png` and `after-*.png` in `.pr-media/ui-polish/`, plus `document.documentElement.scrollWidth === 375` on every page at 375 and `style[data-custom-css-path]` present on the docs under `--client-version 0.0.4077`.

## 16. Amendment: more presence in the backoffice (coordinator, 2026-11-08)

The owner asked for a "hyper sexy" UI. The docs hero meets that bar; the backoffice home mockup is clean but plain. Raise it, within the same constraints (no script, strict CSP, one stylesheet, system fonts, AA in both themes, reduced motion respected):

- **Header glow band.** A soft radial `--color-signal` glow behind the header and the page title (`--gradient-page`, §6), stronger in dark mode, the same light the docs hero uses.
- **Hero card.** The first card of each page (Numbers on home, the number summary on the detail page, the period summary on metrics) gets a 1 px gradient border (`--gradient-hero-border`, from `--color-signal` to `--color-brand`) and `--elevation-hero`, with the technique and the forced-colors fallback of §6; the other cards stay flat. Hook: `.hero-card`.
- **Sparklines.** Every home card shows an inline SVG sparkline of its last 14 days (numbers registered, messages, audit entries), drawn server-side by attributes like the metrics charts. Hook: `.sparkline`; queries, copy and the accessible name in the spec and §11.
- **Live state.** The environment chip and each active number carry the pulsing `.live-dot` (CSS only, off under reduced motion). On the environment chip it appears on staging and development only, never on production (decided, owner delegated 2026-11-06).
- **Numbers as type.** Big figures use tabular numerals with the display stack and a thin unit label, as in the docs hero.
- **Empty states.** An illustration-free empty state: the single 96 px brand bubble of §8, its three dots animating once, the action as the only primary button. It replaces the §9.8 small typing bubble.

Decided with the recommended option, owner delegated 2026-11-06. The plan and the test plan carry these as rows.

Token names used throughout: `--color-signal`, `--gradient-hero-border`, `--elevation-hero`.
