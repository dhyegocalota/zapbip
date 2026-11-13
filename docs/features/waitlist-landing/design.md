# Waitlist landing page: design

**Feature:** [waitlist-landing](spec.md)
**Written by:** `frontend-designer`
**Status:** final. The owner delegated every choice on 2026-11-12 ("bold, simple, super sexy, self-explanatory above the fold for AI enthusiasts"), so each open choice below carries one decision, not a menu. Each is recorded in §16 as `owner delegated 2026-11-12`.
**Builds on:** the "Signal" identity of [ui-polish](../ui-polish/design.md) §2 (the bubble-tail corner, one luminous green used as light, rounded display type) and the backoffice token file `apps/api/src/backoffice/assets/backoffice.css`.
**Mockup:** `mockups/landing.html` (static, self-contained, states switched by the URL hash); screenshots in §15.

## 0. Starting point

There is no public page today: `zapbip.com` answers nothing (spec, facts). The surfaces a visitor may already know are the docs Overview (`apps/docs/index.mdx`: "Your AI messages you. You answer on WhatsApp.", a phone chat mockup) and nothing else. The landing speaks with the same voice and the same phone, louder.

### 0.1 What the two references teach (structure and feel only)

Studied with Playwright MCP at 1440 and 375 on 2026-11-12. Screenshots in the owner's checkout, git-ignored: `.playwright-mcp/design-refs/datafast-1440-fold.png`, `datafast-375-fold.png`, `datafast-1440-full.jpg`, `aqua-1440-fold.png`, `aqua-1440-section.png`, `aqua-375-fold.png`.

| Lesson | datafa.st | aquavoice.com | What zapbip takes |
|---|---|---|---|
| The fold is one claim | 3-word headline, 2-line subhead | 4-word headline with a period, 1-line subhead | One sentence headline that says the product; a subhead that says the loop |
| The action sits under the claim | field + button + one line of reassurance | one CTA in the nav, one in a floating dock | Email field + Join, with the privacy line under it |
| The product is shown, not described | the real dashboard in browser chrome, peeking from the fold at 375 | the real app in motion inside a device frame | The real flow (terminal asks, phone answers) as a looping muted video in a dark stage |
| Rhythm | 3 steps, features, "for AI agents", works with, pricing, comparison, FAQ, final CTA | social proof wall, feature trios with videos, pricing, final CTA with a video | 3 steps, capabilities, works with, privacy band, FAQ, final CTA |
| Mobile | stacked; product visible under the button | stacked; product fills the fold under a short claim | stacked; the demo peeks under the form at 375 × 812 |

Nothing is copied: no text, no art, no layout one-to-one. zapbip's own motifs are the bubble tail, the signal light, the terminal and the phone.

## 1. Constraints

- **Policy.** The site policy of [ADR 0041](../../adr/0041-the-public-site-is-served-by-the-api-worker-through-host-dispatch.md) decision 4: `script-src 'self' https://challenges.cloudflare.com`, `frame-src https://challenges.cloudflare.com`, `img-src 'self'`, `style-src 'self'`, `media-src 'self'`. So: no inline `<script>`, no `style=""`, no inline `<style>`, no external font, no external image. SVG presentation attributes (`width`, `x`, `fill="currentColor"`) are not styles and stay allowed; dynamic widths (the invite meter) are SVG attributes.
- **One stylesheet, one small script.** The site stylesheet is generated like the backoffice one (content-hash URL, cacheable); `site-scripts.ts` is the only first-party script.
- **Fonts.** System stacks only (`--font-sans`, `--font-display`, `--font-mono`), no font file. This also keeps LCP free of font loading.
- **Copy.** Every visible string lives in `apps/api/src/site/site-copy.ts` under `SiteCopyKey` (§11), and the backoffice strings in `backoffice-copy.ts` (§13.4). No string in JSX.
- **Light first; dark is a token switch.** The two depicted product surfaces (the terminal and the phone screen) are fixed palettes in both themes, because they picture a terminal and a phone, not the page.

## 2. Direction: "Signal, amplified" (decided)

The backoffice is calm. The landing is the same identity at full volume:

1. **Huge rounded headline.** `--font-display` at up to 72 px, tight tracking, the words "on WhatsApp" in a teal-to-green gradient with a signal-green underline that draws itself once.
2. **A dark stage for the product.** The demo plays in a near-black rounded stage with a green glow, in both themes. It is the one dark object on a light page, so the eye lands on it.
3. **Bubble tails everywhere.** Every card, the stage, the thank-you panel and the final call to action have three round corners and one tight top-left corner. Pills stay pills.
4. **One luminous green.** `#25D366` is only light: the live dot, glows, the underline, the meter fill. It never carries text in light mode.
5. **One dark band.** The privacy section ("Official API. Only you.") is a full-bleed terminal-dark band in both themes, the page's one change of key.

Rejected alternatives, one line each (owner delegated 2026-11-12): a dark-first page (breaks "light first, dark is a token switch" and fights the docs); a centred hero with the demo below it (at 1280 × 720 the demo would fall under the fold, which fails the first-fold E2E); an illustrated hero instead of the real product (the owner asked for the product in motion).

## 3. Page anatomy and section order (decided)

| # | Section | Element | Purpose |
|---|---|---|---|
| 0 | Header | `header.site-header` | brand, Docs, language; Join shortcut at ≥ 64rem |
| 1 | Hero `#join` | `section.hero` with the only `h1` | claim, subhead, form or thank-you, demo |
| 2 | How it works `#how` | `section` + `h2` | three steps |
| 3 | What agents can do `#capabilities` | `section` + `h2` | six capability cards with mini chats |
| 4 | Works with `#clients` | `section` + `h2` | eight client tiles with wake times |
| 5 | Privacy and the official API `#privacy` | full-bleed dark band + `h2` | three promises and what the waitlist stores |
| 6 | FAQ `#faq` | `section` + `h2` + `details` | seven short answers |
| 7 | Final call to action | `section.final-call` + `h2` | one button back to the form |
| 8 | Footer | `footer.site-footer` | maker, Docs, trademarks, theme switch |

Section rhythm: `padding-block: var(--space-8)` under 64rem, `var(--space-9)` from 64rem. Every section's content sits in `.container` (`max-width: var(--measure-page)`, inline padding `--space-4` under 40rem and `--space-5` from 40rem). Section heads: an eyebrow (`.eyebrow`, existing), the `h2` at `--text-section`, an optional `.lead`.

### 3.1 Header

- Left: `.brand` (existing CSS mark: the bubble with three dots and the signal glow) inside a link to `/` with the accessible name "zapbip home" (`SiteCopyKey.BrandHomeLabel`).
- Right, from 40rem: `a.nav-link` "Docs" to `https://docs.zapbip.com` (pt-BR: `https://docs.zapbip.com/pt-br`), the locale switch, and from 64rem a `button-primary` link "Join" to `#join` (hidden in the joined and paused states).
- Under 40rem: brand and the compact locale switch only ("PT" / "EN" with `lang` and a full `aria-label`); Docs moves to the footer. One row, 56 px tall, never wraps.
- The theme switch lives in the footer at every width (a landing page header carries one action; the header stays one row at 375).
- Sticky with the existing blur from 40rem (`.site-header` rule), static under 40rem.
- Both switches reuse the backoffice markup and classes (`.locale-switch`, `.theme-switch`, `aria-pressed` buttons in a POST form, icons from `components/icons.tsx`). The form's return target keeps `ref` (test plan: the switcher keeps the referral code).

### 3.2 Hero

Two columns from 64rem (`grid-template-columns: minmax(0, 6fr) minmax(0, 5fr)`, gap `--space-7`, `align-items: center`), one column below. Order in the DOM and on screen: copy column, then the demo.

Copy column, top to bottom (`max-width: var(--measure-hero-copy)`):

1. **Eyebrow pill** `.hero-eyebrow`: `--color-success-surface` fill, `--color-action` text, `--text-eyebrow` uppercase, a `.live-dot`. Text: `HeroEyebrow`. On a referral landing the same slot (same height) shows `HeroInvited` instead, so nothing shifts.
2. **Headline** `h1.hero-title`: `HeroTitleLead` + `span.hero-accent` `HeroTitleAccent`. The accent span has the gradient text and the underline SVG (§9.2).
3. **Subhead** `p.hero-lead`: `HeroLead`, `--text-lead`, `--color-text-muted`.
4. **The join block** `div.join-block` (`min-height` fixed per breakpoint so swapping states never moves the demo below 64rem; §5):
   - `form.join-form` `method="post" action="/join"`:
     - `label.visually-hidden` `JoinEmailLabel` for `input#join-email` (`type=email`, `name=email`, `autocomplete=email`, `inputmode=email`, `required`, `maxlength` = `WAITLIST_EMAIL_MAX_LENGTH`, `placeholder` `JoinEmailPlaceholder`, `spellcheck=false`, `autocapitalize=off`).
     - `button.button.button-primary.button-arrow.join-submit` `JoinSubmit`.
     - hidden `locale`, hidden `referralCode` (only when the code is shape-valid).
     - `div.turnstile-slot` holding the widget `div.cf-turnstile` (`data-sitekey`, `data-action="waitlist-join"`, `data-theme` from the page theme: `light`, `dark` or `auto`, `data-language` `en` or `pt-br`, `data-size="flexible"`, `data-appearance="always"`, callbacks named in `site-scripts.ts`). The slot reserves `--size-turnstile` of height so the widget never shifts the page.
     - `noscript` paragraph `JoinNeedsScript`.
   - `p.privacy-note`: `PrivacyNoteShort` with a link `PrivacyNoteLink` to `#privacy`.
   - Field row: from 40rem the field and the button sit in one pill-shaped group (`.join-row`, `display: flex`, the field `flex: 1`, both `--size-hero-control` tall, a shared `--radius-pill` outline with the button inset 4 px); under 40rem they stack, both full width.
5. Nothing else. No social proof (none exists yet; inventing it is off-brand).

