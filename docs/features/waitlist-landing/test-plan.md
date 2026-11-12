# Test plan: Waitlist landing page

Every checkbox states the input and the exact expected outcome. A ticked box carries evidence after ` — evidence: ` (commit hash, log path, counts, screenshot path).

Walk servers: the public site runs on `http://site.localhost:8787` in development. Staging is `https://staging.zapbip.com`. Production is `https://zapbip.com`; the production checks are the owner's smoke, run by the tester only against the staging host and against production after the owner's steps.

## The failing test first

- [ ] `apps/api/src/site/join-waitlist.test.ts::joins a new email and returns Joined` — input: `email: "Maria@Example.com "`, locale `pt_BR`, no referral code, valid Turnstile result; expected: `Joined`, one row with `email = "maria@example.com"`, `credited = 0`, `referred_by = null`.
- [ ] `apps/api/src/site/host-dispatch.test.ts::sends www to the apex with a 301` — input: `GET https://www.zapbip.com/pricing?x=1`; expected: `301`, `Location: https://zapbip.com/pricing?x=1`.
- [ ] `apps/api/src/backoffice/waitlist/waitlist-csv.test.ts::neutralises a formula cell` — input: a row with email `=HYPERLINK("x")`; expected: the cell is `"'=HYPERLINK(""x"")"`, quoted, never starting with `=` unquoted.
- [ ] Confirmed it fails for the right reason: `Cannot find module './join-waitlist'` and `Cannot find module './waitlist-csv'`, not a broken assertion. — evidence: <red run log path and commit hash, to be recorded by the developer>

## Unit (Vitest)

