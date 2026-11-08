# Test plan: UI polish

Every checkbox states the input and the exact expected outcome. A ticked box carries evidence after ` — evidence: ` (commit hash, log path, counts, screenshot path). Paths: `API` is `apps/api`, `SHAPE` is `tools/repository-shape/src`, `.pr-media` is `/Users/dhyegocalota/Projects/zapbip/zapbip/.pr-media/ui-polish`. Every decision behind a row is "owner delegated 2026-11-06" ([design.md §14](design.md#14-owner-decisions)).

## The failing test first

- [ ] `API/test/unit/backoffice-contrast.test.ts::ratio of black on white` — input: `contrastOf('#000000', '#FFFFFF')`; expected: `21`. Red commit: `<hash>`; failure text recorded from the red run: `<contrast is not implemented>`
- [ ] `API/test/unit/backoffice-design-rules.test.ts::meets the contrast of the design in light` — input: the stylesheet before step 3; expected: red naming `--color-sunken` as undefined
- [ ] `API/test/integration/backoffice-home-sparklines.test.ts::runs one batch of four selects` — input: `GET /` before step 8; expected: red, the spy sees one statement, not four
- [ ] `SHAPE/docs-visual.test.ts::docs.json carries the logo` — input: `docs.json` before step 16; expected: red naming `logo`
- [ ] Each red run was confirmed to fail for the feature's absence, not a broken test: `<the failure messages, pasted by the tester from git log checkouts>`
- [ ] Step 13 (CSP, scripts, `style=` pin) is committed as a pin: its commit message says `pin` and it is green on landing — evidence: `<hash>`

## Unit: backoffice (`API/test/unit`)

Contrast is computed from the stylesheet text by `support/contrast.ts` (the parsed `:root` blocks; dark = light overridden by the second block), never from numbers typed into the test.

- [ ] `backoffice-design-rules.test.ts::meets the contrast of the design in {light,dark}` — input: every pair of design §4.2, both themes: text, muted, action, on-action (on action and action-hover), danger and on-danger, warning, text on success-surface and info-surface, with the 4.5 minimum for text and 3 for non-text (border-control, brand, focus); expected: empty list of shortfalls in each theme
- [ ] `::the hero, eyebrow, chat and header pairs` — input: `--color-text` and `--color-text-muted` on `--color-header` composited over `#000000` and over the darkest table row (the 12% floor of design §4.2); `--color-text-muted` and `--color-action` on `--color-page` composited with `--color-signal` at the `--gradient-page` alpha (0.22 light, 0.28 dark); the error-code `--color-brand` on the page at 3 (large text); expected: every ratio at or above its minimum, none computed from a hard-coded number
- [ ] `::every light token has a dark counterpart` — input: the colour and elevation tokens of the first `:root` block; expected: each name is redefined in the second block, except the named fixed ones (`--color-signal`, `--gradient-hero-border`, `--glow-signal`, `--glow-signal-faded`, `--color-danger`, `--color-danger-surface`, `--color-warning`, `--color-warning-surface`, `--color-focus`, the `--space-*`, `--radius-*`, `--duration-*`, `--ease-*`), which the test lists by name
- [ ] `::holds no raw colour outside the token blocks` — input: the stylesheet with both `:root` blocks removed; expected: no `#hex`, `rgb(`, `rgba(` or `hsl(`; this covers the `.hero-card` gradient border, which reads `--gradient-hero-border`
- [ ] `::defines a token block for light and a second one for dark` — input: the stylesheet; expected: exactly two `:root` blocks
- [ ] `::every animation and transition is inside the reduced-motion guard` — input: every `animation`, `animation-name`, `transition` and `@keyframes` use; expected: the stylesheet has one `@media (prefers-reduced-motion: reduce)` block that sets `animation: none !important; transition: none !important` on `*, *::before, *::after`; no `animation-iteration-count: infinite`; no `scroll-behavior: smooth` outside a `no-preference` block
- [ ] `::the forced-colors block` — input: the stylesheet; expected: a `@media (forced-colors: active)` block exists; `.hero-card` there sets `border-color: CanvasText` and `background: Canvas`; `.live-dot` and `.sparkline` use `currentColor` or a system keyword; no `forced-color-adjust: none` anywhere
- [ ] `::the CSP is unchanged` (pin) — input: `CONTENT_SECURITY_POLICY`; expected: byte-equal to `default-src 'none'; style-src 'self'; img-src 'self'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'`
- [ ] `::has no style attribute, style element or script element in any view` — input: every `.tsx` under `apps/api/src/backoffice` (the existing test, new files included); expected: no match
- [ ] `::renders {sign-in, home, home-empty, numbers, register, detail, verification, metrics, metrics-empty, audit, 404} with no script and no style attribute` — input: the rendered HTML of each page in both locales; expected: no `<script`, no ` style=`
- [ ] `::every class a view emits has a rule` — input: the class tokens of every rendered page against the stylesheet selectors; expected: empty list (hooks `.hero-card`, `.sparkline`, `.sparkline-summary`, `.live-dot`, `.empty-state`, `.page-head`, `.crumb`, `.detail-grid`, `.header-end`, `.shell-signed-out`, `.tile-figure`, `.tile-unit`, `.button-arrow`, `.freshness-live`, `.freshness-hourly`, `.chart-reference-label`, `.error-code` all included)
- [ ] `backoffice-layout.test.ts::the live dot is on staging and development only` — input: the header for `DeployEnvironment.Staging`, `Development` and `Production`; expected: exactly one `.live-dot` inside `.environment-badge` for the first two, none in the header for production
- [ ] `backoffice-hooks.test.ts::page head, crumb, title row, detail grid, empty state` — input: numbers list (empty and one), audit (empty and one), number detail (pending, active, disabled), metrics; expected: each hook of design §15 present once; detail DOM order is summary then `.detail-actions`
- [ ] `::the error page keeps its accessible name` — input: the 404 page; expected: the `h1` text content with tags removed equals `404 Page not found` (and the pt_BR twin equals its existing text)
- [ ] `::the hero card` — input: home, number detail, metrics; expected: exactly one `.hero-card` per page and it is the first card
- [ ] `backoffice-copy.test.ts::every key has both locales` — input: the new keys of design §11; expected: pt_BR and en_US values exist, differ, and carry the same `{placeholders}`
- [ ] Edge: the new copy has no `??` default and no acronym in a key — input: `backoffice-copy.ts`; expected: grep for `??` finds none

## Unit: sparklines (`API/test/unit/backoffice-sparkline.test.ts`)

- [ ] 14-point series — input: `[0,1,2,3,4,5,6,7,8,9,10,11,12,13]`; expected: `svg.sparkline` has a `polyline` with 14 points, the largest on the top margin, the smallest on the baseline
- [ ] All-zero series — input: 14 zeros; expected: no `polyline`, the baseline only, `.sparkline-summary` and the `<title>` read the `SparklineEmpty` sentence in the page locale ("No activity in the last 14 days"), never the total
- [ ] One non-zero day among zeros — input: `[0,…,0,3,0]`; expected: a drawn line and the last point dot; summary "3 in total, peak of 3 in one day"
- [ ] Accessible name — input: any series, both locales; expected: `role="img"`, `<title>` is the first child, its text is `ChartTitle` followed by the summary or the empty sentence
- [ ] No `style=` and no `<script` in the markup; the numbers are attributes
- [ ] A negative or non-finite value throws, naming it (no silent clamp)

## Integration: sparkline queries (`API/test/integration/backoffice-home-sparklines.test.ts`)

- [ ] Read-only and one round trip — input: `GET /` with a spy on `database.batch` and `database.prepare`; expected: `batch` called once with exactly 4 statements (the state counts plus three sparkline `SELECT`s), no other `prepare` or `exec` call, every statement text starts with `SELECT` and contains none of `INSERT`, `UPDATE`, `DELETE`, `DROP`, `REPLACE`
- [ ] No N+1 — input: 1 number, then 50 numbers, 1 day then 14 days of data; expected: the statement count stays 4 and the `batch` count stays 1
- [ ] All-zero series — input: empty `whatsapp_numbers`, `activity_daily`, `backoffice_audit`; expected: three series of 14 zeros, the page 200, the home empty notice shown, the three summaries read the empty sentence
- [ ] 14-point series — input: a number registered on each of the last 14 UTC days, messages in and out on day 3, audit entries on day 1; expected: the numbers series is 14 ones, the messages series is the in plus out on day 3 and 0 elsewhere, the audit series counts the entries on day 1; each has 14 entries, oldest first
- [ ] Bound — input: rows 14 and 15 days old; expected: the 15-day row is excluded (`at >= ?`, `created_at >= ?`, `day >= ?`); a row at the first millisecond of the oldest day is included
- [ ] Day edges — input: a row at `23:59:59.999` UTC and one at `00:00:00.000` the next day; expected: they land on two different days, via `utcDay`
- [ ] Messages sum — input: `MessagesIn` 2 and `MessagesOut` 3 on one day for two numbers, plus `SendsFailed` 9; expected: the day reads 5 (the other metric is not counted)
- [ ] Reuse — input: a grep of `home-sparklines.ts`; expected: it imports `dailySeries` and `utcDay` and defines neither
- [ ] Failure — input: the batch rejects; expected: the home page is the existing 500 page, not a half-rendered page

## Unit: docs (`SHAPE/docs-visual.test.ts`, `docs-experience.test.ts`)

- [ ] Logos are committed files with size — input: `docs.json` `logo.light` and `logo.dark`; expected: both files exist under `apps/docs`, each root `svg` has `width`, `height` and `viewBox="0 0 120 32"`, `role="img"` and `<title>zapbip</title>`, and the dark one differs from the light one
- [ ] The images-sized rule — input: `docs-experience.test.ts::every image in the docs reserves its space with a width and a height`, extended in step 16 to `snippets/*.jsx`; expected: no unsized `<img>`/`<Image>` in any `.mdx` or `.jsx`; the companion `an image tag without a height fails` still passes
- [ ] `docs.json` tokens — input: `docs.json`; expected: `theme` is `mint`, `colors.primary` `#0B6B60` at 4.5 or more on `#FFFFFF` and `#F6F8F5`, `colors.light` `#25D366` at 3 or more on `#07120F`, `background.decoration` `gradient`, `appearance.default` `system`, `favicon` `/favicon.svg`, and the `navigation` block byte-equal to `origin/main`'s
- [ ] Docs contrast, both themes, from the parsed files — input: `zapbip.css` (light, and the `.dark` rules) and `chat.jsx`; expected at or above 4.5: eyebrow text on its pill; hero statement, accent and lead on the lightest and darkest gradient points; both buttons; chat header white on `#075E54`; sender names on `#FFFFFF`, `#D9FDD3`, `#FFEECD`; `mutedInk` on `#FFFFFF` and `#D9FDD3`; and the header-over-dark pair, `#E8F1ED` on the dark page `#07120F`; at or above 3: the chat document icon, audio disc and quote bar on white
- [ ] `chat.jsx` has no `#128C7E` as a text colour; `frame="phone"` and `typing` exist; every svg and the typing bubble are `aria-hidden`; the existing `docs-chat-component.test.ts` rows stay green
- [ ] `zapbip.css` motion — input: the file; expected: every `@keyframes` use sits inside `@media (prefers-reduced-motion: no-preference)`; a `@media (forced-colors: active)` block exists; no `@import`; no `url(` to another origin
- [ ] Hero props parity — input: `<Hero …>` in `index.mdx` and `pt-br/index.mdx`; expected: the same prop names, and every pt-BR value differs from its English twin; `primary`/`secondary` hrefs resolve to pages in `docs.json` and the pt-BR ones start with `/pt-br/`; each statement is under eight words
- [ ] Heading shape — input: both Overviews; expected: `Hero` renders no `h1` to `h6`; the heading order tests of `docs-experience.test.ts` pass; the page `h1` is the frontmatter title
- [ ] `Hero` sits right after the imports and above "Why zapbip exists" in both pages
- [ ] pt-br twin of the whole page: `docs-navigation.test.ts` still passes (no page added or removed)

## E2E (Playwright specs)

- [ ] `API/e2e/backoffice/ui-polish.spec.ts::no horizontal scroll` — steps: for each page (sign-in, home, numbers empty and one, register, detail, verification, metrics, audit, 404) and each `colorScheme` `light` and `dark`, at viewport 375 by 812; expected: `document.documentElement.scrollWidth === 375` on all 11 pages by 2 schemes
- [ ] `::no overlap` — steps: at 375 and 1280, the bounding-box helper of `e2e/backoffice/support/layout.ts` (the one the metrics walk uses) on header children, card children, figure grid, chart labels and bars, filter bar controls, page-head children, detail grid columns; expected: no pair of sibling boxes intersects
- [ ] `::both schemes render` — steps: `colorScheme` light then dark on every page, screenshot to `.pr-media/after-<page>-<width>-<scheme>.png`; expected: `getComputedStyle(body).backgroundColor` is the light `--color-page` then the dark one, text never equals background
- [ ] `::reduced motion` — steps: `reducedMotion: 'reduce'` on home and metrics; expected: computed `animation-name` is `none` on `.live-dot`, `.notice`, the bars and the empty-state bubble; with `no-preference`, `.live-dot` has a running animation (staging fixture) and the production fixture has no `.live-dot` in the header
- [ ] `::forced colors` — steps: `forcedColors: 'active'` on home; expected: the `.hero-card` computed `border-top-color` is not transparent, the nav's current link is still distinguishable (weight), the sparkline stroke is visible, focus outline present
- [ ] `::sticky header` — steps: at 1280 scroll the metrics page until a table row is under the header; expected: header stays at `top: 0`, its text still passes 4.5:1 sampled against the pixel behind it; at 375 the header scrolls away (not sticky)
- [ ] The existing backoffice specs (`sign-in`, `numbers`, `error-pages`, and the metrics spec) pass with their selectors unchanged
- [ ] `apps/docs/e2e/ui-polish.spec.ts::hero` — steps: open `/` and `/pt-br` at 1280 and 375, light and dark; expected: `style[data-custom-css-path]` in `<head>`; hero visible; copy and phone boxes do not overlap at 1280 and are stacked copy-first at 375; `scrollWidth === 375`; the logo image has `naturalWidth` above 0 in both schemes
- [ ] The docs walk, selectors unchanged — steps: `pnpm --filter @zapbip/docs test:walk`; expected: every existing spec passes with no edit to `apps/docs/e2e/{agents-a,agents-b,developers,features,from-zero,get-started,help,language,mcp-reference,not-found}.spec.ts` (`git diff origin/main -- those files` is empty)
- [ ] Broken links — steps: `pnpm --filter @zapbip/docs broken-links`; expected: zero broken links

## Docs gate and Mintlify client

- [ ] Mintlify 0.0.4077 — steps: `pnpm --filter @zapbip/docs dev` (it runs `mint dev --client-version 0.0.4077`), open `/`; expected: the terminal prints the pinned client, `style[data-custom-css-path="zapbip.css"]` is in the page, the `colors.primary` link colour computes to `rgb(11, 107, 96)`, the logo renders; record the actual client string and the `mint` version
- [ ] `pnpm verify` (class `docs` plus `product` for the API paths) — expected: green on the final head, summary posted as the PR comment

## Prove it for real — Playwright MCP

The `playwright` and `playwright-second` servers (both `--isolated`), the walk fixtures, the same ports and data for before and after. `.pr-media` is `/Users/dhyegocalota/Projects/zapbip/zapbip/.pr-media/ui-polish`.

- [ ] Before set exists — evidence: 52 files `.pr-media/before-<page>-<width>-<scheme>.png` (13 pages, 1280 and 375, light and dark), taken by the recorder on merged `main` including the metrics page, before any lane edit; `git log` shows the capture time precedes the first lane commit
- [ ] Happy path, backoffice, entry to exit: sign in with the key and code, home (three cards, three sparklines, hero card on Numbers), Numbers, register a number, its detail, verify, Metrics (filter, charts, show values), Audit, switch to PT, sign out; expected: each page shows the identity of design §2 and every copy string is unchanged from the backoffice design
- [ ] Empty: a fresh database; expected: home shows the warning notice, "Register a number" primary, three sparklines reading "No activity in the last 14 days" and no flat line; Numbers shows one `.empty-state` with the 96 px bubble whose dots move once and stop, and the primary button is the only primary button; metrics sections show the same bubble and "No data yet", figures read 0
- [ ] Single: one pending number; expected: detail shows the hero summary, the warning notice, no `.live-dot` on the badge; sparkline "Numbers registered" shows a single non-zero day
- [ ] Many: 14 days of registrations, messages and audit entries plus 30 numbers; expected: three 14-point sparklines with totals and peaks, the Numbers table scrolls as a page, no layout break
- [ ] Active number: expected: the active badge shows the word and the pulsing live dot; closed, pending and disabled do not
- [ ] Environment chip: on staging and on development the chip's dot pulses (two iterations then stops); on a production-environment fixture there is no chip and no live dot in the header
- [ ] Rejected input: a wrong code at sign-in and an invalid registration form; expected: the notice arrives (motion once), copy and focus order unchanged, inputs keep `aria-invalid` with a 2 px danger border
- [ ] Browser Back from number detail to the list, and reload on the metrics page; expected: layout identical, no flash of unstyled content, sparklines identical
- [ ] Two operators in two isolated browser contexts: one registers a number while the other sits on home; expected: after the second reloads, the Numbers total, state badges and numbers sparkline include it
- [ ] Narrow width 375: every page; expected: `scrollWidth` 375, tables as bubble cards, header three rows and static, buttons full width, hero card still the first card
- [ ] Desktop width 1280: every page; expected: sticky blurred header, two-column number detail with the sticky summary, charts and figures aligned, no clipped label
- [ ] Docs: `/` and `/pt-br` at 1280 and 375, light and dark; expected: hero with the signal glow, eyebrow chip, statement and accent line, two buttons, the phone with the typing bubble moving four times then stopping; the sidebar, search and language switch still work; the four "What it looks like" chats keep the default frame
- [ ] Reduced motion on, then off, on the backoffice and on the docs; expected: with it on, nothing animates (the live dot, the notice, bars, empty bubble, typing dots are in their end state); with it off, each motion matches design §7 and nothing moves for longer than five seconds
- [ ] Contrast spot check in the browser: the header text over a dark table row, the hero lead on the gradient, the sparkline summary text; expected: each at least 4.5:1 sampled from the screenshot pixels
- [ ] Keyboard: Tab through home, detail and the docs hero; expected: a visible 3 px focus outline on every control, the focused field is never under the sticky header
- [ ] Console and network clean: zero console errors, zero failed requests on every page, other than the expected 404 of the 404 page and the 401/403/429 of the error-page walk; no request to another origin; no CSP violation reported
- [ ] Before and after: for every before file, the matching `after-<page>-<width>-<scheme>.png` exists and differs; the tester lists what changed per page in one line
- [ ] Screenshots at `.pr-media/after-*.png`; video at `.pr-media/ui-polish-walk.mp4` and `.gif`; both embedded in the PR body as before/after pairs

## Edge cases found during execution

Empty on purpose. The tester adds one checkbox per new case (input, exact expected outcome) and a regression test for each.

## Adversarial review

The reviewer picks the three claims most likely to be wrong and tries to refute each. Candidates:

- [ ] Claim 1: "the home page reads three extra series with no extra round trip" — attack: count `batch` and `prepare` calls with 1 and 50 numbers, then add an artificial slow row; result: <refuted | held>
- [ ] Claim 2: "every pair is AA in both themes, header included" — attack: scroll a dark table under the header at 1280, sample the pixels, run the contrast by hand on the glow-composited page; result: <refuted | held>
- [ ] Claim 3: "the CSP is byte-equal and nothing needs a style or script" — attack: diff `CONTENT_SECURITY_POLICY` against `origin/main`, grep every rendered page for `style=`, `<script`, `@import` and `url(`, load a page with a CSP violation listener; result: <refuted | held>

## Coverage honesty

What is not tested and why.

- Real iOS Safari and Android Chrome rendering of `backdrop-filter`, `ui-rounded` and the gradient border — Playwright drives Chromium (and WebKit if installed); the risk accepted is a flat header or a system face on other platforms, and the page still reads.
- Mintlify's own dark-mode toggle for the hero beyond `colorScheme` emulation — the `.dark` ancestor selector is asserted in the CSS and sampled in the browser, not run on every Mintlify release.
- A Mintlify client other than 0.0.4077 — the cache is not pinned to that version; the `dev` script is, and step 21 records the client string.
- The visual quality ("hyper sexy") itself — no machine check exists; the before and after pairs are for the owner's eyes.
- Windows high-contrast themes — `forced-colors` is emulated in Chromium, not run on Windows.