Demo column: `figure.demo` (§9.1): the stage, the pause button, three localized step captions under it, and a visually hidden long description.

### 3.3 How it works

`h2` `HowTitle`; three `ol > li.step` cards. Each: a bubble-tail number chip (rounded display numeral 1, 2, 3 on `--color-success-surface`), `h3`, one sentence, and a small illustration (`aria-hidden`):

| Step | Title | Illustration |
|---|---|---|
| 1 | `HowStepConnectTitle` | a mono pill `HowStepConnectVisual` ("1 line to paste") with a clipboard icon |
| 2 | `HowStepTextTitle` | an incoming bubble with two buttons (`HowStepTextVisualQuestion`, `…VisualYes`, `…VisualNo`) |
| 3 | `HowStepAnswerTitle` | a terminal chip, dark: `✓` + `HowStepAnswerVisual` ("answer received, continuing") |

Layout: 3 columns from 56rem; under 56rem one column where each step is a row (chip left, text right, illustration under the text).

### 3.4 What agents can do

`h2` `CapabilitiesTitle`, `.lead` `CapabilitiesLead`; six `.card` bubbles in a grid (`repeat(auto-fit, minmax(17rem, 1fr))`: 3 columns at 1440, 2 at 768, 1 at 375). Each card: `h3`, one sentence, and a mini chat (`div.mini-chat`, `aria-hidden="true"`, text from copy keys so it is translated):

| Card | Mini chat |
|---|---|
| Ask with buttons | agent bubble + two button pills |
| Pick from a list | agent bubble + a list pill + three rows with radio circles |
| Files, photos and voice notes | agent bubble with a document chip `report.pdf`; your voice-note bubble (waveform bars as SVG `rect`s) |
| You can text first | your bubble, then the agent's answer and a small "woke in 7 s" chip |
| Many agents, one chat | two agent bubbles with different sender names; your reply quoting one |
| Waits as long as it takes | agent bubble, a centered day-divider pill "3 hours later", your reply |

The mini chat uses the fixed phone palette (§6.2) on `--color-chat-wallpaper`, inside the card, with `--radius-control` and an inner shadow-free border; it reads as a slice of the phone.

### 3.5 Works with

`h2` `ClientsTitle`; eight tiles, 2 columns under 40rem, 4 from 40rem. Each tile: client name (`--font-display`, 600, `--text-heading-3`) and a wake chip (`.state-badge`-like pill with a `.live-dot`): `ClientsWakeSeconds` with `{seconds}`, or a fixed line.

| Tile | Chip |
|---|---|
| Claude Code | wakes in ~7 s |
| Codex | wakes in ~6 s |
| Grok Bot | wakes in ~9 s |
| claude.ai | wakes in ~16 s |
| ChatGPT | checks every hour |
| Cursor | runs on your computer |
| Gemini CLI | runs on your computer |
| Any MCP app | one MCP server, one key; the last tile, same size, `hero-card` gradient border (spanning two columns left an orphan cell in the 4-column grid) |

Names are plain text in the site font; no third-party logo (trademark and CSP). Footnote `.field-help` `ClientsFootnote`. The seconds come from the docs agent matrix (`apps/docs/snippets/agents/matrix.mdx`); they are copy values, kept in `site-copy.ts`, not computed.

### 3.6 Privacy band

Full-bleed `section.band` with `background: var(--color-terminal)` and `color: var(--color-terminal-text)` in both themes, a soft signal glow at the top edge (`--gradient-band`). `h2` `PrivacyTitle`; three columns from 56rem (one under) of icon + `h3` + sentence (official API, only you, one key per agent); then a bordered bubble `p#privacy-waitlist` with `PrivacyWaitlistTitle` and `PrivacyWaitlistBody` (what the waitlist stores, the deletion contact). The `#privacy` link under the form lands here.

### 3.7 FAQ

`h2` `FaqTitle`; `max-width: 48rem`; seven `details.faq-item` with `summary` (`min-height: var(--size-tap)`, the existing `›` chevron that rotates 90° when open, `--duration-base`). The first item is not open by default. Answers are plain paragraphs.

### 3.8 Final call to action

`section.final-call` with one `.hero-card` bubble (gradient border, `--elevation-hero`), centered text: `h2` `FinalTitle`, `p` `FinalBody`, `a.button.button-primary.button-arrow.button-large` `FinalButton` to `#join`. A large decorative bubble mark (CSS, `aria-hidden`) sits behind the card's top-right corner at 6rem. In the joined state the button reads `FinalButtonInvite` and still points at `#join` (the thank-you panel). In the paused state the button is replaced by `JoinPausedBody`.

### 3.9 Footer

Two rows inside `.container`, `--text-small`, `--color-text-muted`: (1) `FooterMaker`, a Docs link (under 40rem only, since the header carries it from 40rem), the theme switch at the end; (2) `FooterTrademarks`.

## 4. Every state of the public page

The page is server-rendered; each state is a distinct render, not a client toggle, except the three marked "client".

| State | When | What changes | Status |
|---|---|---|---|
| Idle | `GET /` | §3 as described | 200 |
| Idle with referral | `GET /?ref=<shape-valid code>` | eyebrow slot shows `HeroInvited` (with a small bubble icon instead of the live dot); hidden `referralCode` carries the code. A malformed code shows plain Idle and drops the code. No lookup, so an unknown or capped code looks the same as a valid one | 200 |
| Submitting (client) | the form submits and the token is present | `join-submit` gets `aria-busy="true"`, `aria-disabled="true"`, a 16 px spinner replaces the arrow, the label becomes `JoinSubmitting`; the field becomes `readonly`; a second submit is ignored. Without the script the browser's own navigation shows | n/a |
| Token missing (client) | submit pressed before Turnstile produced a token | submit prevented; the notice `JoinCaptchaFailed` renders above the form from a server-rendered `template`; focus moves to the widget slot | n/a |
| Offline (client) | submit while `navigator.onLine === false` | submit prevented; notice `JoinOffline` (warning) above the form; the button stays usable | n/a |
| Invalid email | outcome `InvalidEmail` | the field keeps the typed value, `aria-invalid="true"`, `aria-describedby` → `p#join-email-error.field-error` `JoinEmailInvalid` under the row; the field has `autofocus` | 422 |
| Turnstile failed | outcome `CaptchaFailed` | `Notice` error `JoinCaptchaFailed` above the form; value kept; a fresh widget | 403 is the developer's call; the copy does not depend on it |
| Rate limited | outcome `RateLimited` | `Notice` warning `JoinRateLimited` above the form; value kept; `Retry-After` header | 429 |
| Unavailable after a POST | outcome `Unavailable` (siteverify timeout, 5xx or malformed; clash after three tries; cap row missing) | `Notice` warning `JoinUnavailable` above the form; value kept; widget reset | 503 |
| Paused | the secret is missing or whitespace in production or staging | the whole `form` is replaced by a `.notice-warning` bubble: `JoinPausedTitle` (strong) + `JoinPausedBody`; no field, no button, no Turnstile script; the header Join and the final button are hidden; the privacy note stays | 200 (spec) |
| Joined | outcome `Joined` | the `form` and the privacy note are replaced by the thank-you panel (§4.1); the headline, subhead and demo stay; the header Join hides; the final button becomes `FinalButtonInvite` | 200 |
| Already joined | outcome `AlreadyJoined` | byte-for-byte the Joined markup for that row (spec: identical) | 200 |
| Joined at cap | credited = cap | the count line plus `ThanksCapReached` under it; the meter is full | 200 |
| Not found | any unknown path | the layout with `.error-code` "404", `NotFoundTitle`, a `button-secondary` `NotFoundHome` to `/` | 404 |

Notices reuse the backoffice `Notice` look and roles (`role="alert"` for warning and error, `role="status"` for info and success) with site copy for the labels (`NoticeLabelWarning`, `NoticeLabelError`). They render inside `.join-block`, above the form, never above the headline, so the headline never moves.

### 4.1 Thank-you panel

`div.thanks.hero-card` in the join block, `role="status"` wrapper so its arrival is announced once:

1. A 40 px success mark (the bubble mark in `--color-action` with a white check, SVG) with the one-time bubble burst (§9.3).
2. `h2#thanks-title` `ThanksTitle` (`tabindex="-1"`; the script focuses it after load so screen readers start here).
3. `p` `ThanksBody`.
4. `label` `ThanksLinkLabel` for `input#invite-link` (`readonly`, `--font-mono`, the full link `https://zapbip.com/?ref=<code>`; selecting it is the no-script copy path).
5. Actions row: `button.button.button-primary.copy-link` `ThanksCopy` (swaps to `ThanksCopied` with a check icon for 2 s; a visually hidden `aria-live="polite"` span announces `ThanksCopiedAnnouncement`; if the Clipboard API fails, the input text is selected and the span announces `ThanksCopyFallback`), and `a.button.button-secondary` `ThanksShareWhatsApp` to `https://wa.me/?text=<encoded ThanksShareText>` with `target="_blank" rel="noopener"`.
6. The invite meter: `p.invite-count` `ThanksInviteCount` (`{count} of {cap} friends invited`), and above it an `svg.invite-meter` (`aria-hidden`, 100 × 8 viewBox, height 0.5rem): with cap ≤ 10, `cap` rounded segments with 2-unit gaps, the first `count` filled `--color-brand`, the rest `--color-sunken`; with cap > 10, one track and one fill whose `width` attribute is `count / cap × 100`. The text is the source of truth.
7. At cap: `p.field-help` `ThanksCapReached`.

At 375 the actions stack, both full width; from 40rem they sit in one row.

## 5. Responsive rules

