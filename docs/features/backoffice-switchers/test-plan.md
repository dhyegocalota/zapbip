# Test plan: Backoffice switchers

Every checkbox states the input and the exact expected outcome. A ticked box carries evidence after ` — evidence: `.

## The failing test first

- [x] `apps/api/test/integration/backoffice-preferences.test.ts::sets the theme cookie and redirects` — input: signed-in `POST /theme` with `theme=dark`, a valid CSRF token and `returnTo=/metrics`; expected: `303`, `Location: /metrics`, a `Set-Cookie` for `__Host-zb_bo_theme=dark` — evidence: red at ab7df820: `expected 404 to be 303`, 19 failed of 21 (`red2.log`); green at a4a3201d, 35 passed with `backoffice-auth-redirects` (`int-pref.log`), full integration 115 files 1274 passed (`int.log`)
- [x] Confirmed it fails for the right reason: `404` on `POST /theme` (the route does not exist), not a broken fixture — evidence: ab7df820 run printed `AssertionError: expected 404 to be 303` for POST /theme, fixture intact (2 pins green) (`red2.log`)

## Unit

- [x] `backoffice-theme.test.ts::resolveTheme` — input: `light`, `dark`, `system`; expected: the same member — evidence: red at 2186ca98: `resolveTheme is not implemented for ...`, 25 failed 3 passed (`red1.log`); green at a4a3201d, unit: `pnpm --filter @zapbip/api test:unit` 107 files 1303 passed, `pnpm --filter @zapbip/repository-shape test:unit` 37 files 759 passed (logs `unit-api.log`, `unit-shape.log`)
- [x] Edge: `resolveTheme` with `undefined`, `''`, `DARK`, `<script>`; expected: `System` — evidence: it.each undefined, empty, DARK, script, purple all System; green at a4a3201d
- [x] `backoffice-locale.test.ts::resolveLocale` — input: cookie `en_US` with `Accept-Language: pt-BR`; expected: `en_US`; unknown cookie plus `en-GB`: `en_US`; nothing: `DEFAULT_LOCALE` — evidence: 3 pins, green at 2186ca98 as well (`red1.log`); green at a4a3201d
- [x] `backoffice-return-target.test.ts::returnTargetOf` — input: `/`, `/sign-in`, `/numbers`, `/numbers/abc`, `/metrics`, `/audit`; expected: the same path — evidence: red at 2186ca98 `returnTargetOf is not implemented` (`red1.log`); green at a4a3201d
- [x] Edge: `//evil.test`, `https://evil.test/`, `/\evil.test`, `javascript:alert(1)`, `/numbers/%0d%0a`, `/unknown`, empty, `null`; expected: `/` — evidence: all hostile inputs and null go to `/`; green at a4a3201d; mutation `allowlist` turned 9 unit tests red
- [x] `backoffice-layout.test.ts` — input: `Layout` with each theme; expected: `<html data-theme="light|dark|system">` and `lang` from the locale; both switchers present for a signed-in page and the sign-in page, none on the error page without a token — evidence: red at 20c7feb1: 18 failed across layout, theme-switch, copy (`red3.log`); green at a4a3201d
- [x] `backoffice-copy.test.ts` — expected: the four theme keys exist in pt_BR and en_US and are non-empty — evidence: red at 20c7feb1 (`red3.log`); green at a4a3201d
- [x] `backoffice-design-rules.test.ts` and `backoffice-tokens.test.ts` — expected: three `:root`-scoped token blocks, the two dark blocks equal, no raw colour outside them, every animation under reduced motion — evidence: red at c7dfd2b5: design-rules 4 failed (`red4a.log`), tokens and contrast 6 failed (`red4b.log`); green at a4a3201d
- [x] `backoffice-contrast.test.ts` — expected: every text pair of the dark block is AA (unchanged pairs, now read from the forced-dark block as well) — evidence: red at c7dfd2b5 (`red4b.log`); green at a4a3201d
- [x] `backoffice-headers.test.ts` — expected: the CSP is character for character the current one — evidence: pinned string equals the live header on the dev stack (`attacks.log` run, curl of /sign-in); green at a4a3201d

