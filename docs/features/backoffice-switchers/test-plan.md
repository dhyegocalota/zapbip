# Test plan: Backoffice switchers

Every checkbox states the input and the exact expected outcome. A ticked box carries evidence after ` — evidence: `.

## The failing test first

- [ ] `apps/api/test/integration/backoffice-preferences.test.ts::sets the theme cookie and redirects` — input: signed-in `POST /theme` with `theme=dark`, a valid CSRF token and `returnTo=/metrics`; expected: `303`, `Location: /metrics`, a `Set-Cookie` for `__Host-zb_bo_theme=dark`
- [ ] Confirmed it fails for the right reason: `404` on `POST /theme` (the route does not exist), not a broken fixture

## Unit

- [ ] `backoffice-theme.test.ts::resolveTheme` — input: `light`, `dark`, `system`; expected: the same member
- [ ] Edge: `resolveTheme` with `undefined`, `''`, `DARK`, `<script>`; expected: `System`
- [ ] `backoffice-locale.test.ts::resolveLocale` — input: cookie `en_US` with `Accept-Language: pt-BR`; expected: `en_US`; unknown cookie plus `en-GB`: `en_US`; nothing: `DEFAULT_LOCALE`
- [ ] `backoffice-return-target.test.ts::returnTargetOf` — input: `/`, `/sign-in`, `/numbers`, `/numbers/abc`, `/metrics`, `/audit`; expected: the same path
- [ ] Edge: `//evil.test`, `https://evil.test/`, `/\evil.test`, `javascript:alert(1)`, `/numbers/%0d%0a`, `/unknown`, empty, `null`; expected: `/`
- [ ] `backoffice-layout.test.ts` — input: `Layout` with each theme; expected: `<html data-theme="light|dark|system">` and `lang` from the locale; both switchers present for a signed-in page and the sign-in page, none on the error page without a token
- [ ] `backoffice-copy.test.ts` — expected: the four theme keys exist in pt_BR and en_US and are non-empty
- [ ] `backoffice-design-rules.test.ts` and `backoffice-tokens.test.ts` — expected: three `:root`-scoped token blocks, the two dark blocks equal, no raw colour outside them, every animation under reduced motion
- [ ] `backoffice-contrast.test.ts` — expected: every text pair of the dark block is AA (unchanged pairs, now read from the forced-dark block as well)
- [ ] `backoffice-headers.test.ts` — expected: the CSP is character for character the current one

## Integration (real app)

- [ ] `Set-Cookie` of both preferences — expected: `__Host-` prefix, `Secure`, `HttpOnly`, `SameSite=Lax`, `Path=/`, `Max-Age=31536000`, no `Domain`
- [ ] Unknown value — input: `theme=purple`, `locale=fr`; expected: `303`, no `Set-Cookie` for that field
- [ ] Open redirect — input: each hostile `returnTo` above; expected: `303 Location: /`, never the attacker value
- [ ] CSRF — input: `POST /theme` with a missing token, a wrong token, a wrong `Origin`, no `Origin`; expected: `403` and no cookie
- [ ] Sign-in page — input: signed out, `POST /theme` with the cookie CSRF token from `GET /sign-in`; expected: `303` to `/sign-in`, then `GET /sign-in` carries `data-theme` from the cookie
- [ ] Rendered state — input: `GET /` with cookies `theme=dark`, `locale=en_US`; expected: `data-theme="dark"`, `lang="en"`, English copy
- [ ] `GET /theme` — expected: `404` (a preference never changes on a GET)

## Prove it for real — Playwright MCP (one walk, /check-ui)

- [ ] Sign-in page, 1280 and 375, light and dark: both switchers visible with icons, labels announced, every button at least 44 px; screenshots
- [ ] Signed in, `/` and `/numbers`, 1280 and 375: click each theme button; expected: the page re-renders in light, dark and (with the OS set to dark through `browser_emulate_media`) system-dark; the chosen button has `aria-pressed="true"`; the same page, no scroll jump to another page
- [ ] Click `English` then `Português`; expected: copy and `<html lang>` change, the same page stays open
- [ ] Reload and navigate to another page; expected: both choices persist
- [ ] Keyboard only: Tab reaches both groups, Enter submits, the focus ring is visible in both themes
- [ ] Console and network clean: zero console errors, zero CSP violations, zero failed requests
- [ ] Screenshots at `docs/features/backoffice-switchers/evidence/`; the recorder uploads them for the PR

## Edge cases found during execution

Empty on purpose.

## Adversarial review

The reviewer picks the three claims most likely to be wrong and tries to refute each.

- [ ] Claim 1: no open redirect — attack: encoded and mixed-slash `returnTo` values; result: pending
- [ ] Claim 2: nothing is reflected unchecked — attack: hostile cookie values rendered into `data-theme` and `lang`; result: pending
- [ ] Claim 3: the CSP is unchanged and the icons trip nothing — attack: diff the header and read the console; result: pending

## Coverage honesty

- A real device with a dark OS setting: `browser_emulate_media` stands in for it; the risk is a browser-specific `color-scheme` quirk, accepted.
- The `/start` page is not covered: it is deliberately unchanged.