| | 375 (reference 375 × 812) | 768 | 1440 (and the 1280 × 720 test fold) |
|---|---|---|---|
| Gutter | `--space-4` (16 px, test plan) | `--space-5` | `--space-5`, content max `--measure-page` (72rem) |
| Header | 56 px, brand + PT/EN | brand, Docs, locale | brand, Docs, locale, Join |
| Hero | one column: eyebrow, h1 (2 lines at 40 px in en_US; 3 in pt_BR), lead (3 lines), field, button, Turnstile, note; in the mockup the stage starts at ≈ 607 px and shows ≈ 205 px in the 812 fold, the question bubble and both buttons included (≈ 60 px at 667) | one column, form row inline, demo at `--measure-demo`, left-aligned with the copy | two columns 6 : 5; h1 3 lines at 72 px; everything including the poster above 720 px (mockup: the privacy line ends at 680 px) |
| Join block min-height | 15rem | 12rem | none (the demo column sets the row height) |
| Steps | 1 column, rows | 1 column, rows | 3 columns |
| Capabilities | 1 column | 2 columns | 3 columns |
| Clients | 2 columns | 4 columns | 4 columns |
| Privacy | 1 column | 1 column | 3 columns |
| FAQ | full width | 48rem | 48rem centered |
| Tap targets | `--size-tap` (44 px) minimum; hero controls `--size-hero-control` (56 px) | same | same |

Every grid child has `min-width: 0`; the invite link input has `min-width: 0` and the mono value scrolls inside it, so nothing forces horizontal scroll at 375 (test plan gate). Long pt-BR words: `overflow-wrap: anywhere` on `.mini-chat` and `.invite-count`.

## 6. Tokens

The site stylesheet repeats the backoffice token names with the backoffice values (so a reader sees one design system), in the same three blocks (light `:root`; dark under `:root:not([data-theme='light'])` inside `prefers-color-scheme: dark`; the same dark palette under `:root[data-theme='dark']`), and adds the site tokens below. The developer keeps the three blocks equal with a shape test like `backoffice-tokens.test.ts`, and proves the contrast pairs of §6.4 like `backoffice-contrast.test.ts`.

### 6.1 Reused unchanged

Every colour, font, space (`--space-1`…`--space-8`), radius, shadow, glow, pattern, duration and easing token of `backoffice.css` lines 2–145, by the same name and value. The site reads `--color-page`, `--color-surface`, `--color-sunken`, `--color-raised`, `--color-header`, `--color-text`, `--color-text-muted`, `--color-border`, `--color-border-control`, `--color-brand`, `--color-on-brand`, `--color-signal`, `--color-action`, `--color-action-hover`, `--color-on-action`, `--color-success-surface`, `--color-info-surface`, `--color-danger`, `--color-danger-surface`, `--color-warning`, `--color-warning-surface`, `--color-focus`, the three font stacks, `--text-eyebrow`, `--text-small`, `--text-body`, `--text-heading-3`, `--text-heading-2`, `--text-display`, `--tracking-tight`, `--tracking-eyebrow`, `--radius-*`, `--size-tap`, `--size-focus-ring`, `--size-focus-offset`, `--measure-page`, `--shadow-*`, `--glow-signal`, `--glow-signal-faded`, `--gradient-hero-border`, `--elevation-hero`, `--pattern-dots`, `--duration-*`, `--ease-*`, `--radius-bubble`, `--mark-bubble`.

### 6.2 New site tokens (owner delegated 2026-11-12)

Colours. The terminal and phone palettes are the same in both themes (they depict devices); the phone palette is the docs chat palette that ui-polish §10.4 already proved for AA.

| Token | Light | Dark | Role |
|---|---|---|---|
| `--color-terminal` | `#0D1B17` | `#050D0B` | the demo stage, terminal bodies, the privacy band |
| `--color-terminal-bar` | `#15261F` | `#0D1B17` | terminal title bars, band cards |
| `--color-terminal-text` | `#E8F1ED` | same | text on terminal surfaces |
| `--color-terminal-muted` | `#9DB2AA` | same | secondary text on terminal surfaces |
| `--color-terminal-accent` | `#5BE39A` | same | prompts, check marks, links on the band |
| `--color-terminal-border` | `#1F332D` | same | card borders on the band |
| `--color-chat-wallpaper` | `#ECE5DD` | same | mini-chat and phone background |
| `--color-chat-header` | `#075E54` | same | phone header |
| `--color-chat-incoming` | `#FFFFFF` | same | incoming bubbles, button pills |
| `--color-chat-outgoing` | `#D9FDD3` | same | your bubbles |
| `--color-chat-ink` | `#111B21` | same | bubble text |
| `--color-chat-muted` | `#54656F` | same | times, captions, radio circles |
| `--color-chat-sender` | `#0B6B60` | same | sender names, button pill text |
| `--color-bezel` | `#0E1F1A` | `#020806` | phone bezel (dark adds a `--color-terminal-border` ring) |

Gradients and glows:

| Token | Light | Dark |
|---|---|---|
| `--gradient-hero` | `radial-gradient(48rem 32rem at 78% 6rem, rgb(37 211 102 / 0.26), transparent 70%), radial-gradient(40rem 24rem at 0% 0%, rgb(18 140 126 / 0.12), transparent 70%)` | the same at `0.24` and `0.16` |
| `--gradient-accent-text` | `linear-gradient(100deg, var(--color-action), var(--color-brand))` | `linear-gradient(100deg, var(--color-brand), var(--color-action))` |
| `--gradient-stage` | `radial-gradient(28rem 20rem at 70% 20%, rgb(37 211 102 / 0.22), transparent 70%)` over `--color-terminal` | same |
| `--gradient-band` | `radial-gradient(56rem 16rem at 50% 0%, rgb(37 211 102 / 0.18), transparent 70%)` | same |
| `--elevation-stage` | `0 2px 4px rgb(14 31 26 / 0.08), 0 40px 80px -32px rgb(14 31 26 / 0.45), 0 24px 64px -24px rgb(37 211 102 / 0.30)` | `0 0 0 1px rgb(232 241 237 / 0.06), 0 40px 80px -24px rgb(0 0 0 / 0.8), 0 24px 64px -24px rgb(37 211 102 / 0.28)` |

The hero section's background is `var(--gradient-hero)` (`no-repeat`) on `--color-page`. The dot pattern (`--pattern-dots` at `1.25rem`, the backoffice signed-out shell pattern) sits on a `.hero::before` layer with `mask-image: linear-gradient(black 55%, transparent)`, so the dots fade out before the next section and the hero has no visible bottom edge (the first mockup pass showed a hard seam without the mask).

Type:

| Token | Value | Computes to |
|---|---|---|
| `--text-hero` | `clamp(2.5rem, 1.5rem + 4.2vw, 4.5rem)` | 40 px at 375, 56 px at 768, 72 px from 1240 |
| `--text-section` | `clamp(2rem, 1.25rem + 2.6vw, 3.25rem)` | 32 px at 375, 40 px at 768, 52 px at 1440 |
| `--text-lead` | `clamp(1.0625rem, 0.95rem + 0.45vw, 1.3125rem)` | 17 px at 375, 21 px at 1440 |
| `--leading-hero` | `1.02` | h1 and section titles use `1.05` (the existing h1 uses 1.1) |
| `--tracking-hero` | `-0.035em` | h1 and `h2` section titles |

Weights: h1 800, section `h2` 750, `h3` 650, body 400, buttons 600 (existing).

Space and size:

| Token | Value | Use |
|---|---|---|
| `--space-9` | `6rem` | section padding from 64rem |
| `--size-hero-control` | `3.5rem` | the email field and the Join button |
| `--size-turnstile` | `4.0625rem` | the reserved widget slot (the widget is 65 px tall) |
| `--measure-hero-copy` | `36rem` | the copy column |
| `--measure-demo` | `34rem` | the stage's maximum width |
| `--measure-faq` | `48rem` | the FAQ column |

Motion:

| Token | Value | Use |
|---|---|---|
| `--duration-draw` | `900ms` | the headline underline stroke |
| `--duration-burst` | `900ms` | the thank-you bubble burst |
| `--ease-draw` | `cubic-bezier(0.65, 0, 0.35, 1)` | the underline |

### 6.3 Raw colour rule

Every colour above appears only inside the three `:root` blocks; components name tokens. `forced-colors: active` drops the gradients, glows and the stage background (system colours `Canvas`, `CanvasText`), keeps borders, and gives the invite meter `CanvasText` fill (the backoffice pattern).

### 6.4 Contrast, proven

WCAG 2.x relative luminance; AA is 4.5:1 for text, 3:1 for large text (≥ 24 px, or ≥ 18.66 px bold) and non-text.

| Pair | Light | Dark |
|---|---|---|
| text on page / surface | 15.99 / 17.08 | 16.54 / 15.37 |
| muted on page / surface | 6.47 / 6.91 | 8.51 / 7.91 |
| muted on the hero glow peak (page mixed with the glow at its alpha) | 5.39 | 5.26 |
| action on page (links, eyebrow) / on success-surface (eyebrow pill) | 5.98 / 5.64 | 11.70 / 9.39 |
| on-action on action (Join) | 6.39 | 11.62 |
| accent gradient, worst stop, on page (h1 only, ≥ 40 px bold, large text) | `#128C7E` 3.87 | `#25D366` 9.60 |
| terminal-text / terminal-muted / terminal-accent on terminal | 15.4 / 7.9 / 10.9 | 17.1 / 8.8 / 12.1 |
| terminal-text on terminal-bar | 13.72 | 15.4 |
| chat-ink on wallpaper / incoming / outgoing | 13.99 / 17.5 / 15.8 | same (fixed palette) |
| chat-sender on incoming / outgoing | 6.39 / 5.76 | same |
| chat-muted on incoming / outgoing | 6.06 / 5.46 | same |
| white on chat-header | 7.67 | same |
| non-text: brand meter fill on surface / sunken track on surface | 4.14 / decorative (the text carries the count) | 8.93 |
| non-text: border-control around the field | 3.55 | 3.80 |
| focus ring on page | 5.79 | 9.12 |

The dark glow alpha is 0.24, not higher: at 0.30 the muted text on the glow peak drops to 4.49:1. The glow peak sits behind the demo column at 1440; at 375 it sits behind the eyebrow and h1 (text and h1 only, both well above AA).