- [ ] `apps/api/src/site/referral-code.test.ts::creates 12 characters from the base32 alphabet` — input: one call; expected: length `12`, every character in the alphabet, no `0`, `1`, `O`, `I`, `L`, `U`.
- [ ] `referral-code.test.ts::two calls differ` — input: two calls; expected: the two strings are not equal across 1000 calls (no duplicates).
- [ ] `apps/api/src/site/turnstile.test.ts::accepts success with matching hostname and action` — input: siteverify body `{success: true, hostname: "zapbip.com", action: "waitlist-join"}`, expected host `zapbip.com`; expected `true`.
- [ ] `turnstile.test.ts::refuses a wrong hostname` — input: `hostname: "evil.example"`; expected `false`.
- [ ] `turnstile.test.ts::refuses a wrong action` — input: `action: "login"`; expected `false`.
- [ ] `turnstile.test.ts::refuses success false` — input: `success: false, error-codes: ["invalid-input-response"]`; expected `false`, and the log line does not contain the token.
- [ ] Edge: timeout — input: fetch rejects after the timeout; expected `false`, no exception escapes.
- [ ] Edge: non-2xx — input: HTTP 500 with a body; expected `false`.
- [ ] Edge: malformed body — input: body `not json`; expected `false`.
- [ ] Edge: empty token — input: `token: ""`; expected `false` and no fetch is made.
- [ ] `apps/api/src/site/join-waitlist.test.ts::duplicate email returns AlreadyJoined and writes nothing` — input: the same email twice, second with a different locale and a referral code; expected: `AlreadyJoined`, one row, the stored locale unchanged, `referred_by` unchanged, the referrer's credited count unchanged.
- [ ] `join-waitlist.test.ts::credits the referrer under the cap` — input: referrer with 0 credited, cap `5`, new email with that referral code; expected `Joined`, the new row `credited = 1`, `referred_by` set to the referrer code.
- [ ] `join-waitlist.test.ts::the cap is read from the settings row` — input: cap set to `2` in `site_settings`, referrer with 2 credited; expected `Joined`, new row `credited = 0`.
- [ ] `join-waitlist.test.ts::past the cap still joins uncredited` — input: referrer with 5 credited and cap `5`, new email with the code; expected `Joined`, `credited = 0`, `referred_by` still set.
- [ ] `join-waitlist.test.ts::self-referral never credits` — input: the referral code of the row `owner@example.com`, then a join with `Owner@example.com ` (normalises to the same email); expected `AlreadyJoined`, no write, the referrer's credited count unchanged. A self-referral is always a duplicate email, so the insert never runs; this case pins that.
- [ ] `join-waitlist.test.ts::the credit check refuses a referrer whose email equals the new email` — input: a direct call of the credit statement for a referrer and an email that match after normalisation; expected `credited = 0`. This pins the defensive clause in the insert, which the duplicate path normally hides.
- [ ] `join-waitlist.test.ts::unknown referral code joins uncredited` — input: code `abcdefgh2345` that is not in the table; expected `Joined`, `credited = 0`, `referred_by = null`.
- [ ] `join-waitlist.test.ts::malformed referral code is ignored` — input: code `"../../x"`; expected `Joined`, `credited = 0`, `referred_by = null`.
- [ ] `join-waitlist.test.ts::invalid email is refused before any write` — input: `"not-an-email"`, `""`, a 255 character string; expected `InvalidEmail`, no row, no Turnstile call made.
- [ ] `join-waitlist.test.ts::referral code clash is retried` — input: a generator that returns a taken code once then a fresh one; expected `Joined` with the fresh code.
- [ ] `join-waitlist.test.ts::a third clash fails closed` — input: a generator that always returns a taken code; expected `Unavailable`, no row.
- [ ] `apps/api/src/site/site-settings.test.ts::readReferralCap throws when the row is missing` — input: empty `site_settings`; expected a thrown error naming `waitlist_referral_cap`.
- [ ] `site-settings.test.ts::writeReferralCap refuses 0 and 101` — input: `0`, then `101`; expected a thrown range error, the stored value unchanged.
- [ ] `site-settings.test.ts::writeReferralCap accepts 1 and 100` — input: `1`, then `100`; expected the read returns the same integer.
- [ ] `apps/api/migrations` seed test — input: the migration file text; expected the seed value equals `DEFAULT_WAITLIST_REFERRAL_CAP` (`5`).
- [ ] `apps/api/src/site/site-policy.test.ts::pins the content security policy` — input: the constant; expected the exact string from ADR 0041 decision 4, with `script-src 'self' https://challenges.cloudflare.com` and no `unsafe-inline`.
- [ ] `apps/api/src/site/robots-and-sitemap.test.ts::robots.txt points at the sitemap` — input: origin `https://zapbip.com`; expected the sitemap line `Sitemap: https://zapbip.com/sitemap.xml`, `Allow: /`.
- [ ] `robots-and-sitemap.test.ts::sitemap lists both locales` — input: origin `https://zapbip.com`; expected one `<loc>` per canonical URL built from the constants, both `pt_BR` and `en_US` alternates.
- [ ] `apps/api/src/site/site-copy.test.ts::every copy key exists in both locales` — input: `SiteCopyKey` values; expected no missing key in `pt_BR` or `en_US`, no empty string.
- [ ] `apps/api/src/backoffice/waitlist/waitlist-csv.test.ts::quotes every cell and escapes quotes` — input: an email with a comma and a quote; expected the cell is double-quoted and the quote doubled.
- [ ] `waitlist-csv.test.ts::header row order` — input: zero rows; expected exactly `email,joined_at,credited_referrals,referred_by` and a line break in `en_US`, and `email,entrou_em,indicacoes_creditadas,indicado_por` in `pt_BR`.
- [ ] `waitlist-csv.test.ts::prefixes +, -, @ too` — input: emails starting with `+`, `-`, `@`; expected each cell starts with `'` inside the quotes.
- [ ] `apps/api/src/backoffice/waitlist/referral-cap-settings.test.ts::rejects a non-integer cap` — input: `"5.5"`, `"five"`, `""`; expected a validation error with the field name, the stored value unchanged.
- [ ] `apps/api/src/backoffice/backoffice-paths.test.ts::Waitlist paths are sign-in protected` — input: `/waitlist`, `/waitlist/export.csv`, `/waitlist/cap`; expected each is in `PROTECTED_PATHS` or guarded by `requireSession`; the POST is in `FORM_PATHS` (CSRF).
- [ ] `apps/api/src/backoffice/waitlist/waitlist-queries.test.ts::orders by credited count then join time` — input: three rows, credited `2`, `2`, `0`, joined in that order; expected the order is the two credited rows by join time ascending, then the uncredited.

## Integration (`@cloudflare/vitest-pool-workers`, D1)

- [ ] Migration `0010` applies on an empty database and on a database at `0009` — input: the migrations directory; expected both tables exist, the seed row is `5`, the unique index on `email` and `referral_code` exists.
- [ ] The join is one D1 batch — input: a join with a referral code; expected a single batch call and no partial row when the second statement fails (the test forces the failure).
- [ ] Concurrency: cap race — input: referrer with `cap - 1` credited rows, and 2 signups fired with `Promise.all` using the same referral code; expected exactly one credited row, the other `credited = 0`, the count is `cap`.
- [ ] Concurrency: duplicate email race — input: 2 identical emails fired with `Promise.all`; expected one row and two responses, both `Joined` or one `Joined` and one `AlreadyJoined`, never two rows.