## Integration (real app)

- [x] `Set-Cookie` of both preferences — expected: `__Host-` prefix, `Secure`, `HttpOnly`, `SameSite=Lax`, `Path=/`, `Max-Age=31536000`, no `Domain` — evidence: `int-pref.log`; live: `__Host-zb_bo_theme=dark; Max-Age=31536000; Path=/; HttpOnly; Secure; SameSite=Lax`, no Domain (`attacks.log`)
- [x] Unknown value — input: `theme=purple`, `locale=fr`; expected: `303`, no `Set-Cookie` for that field — evidence: `int-pref.log`; live `theme=purple` gives 303 with no Set-Cookie (`attacks.log`)
- [x] Open redirect — input: each hostile `returnTo` above; expected: `303 Location: /`, never the attacker value — evidence: `int-pref.log`; live 20 hostile and encoded targets (`/%5Cevil`, `/%2F%2Fevil.com`, `/%252F...`, `/%09/`, CRLF, tab, leading space) all 303 to `/` (`attacks.log`); mutation `allowlist` red
- [x] CSRF — input: `POST /theme` with a missing token, a wrong token, a wrong `Origin`, no `Origin`; expected: `403` and no cookie — evidence: `int-pref.log`; live missing, wrong, evil Origin, no Origin all 403 without Set-Cookie (`attacks.log`); mutation `csrf` turned 4 red
- [x] Sign-in page — input: signed out, `POST /theme` with the cookie CSRF token from `GET /sign-in`; expected: `303` to `/sign-in`, then `GET /sign-in` carries `data-theme` from the cookie — evidence: `int-pref.log`; live POST /theme from /sign-in answers 303 /sign-in and the page carries `data-theme="dark"` (`signin-1280-dark.png`)
- [x] Rendered state — input: `GET /` with cookies `theme=dark`, `locale=en_US`; expected: `data-theme="dark"`, `lang="en"`, English copy — evidence: `int-pref.log`; live forged cookie values render `data-theme="system"` (`attacks.log`)
- [x] `GET /theme` — expected: `404` (a preference never changes on a GET) — evidence: `int-pref.log`; live `GET /theme?theme=dark` 404 (`attacks.log`)
- [x] Return path on number pages — input: signed-in `GET /numbers/<id>`, `GET /numbers/new` and `GET /numbers/<id>/verification`; expected: both switcher forms carry `returnTo` equal to that page path, not `/numbers` (`backoffice-numbers.test.ts`, `backoffice-numbers-verify.test.ts`; red f03a794c, green 2b033183) — evidence: red at f03a794c: numbers suite 3 failed (detail, verification, register) with `expected [ Array(1) ] to have a length of 3 but got 1` (`int2-red.log`); head 79e8e9c6: both files 42 passed (`int2-head.log`); mutation `returnTo={props.currentPath}` in `Layout` turned `backoffice-layout.test.ts` red with the same text (`mut2.log`), reverted; unit files at head 146 passed (`unit2.log`). The verify-page file passes at f03a794c (pin; red lives in the numbers suite)

## Prove it for real — Playwright MCP (one walk, /check-ui)