## 7. Components

Reused from the backoffice (import or mirror the markup and class names; the developer decides whether to share the module or copy the pattern into `apps/api/src/site/views/`):

| Need | Backoffice source | Note |
|---|---|---|
| Locale switch | `components/locale-switch.tsx` | site copy keys, site path, compact labels under 40rem |
| Theme switch | `components/theme-switch.tsx` | in the footer |
| Icons | `components/icons.tsx` (`GlobeIcon`, `SunIcon`, `MoonIcon`, `MonitorIcon`) | add `CopyIcon`, `CheckIcon`, `ShareIcon`, `PauseIcon`, `PlayIcon`, `ShieldIcon`, `KeyIcon`, `PersonIcon` to the site's icon module, same `.icon` sizing and `currentColor` |
| Notice | `components/notice.tsx` | same variants, roles and glyphs; labels from site copy |
| Live dot | `components/live-dot.tsx` | eyebrow and client chips |
| Theme enum and resolver | `backoffice-theme.ts` | same three members |
| Locale resolver | `locale.ts` (`resolveLocale`) | spec |
| Favicon | `assets/favicon.ts` `FAVICON_SVG` | served at `/favicon.svg` on the site host |
| Classes | `.brand`, `.button`, `.button-primary`, `.button-secondary`, `.button-arrow`, `.card`, `.hero-card`, `.eyebrow`, `.lead`, `.notice*`, `.field-error`, `.field-help`, `.visually-hidden`, `.skip-link`, `.error-code`, `.live-dot`, `.state-badge` look | copied into the site stylesheet with the same names and rules |

New, under `apps/api/src/site/views/`:

| Component | Purpose |
|---|---|
| `SiteLayout` | `html`, `head` (§12), header, `main#content`, footer; `data-theme` from the theme member |
| `HeroSection` | eyebrow, h1, lead, `JoinBlock`, `DemoFigure` |
| `JoinBlock` | one renderer per state, dispatched from a record keyed by the page state (idle, invalid, captcha, rate limited, unavailable, paused, joined) |
| `JoinForm` | field, button, hidden fields, Turnstile slot, noscript |
| `ThanksPanel` | §4.1 |
| `InviteMeter` | the SVG meter, attributes only |
| `DemoFigure` | §9.1 |
| `MiniChat` | the small phone slices in steps and capability cards; data in, markup out |
| `StepsSection`, `CapabilitiesSection`, `ClientsSection`, `PrivacyBand`, `FaqSection`, `FinalCall` | one file each |
| `NotFoundPage` | §4 |

## 8. Interaction and accessibility

- **Landmarks.** `header`, `main#content`, `footer`; each section is `section aria-labelledby` its `h2`. One `h1`. Skip link `SkipToForm` ("Skip to the waitlist form") targets `#join-email` when the form renders, `#join` otherwise.
- **Focus order.** Skip link → brand → Docs → PT → EN → header Join → email → Join → Turnstile → privacy link → demo pause → (sections: links and FAQ summaries) → final button → footer Docs → theme buttons. Visual order equals DOM order at every width.
- **Keyboard.** Enter in the field submits. The FAQ is native `details`. The pause button toggles with Space or Enter. The header Join and the final button move focus to `#join-email` (the script focuses after the scroll; without script the fragment scrolls).
- **Names and announcements.** The field's name is `JoinEmailLabel`; its placeholder is not a label. The Join button announces busy while submitting. Errors are linked by `aria-describedby` and the field gets focus. Notices use the backoffice roles. The thank-you heading gets focus. Copy results announce through a polite live region. The pause button is `aria-pressed` with `DemoPause` / `DemoPlay` as its name.
- **Disabled reasons.** No control is ever disabled without text: in the paused state the controls are absent and the notice says why; while submitting, the busy state says it.
- **The demo.** `figure` with `aria-labelledby` its visible step captions and `aria-describedby` the hidden long description `DemoDescription`. The `video` is `muted`, has no audio and no controls; the pause button satisfies WCAG 2.2.2 (the loop runs longer than 5 s). The poster `img` alt is empty (the figure describes it).
- **Motion.** §9.4.
- **Language.** `html lang` is `en` or `pt-BR`; the locale buttons carry `lang`. The Turnstile widget gets `data-language`.
- **Zoom and text spacing.** All sizes in `rem` or `clamp` with `rem`; at 200% zoom the hero is one column and nothing clips; the reserved Turnstile slot uses `min-height`, not `height`.
- **Contrast.** §6.4.
- **Forced colours.** §6.3.
- **No-script.** Everything reads; the video stays a poster; the form posts natively; the Turnstile widget cannot render, so the `noscript` line explains it.

## 9. Motion

### 9.1 The demo (decided)

Markup inside `figure.demo`:

- `div.demo-stage` (`aspect-ratio: 1`, width 100%, `max-width: var(--measure-demo)`, `--radius-bubble` with `--radius-card` scaled to 1.75rem, `background: var(--gradient-stage)`, `box-shadow: var(--elevation-stage)`, `overflow: hidden`):
  - `img.demo-poster` `src="/site/demo-<locale>-poster-960.webp"` (`en_US` or `pt_BR`), `srcset` 540w and 960w, `sizes="(min-width: 64rem) 31rem, (min-width: 40rem) 34rem, calc(100vw - 2rem)"`, `width="960" height="960"`, `fetchpriority="high"`, `decoding="async"`, `alt=""`. This is the LCP element.
  - `video.demo-video` `muted loop playsinline preload="none"`, `width="960" height="960"`, `aria-hidden="true"`, with `source` webm then mp4; absolutely positioned over the poster, `opacity: 0` until the script adds `.is-playing` on the `playing` event (220 ms fade), so a slow start never flashes black.
  - `button.demo-toggle` bottom-right inside the stage: 44 px circle, `--color-terminal-bar` at 80% with `--color-terminal-text` icon; hidden until the video plays.
- `ol.demo-steps` under the stage: three pills `DemoStepAsk`, `DemoStepTap`, `DemoStepContinue`, the current one `aria-current="step"` with `--color-success-surface` fill and a `.live-dot`. The script follows `currentTime` (0–5.6 s, 5.6–7.4 s, 7.4–12 s). Without the script or with reduced motion, all three render equal.
- `p.visually-hidden#demo-description` `DemoDescription`.

Playback rules (`site-scripts.ts`):

1. Never before `load`, never when `matchMedia('(prefers-reduced-motion: reduce)')` matches, never when `navigator.connection.saveData` is true.
2. An `IntersectionObserver` (threshold 0.25) plays in view and pauses out of view; the first play sets `preload="auto"` then calls `play()`.
3. A user pause wins until the user presses play again (no storage).
4. A media error leaves the poster; no message.

### 9.2 CSS and SVG micro-animations

All CSS-only, transform and opacity only (no layout property animates, so CLS stays 0). Each runs once unless the row says otherwise.

| Moment | Motion | Timing |
|---|---|---|
| Eyebrow live dot | existing `signal-pulse`, 2 iterations | `--duration-pulse` |
| Headline accent underline | an inline SVG path under "on WhatsApp" (`stroke: var(--color-signal)`, 6 px round cap, a gentle wave) draws via `stroke-dashoffset` from its length to 0 | `--duration-draw`, `--ease-draw`, 300 ms delay |
| Hero arrival | eyebrow, h1, lead, form rise from `translateY(0.75rem)` and `opacity 0`, staggered 60 ms | `--duration-arrive`, `--ease-out` |
| Stage arrival | `scale(0.97)` and `opacity 0` to rest | `--duration-arrive`, `--ease-spring`, 180 ms delay |
| Join and final buttons | existing arrow nudge on hover; existing press | `--duration-base` / `--duration-quick` |
| Section reveal | `@supports (animation-timeline: view())` only: section heads and cards rise 1rem and fade in with `animation-timeline: view(); animation-range: entry 0% cover 25%`; cards in a grid stagger by `animation-range-start` 0 / 4 / 8%. Browsers without support show everything static | scroll-driven |
| Mini chats | the same scroll-driven rule, applied to each bubble in turn (`nth-child` ranges), so a card "receives" its messages as it scrolls in | scroll-driven |
| Typing dots in "You can text first" | existing `bubble-breathe`, 3 iterations | `--duration-breathe` |
| Thank-you burst | eight 0.5rem bubble shapes (`::before`/`::after` on four spans, `aria-hidden`) fly 2.5–4rem out from the success mark at 45° steps and fade | `--duration-burst`, `--ease-out` |
| Invite meter | filled segments grow from `scaleX(0)` with a 60 ms stagger | `--duration-chart`, `--ease-out` |
| Copy button | the copy icon cross-fades to the check | `--duration-base` |
| Notices | existing `notice-arrive` | `--duration-arrive`, `--ease-spring` |
| FAQ chevron | existing rotate | `--duration-base` |

Only the video loop and the reveal-on-scroll exceed 5 s or repeat with scrolling; the video has a pause button, and the reveal is a one-way entry tied to the user's own scroll.

### 9.3 Reduced motion

The backoffice block, verbatim (`animation: none !important; transition: none !important` on everything), plus: the script never plays the video and never shows the toggle; the scroll-driven rules sit inside `@media (prefers-reduced-motion: no-preference)` as well as `@supports`; the underline renders fully drawn (its resting state is drawn, the animation only starts from undrawn); the step pills are all equal. The E2E (`landing-motion.spec.ts`) expects `video.paused === true` and `document.getAnimations()` empty on the hero.

### 9.4 Demo video storyboard (≤ 15 s loop: 12.0 s at 30 fps)

**Canvas** 1080 × 1080, encoded at 960 × 960. Background: `--gradient-stage` colours (`#0D1B17` with the green glow at top right), the same in both page themes. Two cuts, one per locale (owner order 2026-11-12: everything in both languages): the terminal lines, the WhatsApp question, the buttons and the reply are in the page's language; the page chooses the cut by its locale.