## E2E (Playwright specs in `apps/api/e2e`)

- [ ] `landing-first-fold.spec.ts::above the fold in en_US` — steps: open `/` with `Accept-Language: en-US`; expected: the headline, subhead, email field, Join button and the poster are visible at 1280 px and 375 px without scrolling, and the strings equal the `en_US` copy keys.
- [ ] `landing-first-fold.spec.ts::above the fold in pt_BR` — steps: open `/` with `Accept-Language: pt-BR`; expected the same elements with the `pt_BR` strings and `lang="pt-BR"`.
- [ ] `landing-first-fold.spec.ts::the switcher changes the language and keeps the referral code` — steps: open `/?ref=abcdefgh2345`, switch to the other language; expected the URL keeps `ref=abcdefgh2345`, the page language changes, the hidden referral field value is unchanged.
- [ ] `landing-join.spec.ts::join with the test widget` — steps: enter `maria@example.com`, pass the always-pass test widget, press Join; expected the thank-you state, the referral link `https://…/?ref=<12 chars>`, and the text "0 of 5 friends invited".
- [ ] `landing-join.spec.ts::missing secret shows the unavailable notice` — steps: run with `TURNSTILE_SECRET_KEY` empty (staging-like config); expected the form is replaced by the unavailable notice, no Join button, the page renders with status 200.
- [ ] `landing-join.spec.ts::whitespace-only secret is missing` — steps: secret value `"   "`; expected the same as the missing case.
- [ ] `landing-join.spec.ts::failing widget shows the captcha notice` — steps: force the always-fail test key; press Join; expected "Please confirm you are not a robot", the widget resets, no row written.
- [ ] `landing-join.spec.ts::duplicate email` — steps: join with `maria@example.com`, then again with the same email from a fresh browser context; expected the same thank-you markup both times, one row in D1.
- [ ] `landing-join.spec.ts::referral credit up to the cap` — steps: referrer joins, then 5 friends join with the referrer's link; expected the referrer's thank-you state shows "5 of 5 friends invited" after the fifth, and the sixth friend joins with "credited = 0".
- [ ] `landing-join.spec.ts::self-referral` — steps: referrer joins, then joins again with the referrer's own link using the same email; expected the same thank-you state as a duplicate, referrer credited count unchanged.
- [ ] `landing-cap.spec.ts::cap edited in the backoffice applies with no deploy` — steps: owner signs in, sets the cap to `2` on the Waitlist page with a step-up code; a referrer with 0 credited gets 2 credited friends and the third is uncredited; expected the page says "2 of 2 friends invited" and the third friend's row has `credited = 0`, without redeploying the Worker.
- [ ] `landing-cap.spec.ts::cap change without a step-up code is refused` — steps: submit the cap form without the code; expected a refusal notice, the cap unchanged, one failed audit row.
- [ ] `landing-redirect.spec.ts::www redirects to the apex with path and query` — steps: request `https://www.zapbip.com/?ref=abc`; expected `301`, `Location: https://zapbip.com/?ref=abc`, no body from MCP.
- [ ] `landing-redirect.spec.ts::staging host serves the site` — steps: request `https://staging.zapbip.com/`; expected `200` with the site title and no MCP JSON.
- [ ] `landing-seo.spec.ts::robots, sitemap, canonical, Open Graph` — steps: fetch `/robots.txt`, `/sitemap.xml`, and the `/` head; expected `robots.txt` lists the sitemap, the sitemap returns `200` with both locales, the head has `<link rel="canonical" href="https://zapbip.com/">`, `og:image` is `og-en_US.png` (and `og-pt_BR.png` for a `pt-BR` browser, with the Portuguese demo, poster and `data-language="pt-br"`) and returns `200` as `image/png` with width 1200 and height 630, the `twitter:card` is `summary_large_image`, and the favicon returns `200`.
- [ ] `landing-motion.spec.ts::reduced motion shows the poster` — steps: emulate `prefers-reduced-motion: reduce`; expected the video element is not playing (`paused` is `true`), the poster is visible, and no CSS animation runs on the hero (`getAnimations()` is empty).
- [ ] `landing-motion.spec.ts::default motion plays the muted loop` — steps: no emulation; expected the video is `muted`, `loop`, and `playsinline`, and plays after the hero is in view.
- [ ] `landing-layout.spec.ts::no layout shift on load` — steps: measure cumulative layout shift from load to 3 s with lazy sections in view; expected CLS `<= 0.01`.
- [ ] `landing-layout.spec.ts::no horizontal scroll at 375 px` — steps: viewport 375 px wide; expected `document.documentElement.scrollWidth <= 375` on every section.
- [ ] `landing-layout.spec.ts::16 px side gutter at 375 px` — steps: viewport 375 px; expected the hero text left edge is at 16 px from the viewport edge.
- [ ] `landing-performance.spec.ts::LCP under 2.5 s on mobile` — steps: a mobile emulation with a throttled network profile; expected LCP `< 2500` ms, the poster is the LCP element, the video and the below-the-fold images have `loading="lazy"` or `preload="none"`.