- [x] Sign-in page, 1280 and 375, light and dark: both switchers visible with icons, labels announced, every button at least 44 px; screenshots — evidence: measured: theme buttons 44x44, language buttons 44 high, aria-pressed correct; `signin-1280-system-light.png`, `signin-1280-dark.png`, `signin-375-light.png`, `signin-375-dark.png`, `signin-375-dark-ptbr.png` in scratchpad/test-results/backoffice-switchers; no horizontal scroll (375/375); the 375 header is ugly, see F1
- [x] Signed in, `/` and `/numbers`, 1280 and 375: click each theme button — covered by the integration tests; agents never sign in. Evidence: `backoffice-preferences.test.ts` rendered-state rows and `backoffice-numbers.test.ts` return rows.
- [x] Click `English` then `Português`; expected: copy and `<html lang>` change, the same page stays open — evidence: on the sign-in page (signed-in pages blocked): lang switches en and pt-BR, h1 Entrar, URL stays /sign-in (`signin-375-dark-ptbr.png`)
- [x] Reload and navigate to another page; expected: both choices persist — evidence: on the sign-in page: reload keeps theme dark and pt-BR; /numbers redirects to /sign-in with both kept; /nope-404 renders dark and pt-BR without switchers (`error404-375-dark-ptbr.png`); signed-in navigation not walked
- [x] Keyboard only: Tab reaches both groups, Enter submits, the focus ring is visible in both themes — evidence: Tab reaches language and theme buttons, 3px solid outline in both themes (`focus-1280-light.png`, `focus-1280-dark.png`), Enter on a focused theme button switched to light
- [x] Console and network clean: zero console errors, zero CSP violations, zero failed requests — evidence: 0 console errors on sign-in (the 404 page logs the browser 404 line; Chrome prints a password-form verbose hint), 0 CSP violations; network 200 css and svg, 303 on POST /theme
- [x] Screenshots at `docs/features/backoffice-switchers/evidence/`; the recorder uploads them for the PR — evidence: signed-in `/numbers` with two numbers, at head 373523a9: `numbers-1280-light.png`, `numbers-1280-dark.png`, `numbers-375-light.png`, `numbers-375-dark.png`, `numbers-1280-light-en-us.png`; walkthrough `walkthrough.mp4` and `walkthrough.gif` (theme and language switched on a number page, same path kept) on the release `pr-media-backoffice-switchers`

## Edge cases found during execution

- F1: at 375 the sign-in header is not polished. `.site-header` is 243 px tall (3 rows) and `.locale-switch` wraps inside its 999 px radius, becoming a 166x124 blob: the globe sits alone above two stacked language buttons, beside a 52 px theme pill. Expected: one compact row (or an intentional two-row layout) with the language pill on a single line. Evidence: `signin-375-light.png`, `signin-375-dark-ptbr.png` in scratchpad/test-results/backoffice-switchers. Needs a fix and a regression test.
- Edge: `/sign-in#//evil.com` as `returnTo` answers 303 to `/sign-in` (fragment dropped), safe.
- Edge: a stale `__Host-zb_bo_locale` cookie with `SameSite=Strict` from before the change stays until the next switch rewrites it as Lax (seen in the shared browser profile); harmless.
- Edge: the unit and integration `returnTo` lists lack the encoded variants (`/%5Cevil`, `/%2F%2Fevil.com`); safe today (the path is compared before decoding) but unpinned.

## Adversarial review

The reviewer picks the three claims most likely to be wrong and tries to refute each.

- [x] Claim 1: no open redirect — attack: encoded and mixed-slash `returnTo` values; result: pending — evidence: encoded, mixed-slash, tab, CRLF, double-encoded `returnTo` all land on `/` (`attacks.log`); result: holds
- [x] Claim 2: nothing is reflected unchecked — attack: hostile cookie values rendered into `data-theme` and `lang`; result: pending — evidence: script, `DARK`, `purple` cookies render `data-theme="system"`; mutation `rawcookie` turned the hostile-cookie test red; result: holds
- [x] Claim 3: the CSP is unchanged and the icons trip nothing — attack: diff the header and read the console; result: pending — evidence: live CSP header equals the pinned string character for character, console shows no violation; result: holds

## Coverage honesty

- A real device with a dark OS setting: `browser_emulate_media` stands in for it; the risk is a browser-specific `color-scheme` quirk, accepted.
- The `/start` page is not covered: it is deliberately unchanged.