**Layout (canvas pixels).**

- Terminal window: x 56, y 104, 648 × 560, radius 20, body `--color-terminal-bar` `#15261F`, title bar 44 px with three 12 px dots (`#1F332D`) and the title `agent — ~/acme-shop` in mono 22 px `#9DB2AA`. Body text mono 26 px, line height 40 px, `#E8F1ED`; prompt `›` and checks `✓` in `#5BE39A`; tool lines in `#9DB2AA`.
- Phone: x 612, y 150, 412 × 860, outer radius 56, bezel 12 px `#0E1F1A` with a 1 px `#1F332D` ring, overlapping the terminal's right edge by 92 px (the "conversation crosses devices" idea). Screen: status row 28 px, header 64 px `#075E54` with the bubble-mark avatar and `zapbip` in white 26 px; wallpaper `#ECE5DD`; bubbles 26 px text, 12 px radius with a tail corner; sender name 20 px `#0B6B60`; button pills full-bubble width, 56 px tall, `#0B6B60` 24 px 600.
- Tap indicator: a 64 px ring, 4 px `#25D366`, with a 20% fill, which scales 1 → 0.85 on press and emits one ripple.

**Shots.**

| # | Time (s) | Terminal | Phone | Notes |
|---|---|---|---|---|
| 1 | 0.0–0.6 | empty prompt `›`, block cursor blinking | wallpaper, empty | equals the last frame (seamless loop) |
| 2 | 0.6–2.0 | types `› run the tests`, then `✓ 128 tests passed` | — | 40 ms per character |
| 3 | 2.0–3.0 | `● zapbip.ask  Deploy v2.4 to production?` then `  options: Ship it · Wait` then a spinner `⠋ waiting for your answer` | — | the call is real (below) |
| 4 | 3.0–3.5 | spinner | the question bubble pops in from `scale(0.9)` with the spring: sender `Claude Code`, text `Tests pass. Deploy v2.4 to production?`, buttons `Ship it` / `Wait` | content from the real screen entry |
| 5 | 3.5–5.6 | spinner, elapsed `0:03` | hold | the poster frame is **t = 4.8 s** |
| 6 | 5.6–6.2 | spinner | the tap ring glides in from the bottom right and presses `Ship it` at 6.0 | |
| 7 | 6.2–6.8 | spinner | your bubble `Ship it` (right, `#D9FDD3`, two ticks) | the reply is real |
| 8 | 6.8–7.4 | spinner resolves to `✓ owner answered: Ship it` | hold | from the real tool result |
| 9 | 7.4–9.4 | `› deploy v2.4` and a 24-cell progress bar filling to 100% | hold | |
| 10 | 9.4–10.2 | `✓ v2.4 is live` | agent bubble `Done. v2.4 is live.` | a real `send_message` |
| 11 | 10.2–11.2 | hold | hold | |
| 12 | 11.2–12.0 | content fades to the empty prompt | bubbles fade to the empty wallpaper | 800 ms, ends on frame 1 |

**How it is produced from the real product** (`apps/api/scripts/record-landing-demo.ts`, a manual run; spec "Demo media"):

1. Start the Worker locally with the fake WhatsApp channel (`wrangler dev`, the development environment), and seed one owner and one connection with the existing development seed (`apps/api/scripts/dev-seed.ts`).
2. Launch Chromium with Playwright: `newContext({ viewport: { width: 1080, height: 1080 }, deviceScaleFactor: 1, colorScheme: 'dark', reducedMotion: 'no-preference', recordVideo: { dir, size: { width: 1080, height: 1080 } } })`, and load the stage page: a static HTML file next to the script (`apps/api/scripts/landing-demo-stage.html` plus its CSS), built from the layout above. The stage is a picture frame; it carries no data of its own.
3. From Node, connect an MCP client (`@modelcontextprotocol/sdk`, Streamable HTTP) to the local MCP endpoint with the seeded connection secret and call the `ask` tool (`McpToolName.Ask`) with the question and the two options. Push the terminal lines into the stage with `page.evaluate`.
4. Poll `GET /dev/owner/<phone>/screen` until the interactive entry appears; render that entry (its text and its options, as returned) into the phone.
5. After the storyboard's hold, animate the tap ring, then `POST /dev/owner/<phone>/messages` with `{ kind: "choice", option_id, title }` for `Ship it`. The pending `ask` call resolves; print its real answer into the terminal.
6. Call `send_message` with `Done. v2.4 is live.`, poll the screen, render the bubble.
7. The test and deploy lines in the terminal are narrative (labelled so in the script); every phone bubble and the answer line come from the Worker.
8. Record wall-clock offsets of shot 1 and shot 12 from context creation; close the context to flush the raw `webm`.

**Encoding** (ffmpeg; `<start>` is the recorded offset of shot 1):

```
ffmpeg -ss <start> -t 12 -i raw.webm -vf "fps=30,scale=960:960:flags=lanczos,format=yuv420p" -c:v libx264 -profile:v high -preset slow -crf 26 -movflags +faststart -an demo-960.mp4
ffmpeg -i demo-960.mp4 -c:v libvpx-vp9 -b:v 0 -crf 36 -row-mt 1 -deadline good -an demo-960.webm
ffmpeg -ss 4.8 -i demo-960.mp4 -frames:v 1 -c:v libwebp -quality 82 demo-poster-960.webp
ffmpeg -ss 4.8 -i demo-960.mp4 -frames:v 1 -vf "scale=540:540:flags=lanczos" -c:v libwebp -quality 80 demo-poster-540.webp
```

**Files and budgets** (`apps/api/site-public/`; spec: each under 2 MB, total under 6 MB):

| File | Size budget |
|---|---|
| `demo-<locale>-960.mp4` (H.264 High, faststart, no audio), per locale | ≤ 1.5 MB |
| `demo-<locale>-960.webm` (VP9, no audio), per locale | ≤ 1.1 MB |
| `demo-<locale>-poster-960.webp` | ≤ 80 KB |
| `demo-<locale>-poster-540.webp` | ≤ 35 KB |
| `og-<locale>.png` | ≤ 300 KB |
| `apple-touch-icon.png` (180 × 180) | ≤ 10 KB |

If Playwright's recorder (VP8 at a fixed bitrate) blurs the 26 px mono text, the fallback keeps the same stage and data: install `page.clock`, step it 33.3 ms at a time after the data is in place, take one `page.screenshot` per step, and encode the PNG sequence with the same ffmpeg arguments (`-framerate 30 -i frame-%04d.png`).

## 10. Performance budget

| Measure | Budget | How it is met |
|---|---|---|
| LCP, mobile (Slow 4G emulation, 375) | < 2.5 s | the poster is the LCP element: `link rel=preload as=image imagesrcset imagesizes fetchpriority=high` in `head`; 540w webp ≤ 35 KB; no web font; one render-blocking stylesheet |
| CLS | 0 (test gate ≤ 0.01) | `width`/`height` and `aspect-ratio` on the poster and video; the Turnstile slot reserves `--size-turnstile`; notices render server-side inside the join block above the form, never injected after load; the join block has a `min-height` below 64rem; animations use transform and opacity only; no font swap |
| HTML | ≤ 20 KB compressed | server-rendered, no inline data |
| CSS | ≤ 14 KB compressed | one file, content-hash URL, `Cache-Control: public, max-age=31536000, immutable` |
| First-party JS | ≤ 4 KB compressed, `defer` | `site-scripts.ts` |
| Turnstile | third-party `async defer`, only when the form renders | not on the critical path |
| Bytes before interaction, excluding Turnstile and the video | ≤ 120 KB | |
| Video | none before `load` and in view; ≤ 1.5 MB once | §9.1 rules |
| Below the fold | no images (illustrations are HTML and inline SVG); nothing to lazy-load except the video | |

## 11. Copy (`site-copy.ts`, keyed by `SiteCopyKey`)

Voice: short sentences, plain words, second person, no jargon above the fold. "Agent" is the word for the AI on the page (the audience is AI enthusiasts); "MCP" appears once above the fold, in the subhead, because enthusiasts look for it. Placeholders use the backoffice `{name}` form.

### 11.1 Header, hero, form

| Key | en_US | pt_BR |
|---|---|---|
| `BrandName` | zapbip | zapbip |
| `BrandHomeLabel` | zapbip home | Início do zapbip |
| `SkipToForm` | Skip to the waitlist form | Ir para o formulário da lista |
| `NavigationDocs` | Docs | Documentação |
| `HeaderJoin` | Join | Entrar |
| `LocaleLabel` | Language | Idioma |
| `LocalePortuguese` / `LocalePortugueseShort` | Português / PT | Português / PT |
| `LocaleEnglish` / `LocaleEnglishShort` | English / EN | English / EN |
| `ThemeLabel` | Theme | Tema |
| `ThemeLight` / `ThemeDark` / `ThemeSystem` | Light / Dark / System | Claro / Escuro / Sistema |
| `HeroEyebrow` | Early access · Waitlist open | Acesso antecipado · Lista aberta |
| `HeroInvited` | A friend invited you | Um amigo te convidou |
| `HeroTitleLead` | Your AI agents text you | Seus agentes de IA falam com você |
| `HeroTitleAccent` | on WhatsApp. | no WhatsApp. |
| `HeroLead` | They ask with buttons, wait for your tap, then keep working. Claude Code, Codex and any MCP agent. | Eles perguntam com botões, esperam seu toque e continuam o trabalho. Claude Code, Codex e qualquer agente MCP. |
| `JoinEmailLabel` | Your email address | Seu e-mail |
| `JoinEmailPlaceholder` | you@example.com | voce@exemplo.com |
| `JoinSubmit` | Join the waitlist | Entrar na lista |
| `JoinSubmitting` | Joining… | Entrando… |
| `JoinNeedsScript` | Turn on JavaScript to join: the check against bots needs it. | Ative o JavaScript para entrar: a verificação contra robôs precisa dele. |
| `PrivacyNoteShort` | We keep your email, language and referral data. No IP address, no tracking cookies. | Guardamos seu e-mail, idioma e dados de indicação. Sem endereço IP, sem cookies de rastreamento. |
| `PrivacyNoteLink` | Privacy | Privacidade |