## Prove it for real — Playwright MCP

- [ ] Happy path, entry to exit, en_US: open `/` at 1280 px; read the above-the-fold text; enter an email; pass the test widget; press Join; expected the thank-you state with the link and "0 of 5 friends invited" — evidence: <screenshot path>.
- [ ] Happy path, referral, pt_BR: open `/?ref=<code from the first walk>`; join; expected the hidden field carries the code, the referrer's count moves to "1 of 5" when checked in the backoffice — evidence: <screenshot path>.
- [ ] Empty: open `/` with the cookie cleared and no `Accept-Language`; expected the default locale copy and the empty email field with no error message before submit.
- [ ] Single: one join; expected the backoffice Waitlist shows total `1`.
- [ ] Many: 25 joins through the walk script (test widget); expected the backoffice total `25`, the list paginates or scrolls, and the order is credited first.
- [ ] Rejected input: `not-an-email`; expected the field error, the typed value kept, no thank-you state, no row.
- [ ] Browser Back mid-flow: press Join, then Back on the thank-you state; expected the form is not resubmitted and the browser shows the page without a second row.
- [ ] Reload mid-flow: reload the thank-you state; expected the page renders the same thank-you state from the URL or shows the form again with no second row.
- [ ] Two authors in two browser contexts at once: two referrers each sharing the same friend link; expected the friend is credited to one referrer only, the other's count unchanged.
- [ ] Latency: throttle the network to slow 3G and press Join; expected the button shows a pending state and then the thank-you state; no double submit.
- [ ] Disconnect: go offline on Join; expected the unavailable notice, no row, and the form is usable again when online.
- [ ] Console and network clean: zero console errors, zero failed requests, other than the test widget's own expected messages on the test keys.
- [ ] Desktop width 1280 px: expected the hero is two columns with the demo on the right, the sections are full width within the max width.
- [ ] Narrow width 375 px: expected the hero stacks, the demo poster is full width, the field and button are full width, no horizontal scroll.
- [ ] Dark theme and light theme: switch the theme; expected both render, contrast is AA in both (checked with the contrast test).
- [ ] Screenshots at `.pr-media/waitlist-landing/` for 1280 px and 375 px in both locales; video at `.pr-media/waitlist-landing/walk.mp4`.

## Edge cases found during execution

Empty on purpose. The tester adds one checkbox per new case (input, exact expected outcome) and a regression test for each.

## Adversarial review

The reviewer picks the three claims most likely to be wrong and tries to refute each.

- [ ] Claim 1: a duplicate email response reveals nothing new beyond the row's own count — attack: join with a known email from a second context and compare the markup and timing to a new join; result: <refuted | held>.
- [ ] Claim 2: the cap cannot be exceeded under concurrency — attack: 20 concurrent joins for one referrer at cap minus one with the same code; result: <refuted | held>.
- [ ] Claim 3: the site page renders with status 200 when the Turnstile secret is missing, and no join is written — attack: the missing and whitespace secret walks plus a direct POST with a forged token; result: <refuted | held>.

## Coverage honesty

What is not tested and why.

- Real Turnstile production verification — the test keys always pass or always fail; the production smoke with one invalid token is the owner's check, and the test keys cannot prove the production hostname check. The risk accepted: a misconfigured production widget would show up only in that smoke.
- Email delivery — no provider in v1; nothing is sent, so nothing is tested.
- Alias addresses for self-referral (plus tags, dots) — not detected; the cap bounds the damage; no test asserts a refusal.
- Real network performance on a phone — LCP is measured with emulation, not a real device; the risk is a slower first paint on a weak connection.
- Backoffice CSV at more than a few thousand rows — tested at 25 rows and a 5000-row unit fixture; no load test; the list is a single D1 query.
- Legal copy — the privacy note is reviewed by the owner, not by a lawyer; the tests check presence and language, not legal adequacy.
- Staging Turnstile widget — staging uses published test keys until the owner creates one; the staging smoke proves the wiring, not the widget.