### 11.2 Notices and errors

| Key | en_US | pt_BR |
|---|---|---|
| `NoticeLabelInfo` / `Success` / `Warning` / `Error` | Information / Success / Warning / Error | Informação / Sucesso / Atenção / Erro |
| `JoinEmailInvalid` | Enter an email like name@example.com. | Digite um e-mail como nome@exemplo.com. |
| `JoinCaptchaFailed` | Please confirm you're not a robot, then try again. | Confirme que você não é um robô e tente de novo. |
| `JoinRateLimited` | Too many tries from your network. Wait a minute and try again. | Muitas tentativas da sua rede. Espere um minuto e tente de novo. |
| `JoinUnavailable` | Joining is paused for a moment. Please try again in a few minutes. | As inscrições pararam por um momento. Tente de novo em alguns minutos. |
| `JoinOffline` | You're offline. Connect and try again. | Você está sem internet. Conecte e tente de novo. |
| `JoinPausedTitle` | The waitlist is paused | A lista está pausada |
| `JoinPausedBody` | We'll reopen it soon. Come back in a little while. | Vamos reabrir em breve. Volte daqui a pouco. |
| `NotFoundTitle` | This page isn't here. | Esta página não existe. |
| `NotFoundHome` | Go to the home page | Ir para o início |

### 11.3 Thank-you

| Key | en_US | pt_BR |
|---|---|---|
| `ThanksTitle` | You're on the list. | Você está na lista. |
| `ThanksBody` | We'll email you when your access is ready. Want it sooner? Share your link: each friend who joins moves you up. | Vamos te avisar por e-mail quando seu acesso estiver pronto. Quer antes? Compartilhe seu link: cada amigo que entrar te faz subir na fila. |
| `ThanksLinkLabel` | Your invite link | Seu link de convite |
| `ThanksCopy` | Copy link | Copiar link |
| `ThanksCopied` | Copied | Copiado |
| `ThanksCopiedAnnouncement` | Link copied | Link copiado |
| `ThanksCopyFallback` | Link selected. Copy it with your keyboard. | Link selecionado. Copie pelo teclado. |
| `ThanksShareWhatsApp` | Share on WhatsApp | Compartilhar no WhatsApp |
| `ThanksShareText` | I'm on the zapbip waitlist: AI agents that text you on WhatsApp. Join with my link: {link} | Entrei na lista do zapbip: agentes de IA que falam com você no WhatsApp. Entre pelo meu link: {link} |
| `ThanksInviteCount` | {count} of {cap} friends invited | {count} de {cap} amigos convidados |
| `ThanksCapReached` | You reached the invite limit. Thank you! | Você chegou ao limite de convites. Valeu! |

### 11.4 Demo

| Key | en_US | pt_BR |
|---|---|---|
| `DemoStepAsk` | Agent asks | O agente pergunta |
| `DemoStepTap` | You tap | Você toca |
| `DemoStepContinue` | It keeps going | Ele continua |
| `DemoPause` | Pause demo | Pausar demonstração |
| `DemoPlay` | Play demo | Reproduzir demonstração |
| `DemoDescription` | A coding agent in a terminal asks "Deploy v2.4 to production?". The question arrives on WhatsApp with two buttons, Ship it and Wait. The owner taps Ship it, and the agent deploys and replies "Done. v2.4 is live." | Um agente de programação no terminal pergunta "Deploy v2.4 to production?". A pergunta chega no WhatsApp com dois botões, Ship it e Wait. O dono toca em Ship it, e o agente faz o deploy e responde "Done. v2.4 is live." |

### 11.5 How it works

| Key | en_US | pt_BR |
|---|---|---|
| `HowEyebrow` | How it works | Como funciona |
| `HowTitle` | Set up once. Then just answer. | Configure uma vez. Depois é só responder. |
| `HowStepConnectTitle` | Connect your agent | Conecte seu agente |
| `HowStepConnectBody` | Message zapbip on WhatsApp, get one line and paste it into your agent. That's the setup. | Mande uma mensagem ao zapbip no WhatsApp, receba uma linha e cole no seu agente. Pronto. |
| `HowStepConnectVisual` | 1 line to paste | 1 linha para colar |
| `HowStepTextTitle` | It texts you | Ele te manda mensagem |
| `HowStepTextBody` | Updates, finished work and questions with buttons land on the phone you already carry. | Avisos, trabalhos prontos e perguntas com botões chegam no celular que já está com você. |
| `HowStepTextVisualQuestion` | Book the 9:40 flight? | Reservo o voo das 9:40? |
| `HowStepTextVisualYes` | Book it | Reservar |
| `HowStepTextVisualNo` | Not yet | Ainda não |
| `HowStepAnswerTitle` | You answer, it keeps going | Você responde, ele continua |
| `HowStepAnswerBody` | Tap a button or type a reply. The agent that asked gets it and picks up where it stopped. | Toque num botão ou escreva. O agente que perguntou recebe e continua de onde parou. |
| `HowStepAnswerVisual` | answer received, continuing | resposta recebida, continuando |

### 11.6 What agents can do

| Key | en_US | pt_BR |
|---|---|---|
| `CapabilitiesEyebrow` | What agents can do | O que os agentes fazem |
| `CapabilitiesTitle` | More than notifications. | Muito além de notificações. |
| `CapabilitiesLead` | Your agent gets a real conversation with you, not a one-way ping. | Seu agente ganha uma conversa de verdade com você, não um aviso de mão única. |
| `CapabilityButtonsTitle` | Ask with buttons | Pergunte com botões |
| `CapabilityButtonsBody` | Yes or no, ship or wait. One tap and the agent has its answer. | Sim ou não, publicar ou esperar. Um toque e o agente tem a resposta. |
| `CapabilityButtonsChatQuestion` | Merge PR #42 into main? | Junto o PR #42 na main? |
| `CapabilityButtonsChatYes` | Merge | Juntar |
| `CapabilityButtonsChatNo` | Not yet | Ainda não |
| `CapabilityListTitle` | Pick from a list | Escolha numa lista |
| `CapabilityListBody` | Up to ten options when buttons are not enough. | Até dez opções quando botões não bastam. |
| `CapabilityListChatQuestion` | Which hotel in Lisbon? | Qual hotel em Lisboa? |
| `CapabilityListChatButton` | See options | Ver opções |
| `CapabilityListChatRows` | Alfama · Baixa · Belém | Alfama · Baixa · Belém |
| `CapabilityMediaTitle` | Files, photos and voice notes | Arquivos, fotos e áudios |
| `CapabilityMediaBody` | Reports, screenshots and audio, both ways. Send a voice note and your agent gets it. | Relatórios, prints e áudios, nos dois sentidos. Mande um áudio e seu agente recebe. |
| `CapabilityMediaChatText` | Your research is ready. | Sua pesquisa ficou pronta. |
| `CapabilityMediaChatFile` | report.pdf | relatorio.pdf |
| `CapabilityWakeTitle` | You can text first | Você também começa a conversa |
| `CapabilityWakeBody` | Write to your agent and it wakes up: in seconds on your computer, or at its next check. | Escreva para o seu agente e ele acorda: em segundos no seu computador, ou na próxima checagem. |
| `CapabilityWakeChatYou` | Did the nightly build pass? | O build da madrugada passou? |
| `CapabilityWakeChatAgent` | Yes, all green. Want the log? | Passou, tudo verde. Quer o log? |
| `CapabilityWakeChatChip` | woke in 7 s | acordou em 7 s |
| `CapabilityRoutingTitle` | Many agents, one chat | Vários agentes, uma conversa |
| `CapabilityRoutingBody` | Claude, Codex and the rest share one number. Your reply goes back to the agent that asked. | Claude, Codex e os outros dividem um número. Sua resposta volta para quem perguntou. |
| `CapabilityRoutingChatFirst` | Claude: Tests pass. | Claude: Testes passaram. |
| `CapabilityRoutingChatSecond` | Codex: Found 3 sources. | Codex: Achei 3 fontes. |
| `CapabilityRoutingChatReply` | Which ones? | Quais? |
| `CapabilityWaitTitle` | Waits as long as it takes | Espera o tempo que for |
| `CapabilityWaitBody` | An agent can wait for your answer for hours. Reply when you're free. | Um agente pode esperar sua resposta por horas. Responda quando puder. |
| `CapabilityWaitChatQuestion` | Send the proposal to the client? | Mando a proposta pro cliente? |
| `CapabilityWaitChatDivider` | 3 hours later | 3 horas depois |
| `CapabilityWaitChatReply` | Send it. | Pode mandar. |

### 11.7 Works with

| Key | en_US | pt_BR |
|---|---|---|
| `ClientsEyebrow` | Works with | Funciona com |
| `ClientsTitle` | The agents you already use. | Os agentes que você já usa. |
| `ClientsWakeSeconds` | wakes in ~{seconds} s | acorda em ~{seconds} s |
| `ClientsHourly` | checks every hour | confere a cada hora |
| `ClientsLocal` | runs on your computer | roda no seu computador |
| `ClientsAnyMcpName` | Any MCP app | Qualquer app MCP |
| `ClientsAnyMcp` | one MCP server, one key | um servidor MCP, uma chave |
| `ClientsFootnote` | Wake times are from our own tests. | Tempos medidos nos nossos testes. |

Client names (Claude Code, Codex, Grok Bot, claude.ai, ChatGPT, Cursor, Gemini CLI) are proper names, identical in both locales; they still live in the copy file as one `ClientName…` key each.

### 11.8 Privacy band

| Key | en_US | pt_BR |
|---|---|---|
| `PrivacyEyebrow` | Privacy | Privacidade |
| `PrivacyTitle` | Official API. Only you. | API oficial. Só você. |
| `PrivacyOfficialTitle` | The official WhatsApp Cloud API | A API oficial do WhatsApp Cloud |
| `PrivacyOfficialBody` | No unofficial apps, no tricks. Messages go through Meta's official platform. | Nada de apps não oficiais ou gambiarras. As mensagens passam pela plataforma oficial da Meta. |
| `PrivacyOnlyYouTitle` | It talks only to you | Fala só com você |
| `PrivacyOnlyYouBody` | zapbip never messages your contacts or anyone else. Your agents, your phone. | O zapbip nunca manda mensagem para seus contatos nem para mais ninguém. Seus agentes, seu celular. |
| `PrivacyKeysTitle` | One key per agent | Uma chave por agente |
| `PrivacyKeysBody` | Each agent has its own secret. Revoke any of them from WhatsApp, anytime. | Cada agente tem o próprio segredo. Revogue qualquer um pelo WhatsApp, quando quiser. |
| `PrivacyWaitlistTitle` | About this waitlist | Sobre esta lista |
| `PrivacyWaitlistBody` | We keep your email, language and referral data only to invite you. We store no IP address and set no tracking cookies; two cookies remember your language and theme. To be removed, write to {contactEmail}. | Guardamos seu e-mail, idioma e dados de indicação só para te convidar. Não guardamos endereço IP nem usamos cookies de rastreamento; dois cookies lembram seu idioma e tema. Para sair da lista, escreva para {contactEmail}. |

`{contactEmail}` is a constant, `SITE_CONTACT_EMAIL = 'dhyego@logicbit.com.br'`, the contact the docs already publish (`apps/docs/snippets/company.mdx`), rendered as a `mailto:` link.

### 11.9 FAQ

| Key | en_US | pt_BR |
|---|---|---|
| `FaqEyebrow` | FAQ | Dúvidas |
| `FaqTitle` | Questions | Perguntas |
| `FaqWhenQuestion` | When can I use it? | Quando posso usar? |
| `FaqWhenAnswer` | We open access in waves. People higher on the list get in first, and each friend you invite moves you up. | Vamos liberar o acesso aos poucos. Quem está mais acima na lista entra antes, e cada amigo que você convida te faz subir. |
| `FaqPriceQuestion` | How much will it cost? | Quanto vai custar? |
| `FaqPriceAnswer` | Pricing comes with the launch. The waitlist hears first. | Os preços saem no lançamento. Quem está na lista fica sabendo primeiro. |
| `FaqDeveloperQuestion` | Do I need to be a developer? | Preciso ser programador? |
| `FaqDeveloperAnswer` | No. If you use ChatGPT, Claude or another AI, you connect it by pasting one line. | Não. Se você usa ChatGPT, Claude ou outra IA, conecta colando uma linha. |
| `FaqOthersQuestion` | Does it message other people? | Ele manda mensagem para outras pessoas? |
| `FaqOthersAnswer` | No. zapbip talks only to you, on your own phone, through the official WhatsApp Cloud API. | Não. O zapbip fala só com você, no seu celular, pela API oficial do WhatsApp Cloud. |
| `FaqManyQuestion` | Can several agents share it? | Vários agentes podem usar juntos? |
| `FaqManyAnswer` | Yes. All your agents share one number, and each reply goes back to the agent that asked. | Sim. Todos os seus agentes dividem um número, e cada resposta volta para o agente que perguntou. |
| `FaqReferralQuestion` | How do invites work? | Como funcionam os convites? |
| `FaqReferralAnswer` | After you join, you get a personal link. Each friend who joins with it moves you up the list. There is a limit per person, shown after you join. | Depois de entrar, você recebe um link pessoal. Cada amigo que entrar por ele te faz subir na lista. Há um limite por pessoa, que aparece depois que você entra. |
| `FaqDataQuestion` | What do you do with my email? | O que vocês fazem com meu e-mail? |
| `FaqDataAnswer` | We use it only to invite you when access opens. No IP address, no tracking cookies. To be removed, write to {contactEmail}. | Usamos só para te convidar quando o acesso abrir. Sem endereço IP, sem cookies de rastreamento. Para sair da lista, escreva para {contactEmail}. |

The FAQ never shows the cap number, so `GET /` needs no database read.

### 11.10 Final call and footer

| Key | en_US | pt_BR |
|---|---|---|
| `FinalTitle` | Let your agents reach you. | Deixe seus agentes falarem com você. |
| `FinalBody` | Join the waitlist. It takes ten seconds. | Entre na lista. Leva dez segundos. |
| `FinalButton` | Join the waitlist | Entrar na lista |
| `FinalButtonInvite` | Invite a friend | Convidar um amigo |
| `FooterMaker` | zapbip is made by Logic Bit in Belo Horizonte, Brazil. | O zapbip é feito pela Logic Bit em Belo Horizonte. |
| `FooterTrademarks` | WhatsApp is a trademark of Meta. Agent names are trademarks of their owners. | WhatsApp é marca da Meta. Os nomes dos agentes são marcas dos seus donos. |

### 11.11 Meta and social

| Key | en_US | pt_BR |
|---|---|---|
| `MetaTitle` | Your AI agents text you on WhatsApp · zapbip | Seus agentes de IA falam com você no WhatsApp · zapbip |
| `MetaDescription` | Claude Code, Codex and any MCP agent text you on WhatsApp, ask with buttons and wait for your answer. Join the waitlist. | Claude Code, Codex e qualquer agente MCP falam com você no WhatsApp, perguntam com botões e esperam sua resposta. Entre na lista. |
| `MetaOgTitle` | zapbip: your AI agents text you on WhatsApp | zapbip: seus agentes de IA falam com você no WhatsApp |
| `MetaOgImageAlt` | An AI agent asks "Deploy v2.4 to production?" on WhatsApp, with Ship it and Wait buttons. | Um agente de IA pergunta "Deploy v2.4 to production?" no WhatsApp, com os botões Ship it e Wait. |
| `NotFoundMetaTitle` | Page not found · zapbip | Página não encontrada · zapbip |

The title joins the page title and the brand with the backoffice `TITLE_SEPARATOR` (`' · '`).

## 12. Head, SEO and the Open Graph image

`head`, in order: `charset`; `viewport`; `title` `MetaTitle`; `meta name=description`; `link rel=canonical href=SITE_ORIGIN + "/"` (test plan); `link rel=alternate hreflang` for `en`, `pt-BR` and `x-default` (the URLs are the routing lane's, from the same constants as the sitemap); `meta name=theme-color` `#F6F8F5` with `media="(prefers-color-scheme: light)"` and `#07120F` for dark; `link rel=icon type=image/svg+xml href=/favicon.svg`; `link rel=apple-touch-icon href=/site/apple-touch-icon.png`; the poster `preload`; the stylesheet; `og:type=website`, `og:site_name=zapbip`, `og:url`, `og:title` `MetaOgTitle`, `og:description` `MetaDescription`, `og:image=SITE_ORIGIN + /site/og.png`, `og:image:width=1200`, `og:image:height=630`, `og:image:type=image/png`, `og:image:alt` `MetaOgImageAlt`, `og:locale` (`en_US` or `pt_BR`) and `og:locale:alternate`; `twitter:card=summary_large_image`, `twitter:title`, `twitter:description`, `twitter:image`, `twitter:image:alt`; `site-scripts` with `defer`; the Turnstile script `async defer`, only when the form renders. The not-found page adds `meta name=robots content=noindex`.

**Open Graph images** `og-en_US.png` and `og-pt_BR.png`, 1200 × 630, PNG, ≤ 300 KB each, chosen by the page locale (headline, tagline and phone in that language):

- Background `#F6F8F5` with the hero's dot pattern and a green glow at x 900, y 120 (the light hero, so it reads in light and dark link previews).
- Left block from x 72, y 96: the bubble mark (64 px) and `zapbip` in rounded 800 at 44 px, `#0E1F1A`; the headline "Your AI agents text you" / "on WhatsApp." at 68 px, 800, line 1.02, tracking −0.035em, the second line in the teal-to-green gradient with the signal underline; under it `zapbip.com · Join the waitlist` at 26 px `#4B5E57`.
- Right block: the phone from the demo (same palette) at 300 × 560, top at y 70, x 830, cropped by the bottom edge, showing the question bubble and its two buttons (`Tests pass. Deploy v2.4 to production?`, `Ship it`, `Wait`).
- Safe area: everything that must read stays 48 px inside every edge; the phone and the mark stay inside the central 630 × 630 square as much as the composition allows, for platforms that crop square.
- Produced like the demo: a static HTML template next to the recording script, screenshotted by Playwright at 1200 × 630, `deviceScaleFactor: 1`, then optimised (`pngquant` or `oxipng` if present on the machine; never added as a dependency).

## 13. Backoffice: the Waitlist page

Reuses the backoffice shell, classes and patterns only; no new token, no client script.

### 13.1 Layout

- `Layout` with `currentPath` `BackofficePath.Waitlist`; `PrimaryNavigation` gains one item after Metrics: `NavigationWaitlist`.
- `div.page-head`: `h1` `WaitlistTitle` and `a.button.button-secondary` `WaitlistExport` to `/waitlist/export.csv` with the `download` attribute.
- `p` `WaitlistIntro`.
- `div.figure-grid` with two `.figure`s: `WaitlistTotalLabel` with the total; `WaitlistCapLabel` with the cap and the `.tile-unit` `WaitlistCapUnit`.
- `div.detail-grid` (5 : 7 from 56rem, the number-detail pattern; the left card sticky):
  - left: `section.card.form-card` `aria-labelledby` its `h2` `WaitlistCapTitle`, `p.field-help` `WaitlistCapHelp`, a `form method=post action=/waitlist/cap` with the CSRF field, a `.field` with `label` `WaitlistCapField`, `p.field-help` `WaitlistCapFieldHelp`, `input type=number name=cap inputmode=numeric min=1 max=100 step=1 required` (value = the current cap; `--measure-code` width), then `CodeField` (the step-up code), then `button.button.button-primary` `WaitlistCapSubmit`;
  - right: the list, `table.data-table` with a visually hidden `caption` `WaitlistTitle`, columns `WaitlistColumnPosition` (#), `WaitlistColumnEmail` (`.mono .cell-truncate`), `WaitlistColumnJoined` (`time`, `formatTimestamp`), `WaitlistColumnCredited` (`.cell-nowrap`, tabular), `WaitlistColumnReferredBy` (the referrer's email, `.mono .cell-truncate`; empty cell when none, which the 375 card layout hides). `data-label` on every `td`.
- Order: credited count descending, then join time ascending (spec), so the position column is the queue.
- At most `WAITLIST_PAGE_ROW_LIMIT = 500` rows render (a constant); above it, an info `Notice` `WaitlistTruncated` with `{limit}` sits above the table, and the CSV carries everyone.

At 375 everything stacks (figures 2 columns, the cap card, then the table as cards: the existing 40rem rules).

### 13.2 States

| State | What shows |
|---|---|
| Empty | figures (total 0); the cap card; in place of the table `section.card.empty-state` with `WaitlistEmptyTitle` (`h2`) and `WaitlistEmptyBody` |
| Some rows | §13.1 |
| Many rows (> 500) | the truncated notice and the first 500 |
| Cap saved | `BackofficeNotice` success `WaitlistCapSaved` after the 303 |
| Cap out of range or not an integer | 303 back with the flash; `422`; the field `aria-invalid` with `p.field-error` `FieldErrorCapRange` (`{min}`, `{max}`), the typed value kept |
| Step-up code refused | the existing `StepUpRejected` notice; `401` |
| Cap row missing | `Notice` error `WaitlistCapMissing` inside the cap card in place of the form; the cap figure shows `—`; the list still renders |
| Export | a file download, no page state; the audit row records it |

### 13.3 CSV

File name `zapbip-waitlist-<YYYY-MM-DD>.csv` (UTC date), `Content-Type: text/csv; charset=utf-8`, `Content-Disposition: attachment`, header row exactly `email,joined_at,credited_referrals,referred_by` in `en_US` and `email,entrou_em,indicacoes_creditadas,indicado_por` in `pt_BR`, by the backoffice locale (test plan), `joined_at` ISO 8601 UTC, `referred_by` the referrer's email (empty when none), every cell quoted, formula cells prefixed with `'` (spec). Same order as the page.

### 13.4 Backoffice copy (`backoffice-copy.ts`)

| Key | en_US | pt_BR |
|---|---|---|
| `NavigationWaitlist` | Waitlist | Lista de espera |
| `WaitlistTitle` | Waitlist | Lista de espera |
| `WaitlistIntro` | People who joined on zapbip.com, in queue order: more credited invites first, then who joined earlier. | Quem entrou pelo zapbip.com, na ordem da fila: mais convites creditados primeiro, depois quem entrou antes. |
| `WaitlistExport` | Export CSV | Exportar CSV |
| `WaitlistTotalLabel` | People on the list | Pessoas na lista |
| `WaitlistCapLabel` | Referral cap | Limite de indicações |
| `WaitlistCapUnit` | friends per person | amigos por pessoa |
| `WaitlistColumnPosition` | # | # |
| `WaitlistColumnEmail` | Email | E-mail |
| `WaitlistColumnJoined` | Joined | Entrou em |
| `WaitlistColumnCredited` | Credited invites | Convites creditados |
| `WaitlistColumnReferredBy` | Invited by | Convite de |
| `WaitlistEmptyTitle` | No one on the list yet | Ninguém na lista ainda |
| `WaitlistEmptyBody` | Sign-ups from zapbip.com show up here. | As inscrições do zapbip.com aparecem aqui. |
| `WaitlistTruncated` | Showing the first {limit} people. Export the CSV to see everyone. | Mostrando as primeiras {limit} pessoas. Exporte o CSV para ver todas. |
| `WaitlistCapTitle` | Referral cap | Limite de indicações |
| `WaitlistCapHelp` | How many friends each person can be credited for. The next join uses the new value, with no deploy. | Quantos amigos cada pessoa pode ter creditados. A próxima inscrição já usa o novo valor, sem deploy. |
| `WaitlistCapField` | Friends per person | Amigos por pessoa |
| `WaitlistCapFieldHelp` | A whole number from {min} to {max}. | Um número inteiro de {min} a {max}. |
| `WaitlistCapSubmit` | Save cap | Salvar limite |
| `WaitlistCapSaved` | Referral cap saved. It applies to the next join. | Limite salvo. Vale a partir da próxima inscrição. |
| `FieldErrorCapRange` | Enter a whole number from {min} to {max}. | Digite um número inteiro de {min} a {max}. |
| `WaitlistCapMissing` | The referral cap setting is missing, so joins are paused. Apply the migrations, then reload. | A configuração do limite de indicações não existe, então as inscrições estão pausadas. Aplique as migrações e recarregue. |
| `AuditActionWaitlistExported` | Waitlist exported | Lista de espera exportada |
| `AuditActionReferralCapChanged` | Referral cap changed | Limite de indicações alterado |

`{min}` and `{max}` come from `WAITLIST_REFERRAL_CAP_MIN` and `WAITLIST_REFERRAL_CAP_MAX`.

## 14. Hand-off notes for the developer

- The mockup (`mockups/landing.html`) is a picture, not code to port: its CSS uses the token names of §6 so values can be read off it, but the product stylesheet follows the backoffice file's structure and the policy of §1 (no inline style, no inline script; the mockup has both, being a document).
- `GET /` does no database read in any state (the cap shows only after a join).
- One record keyed by the page state renders the join block (§7), matching "one handler per request kind".
- Numbers that appear in copy (`7`, `6`, `9`, `16` seconds, `10` list options, `500` rows) are values in `site-copy.ts` or named constants, never literals in views.
- `GET /join` (a reload after Back, a bookmark) answers `303` to `/` keeping `ref`; the thank-you is only the answer to the POST.

## 15. Mockups and screenshots

`docs/features/waitlist-landing/mockups/landing.html` renders every page state from its URL hash (`#idle`, `#invited`, `#invalid`, `#captcha`, `#paused`, `#joined`, `#cap`) and the theme from `?theme=dark`. It shows the poster frame (t = 4.8 s) of the demo as static HTML, which is also the layout reference for the recording stage. At 375 the mockup measured `scrollWidth` 375 (no horizontal scroll). Screenshots, taken with Playwright MCP on 2026-11-12, in the owner's checkout (git-ignored, the ui-polish convention): `/Users/dhyegocalota/Projects/zapbip/zapbip/.pr-media/waitlist-landing/design/`:

| File | Width | State |
|---|---|---|
| `hero-1440-light.png` | 1440 × 900 | idle, en_US, light |
| `hero-1440-dark.png` | 1440 × 900 | idle, en_US, dark |
| `hero-1280x720-light.png` | 1280 × 720 | idle, the first-fold test viewport |
| `hero-768-light.png` | 768 × 1024 | idle |
| `hero-375-light.png` | 375 × 812 | idle |
| `hero-375-joined.png` | 375 × 812 | joined, 2 of 5 |
| `joined-1440-light.png` | 1440 × 900 | joined |
| `page-1440-full.png` | 1440, full page | every section |
| `page-375-full.png` | 375, full page | every section |

## 16. Owner decisions

All taken by the designer under the owner's delegation; the lead may overturn any of them before G3 starts.

| Decision | Choice | Alternatives considered | Date |
|---|---|---|---|
| Visual direction | "Signal, amplified": light first, huge rounded headline, one dark product stage, bubble tails, one dark privacy band (§2) | dark-first page; centered hero with the demo below | owner delegated 2026-11-12 |
| Section order | hero, how it works, what agents can do, works with, privacy band, FAQ, final call (§3) | the brief's order with a logo strip under the hero (no logos we may use) | owner delegated 2026-11-12 |
| Headline | "Your AI agents text you on WhatsApp." / "Seus agentes de IA falam com você no WhatsApp." | "Your AI agents, on your WhatsApp." (no verb, says less); "Your agents text you. You tap. They keep going." (no WhatsApp, the channel is the point) | owner delegated 2026-11-12 |
| Hero layout | two columns from 64rem, demo right; stacked below with the demo peeking under the form | centered single column | owner delegated 2026-11-12 |
| Demo | one 12 s muted loop, 960 × 960, in a dark stage, poster as LCP, pause button, step captions localized on the page | autoplay before load; a GIF; per-language cuts | owner delegated 2026-11-12 |
| Turnstile placement | managed widget, `appearance: always`, in a reserved 65 px slot under the field row | `interaction-only` (shifts the layout when it appears); execute on submit (late shift, slower Join) | owner delegated 2026-11-12 |
| Share | Copy link + Share on WhatsApp (`wa.me` link, works with no script) | the Web Share API only; X and email buttons | owner delegated 2026-11-12 |
| Referral landing | a neutral "A friend invited you" in the eyebrow slot, shown for any shape-valid code | promising the friend credit (false past the cap or for an unknown code) | owner delegated 2026-11-12 |
| Theme switch place | footer | header (does not fit one row at 375) | owner delegated 2026-11-12 |
| Client logos | names as text, no logos | third-party logo files (licensing, `img-src`) | owner delegated 2026-11-12 |
| Deletion contact | `dhyego@logicbit.com.br`, the contact the docs already publish | a new `privacy@zapbip.com` (needs email routing, an owner step) | owner delegated 2026-11-12 |
| OG image | one English 1200 × 630 PNG | per-locale images (follow-up) | owner delegated 2026-11-12 |
| New tokens | §6.2 | none (the terminal and phone palettes cannot be expressed with the existing set) | owner delegated 2026-11-12 |
| Backoffice list cap | 500 rows on the page, CSV for all | pagination (more routes, no need at launch) | owner delegated 2026-11-12 |
