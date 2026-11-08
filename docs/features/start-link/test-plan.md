# Test plan: Start link

Every checkbox states the input and the exact expected outcome. A ticked box carries evidence after ` — evidence: ` (commit hash, log path, counts, screenshot path). Unit: Vitest in `apps/api/test/unit`. Integration: Vitest in the workerd pool, real D1, through `exports.default.fetch`. Registry rows are seeded with `seedWhatsAppNumber` and a state/created-at override helper.

## The failing test first

- [ ] `apps/api/test/integration/start-link.test.ts::redirects to the oldest active number` — input: two active numbers (`+5511999990001` created at t, `+5511999990002` at t+1), `GET /start`; expected: `302`, `Location` equals `https://wa.me/5511999990001?text=` plus the encoded `START_PREFILLED_TEXT[pt_BR]`.
- [ ] Confirmed it fails for the right reason: the red run prints `expected 404 to be 302` (the route does not exist), not a harness error. Record the exact text here.
- [ ] `apps/api/test/unit/start-link-target.test.ts::builds the target` — stub throws `startLinkTarget is not implemented`; record the text here.
- [ ] `tools/repository-shape/src/docs-experience.test.ts::the start link snippet links START_LINK in <language>` — red because the snippet still prints `wa.me/OFFICIAL_NUMBER_UNSET`; record the text here.

## Unit

- [ ] `start-link-target.test.ts` — input: display number `+5511999990001`, locale `en_US`; expected: `https://wa.me/5511999990001?text=Hi!%20I%20want%20to%20connect%20my%20AI%20agents%20to%20zapbip.` (the text percent-encoded exactly once).
- [ ] Edge: display number `5511999990001` (no plus) — expected: `null`, no URL.
- [ ] Edge: display number `+123456` (6 digits), `+1234567890123456` (16 digits), `+55 11 99999-0001`, `+5511999990001/../x`, empty — expected: each returns `null`.
- [ ] `start-link-language.test.ts` — input: `en`, `pt-BR`; expected: `OwnerLocale.EnglishUs`, `OwnerLocale.PortugueseBrazil`.
- [ ] Edge: `lang` absent — expected: `DEFAULT_LOCALE`.
- [ ] Edge: `lang=fr`, `lang=PT-br`, `lang=`, `lang=en&lang=pt-BR` (repeated) — expected: each is a rejection, not a default.
- [ ] `start-link-page.test.ts` — input: locale `pt_BR`; expected: HTML with `lang="pt-BR"`, the pt-BR copy before the en-US copy, no `<script>`, no `<style>`, no `<a`, no `wa.me`; with `en_US` the order is reversed.
- [ ] `libs/types` pin: `START_LINK` equals `https://mcp.zapbip.com/start`; `HttpStatus.Found` equals `302`; both prefilled texts are non-empty. `libs/core` `command.test.ts`: `parseAccountCommand` returns `null` for both prefilled texts (no bare-word command).
- [ ] `deploy-preflight.test.ts` — input: a production Worker preflight and a docs preflight, all other inputs green, no number field; expected: both return `null`. The cases that expected the `OFFICIAL_WHATSAPP_NUMBER` refusal are gone.
- [ ] Edge: the preflight still refuses what it refused before (a `COMPANY_FACT_UNSET` fact, a missing npm package) — expected: the same messages, unchanged.

## Integration (Worker route)

Selection:

- [ ] One active number — expected: `302` to that number.
- [ ] Active numbers A (older) and B — expected: A; after A is set to `closed`, the next request goes to B; after B is `disabled` too, the next request is `503` (selection is per request, never cached).
- [ ] A `closed`, a `pending` and a `disabled` number only — expected: `503`, no `Location`.
- [ ] Two active numbers with the same `created_at` — expected: the lower `id` every time over ten requests.
- [ ] Empty registry — expected: `503`.
- [ ] `HEAD /start` with an active number — expected: `302` with the same `Location`, empty body.

Language and answers:

- [ ] `GET /start?lang=pt-BR` — expected: `text` decodes to the pt_BR text. `?lang=en` — the en_US text. No `lang` — the pt_BR text.
- [ ] `GET /start?lang=fr` — expected: `400`, body `bad request`, no `Location`.
- [ ] `503` page for `?lang=en` — expected: `text/html`, `Retry-After`, `lang="en-US"`, English copy first, Portuguese copy present, no `wa.me`, no digits of any registered number.
- [ ] Edge: a stored display number that fails the pattern (row edited by hand to `+12`) as the only active number — expected: `503` page, log event `start_link.invalid_number`, no `Location`.
- [ ] Edge: the registry read throws (D1 closed) — expected: `500`, body `server error`, event `start_link.failed`, no `Location`.
- [ ] `POST /start`, `PUT /start`, `GET /start/`, `GET /start/anything` — expected: `404`.
- [ ] Headers on `302`, `503`, `429`, `400`: `Cache-Control: no-store`, `X-Robots-Tag: noindex`, `Referrer-Policy: no-referrer`, `X-Content-Type-Options: nosniff`, HSTS. The `503` HTML also has `Content-Security-Policy: default-src 'none'`.
- [ ] The backoffice host (`BACKOFFICE_ORIGIN`) — input: `GET /start`; expected: `404`. A host with a trailing dot — expected: `404`.

Rate limit:

- [ ] 31 requests in a minute from one address — expected: the first 30 are `302`, the 31st is `429` with `Retry-After: 60`.
- [ ] Edge: a request without the client address header — expected: `400`, no registry read (spy on the registry).
- [ ] Edge: the `/start` counter and the `/i/:code` counter are separate — input: 30 `/start` calls, then one install page `GET`; expected: the install page is not `429`.

Attacks (`start-link-attack.test.ts`):

- [ ] Open redirect — input: `?lang=en&to=https://evil.example`, `?next=//evil.example`, `?redirect=...`, `?url=...`, `?number=15550000000`, `?text=pwned`, header `Host: evil.example`, header `X-Forwarded-Host: evil.example`; expected: `Location` is still exactly `https://wa.me/<digits>?text=<fixed>`; the host is `wa.me` and the text is the fixed one.
- [ ] Injection into the target — input: `lang=en%0d%0aSet-Cookie:x=1`, `lang=en%00`, `lang=<script>`; expected: `400`, no `Set-Cookie`, the value is not reflected in the body.
- [ ] Number enumeration — input: a hundred sequential requests with different query strings and a registry of three active numbers; expected: every `Location` carries the same single number (the oldest); no response lists, counts or names another number, state or label.
- [ ] No leakage in logs — expected: the captured log lines of every case above contain event names only, none of the display number, the phone number ID, a WABA ID or the client address.
- [ ] Account semantics unchanged — input: the start link number A; a new owner writes to A, then writes to B; expected: the account's `number_id` is A, the second message is dropped with the `AccountOnOtherNumber` notice naming A's display number (existing behaviour, asserted again with two active numbers).
- [ ] New owner via a stale link — input: the owner opens the link while A is active, A becomes `closed`, then the owner writes; expected: `refuseNewAccount` notice, no account created; the next `/start` goes to B.

## E2E (Playwright specs)

- [ ] `apps/docs/e2e/get-started.spec.ts::Get started is one ordered list with the start link and the prompt` — steps: open `/get-started/how-to-start` and `/pt-br/get-started/how-to-start`; expected: the first step has `a[href="https://mcp.zapbip.com/start?lang=en"]` (pt-br: `?lang=pt-BR`) visible, the page has no `wa.me` link and no text matching `\+\d{7,}`.
- [ ] `apps/docs/e2e/from-zero.spec.ts` — steps: the same two pages in the from-zero walk; expected: the same link in step one of each language.
- [ ] `tools/repository-shape` docs-wide test: no file under `apps/docs` or `libs/agents/supported` contains `wa.me`, `OFFICIAL_NUMBER` or `official-number`; the snippets exist under both languages.
- [ ] `rg 'OFFICIAL_(WHATSAPP_)?NUMBER' --glob '!docs/features/**' --glob '!docs/adr/**'` — expected: no match (after G4).

## Prove it for real — Playwright MCP

The tester boots the development stack with the fake channel (`pnpm dev` per the testing rule) and seeds two numbers, then drives the backoffice (`playwright`) and the start link (`playwright-second`) in separate browsers. No real WhatsApp is contacted: the redirect target `wa.me` is intercepted at the network layer and its URL is read, not followed.

- [ ] Happy path: with number A active, open `/start?lang=pt-BR` in the second browser; expected: the browser attempts `https://wa.me/<A digits>?text=Oi!%20Quero…`; the intercepted request is the only navigation after `/start`.
- [ ] English: `/start?lang=en`; expected: the same number with the English text.
- [ ] Capacity flow: the repo rules keep the operator key and the authenticator code out of an agent's hands (`.claude/rules/backoffice.md` two factors; `docs/runbooks/backoffice.md` intro: an agent never runs `pnpm backoffice:enroll:development`, never signs in and never sees a key or a code; `guard-deploy.sh` blocks the enroll script, and `hooks.test.sh` pins it for the development form), so the tester does not enroll or sign in. The runbook documents the state changes only through the backoffice UI, so the tester changes the development database directly, locally, which `guard-deploy.sh` allows: `pnpm --filter @zapbip/api exec wrangler d1 execute zapbip-development --env development --local --command "UPDATE whatsapp_numbers SET state = '<state>' WHERE display_number = '<digits>'"` through `pnpm dev`'s own local database. Steps: close A, reload the start link in the second browser; expected: the target is B's digits. Disable B, reload; expected: the no-number page. The backoffice form itself is proved by the backoffice feature's test plan and by the owner's human checklist, not here.
- [ ] No-number page: expected: the heading and body in the requested language first and the other language below, no link, no phone number, no console error; `Retry-After` present on the document request.
- [ ] Empty: registry with no numbers; expected: the no-number page, status `503`.
- [ ] Single: one active number; expected: the redirect as above.
- [ ] Many: three active numbers; expected: the oldest, on ten reloads in the browser; the tie and the ten-request cases are proved by SL-S6 and the `Selection` integration rows, so the browser row confirms only that the same `Location` repeats.
- [ ] Rejected input: `/start?lang=fr`; expected: `400`, plain `bad request`, no redirect.
- [ ] Browser Back from the intercepted `wa.me` hop; expected: back on the page before `/start` (the 302 left no history entry for `/start`).
- [ ] Reload on the no-number page after a number is reactivated: with every number closed or disabled, reload `/start` and see the no-number page; set one number back to `active` with the local statement of the capacity row; reload; expected: the redirect to that number's digits, with no browser restart.
- [ ] Two readers at once (two browsers, `playwright` and `playwright-second`, each `--isolated`): the first browser reloads `/start` in a loop of ten while the shell runs the local statement of the capacity row between reloads; expected: each response is wholly the state at its own time (a `302` to A's digits or to B's, or the `503` page), never a mixed header and body, and the sequence changes only once per statement.
- [ ] Console and network clean: the walk never reaches the real `wa.me`. Every walk page runs `await page.route('https://wa.me/**', (route) => route.fulfill({ status: 200, contentType: 'text/html', body: 'intercepted' }))` before the first `/start` navigation, and a `page.on('request')` listener records each `wa.me` URL; the redirect rows read those recorded URLs. Expected: zero console errors, and the only requests other than the dev stack's own are the recorded `wa.me` ones, each fulfilled by the route and none failed. With Playwright MCP the same is `browser_route` on `https://wa.me/**` answering `200`; if it is unavailable the tester runs the throwaway `_walk-start-link.spec.ts` of the harness (not committed) with the `page.route` above.
- [ ] Desktop width 1280 and narrow width 375: the no-number page is readable, no horizontal scroll, text not clipped.
- [ ] Docs walk: open the built docs site at both widths; expected: the call to action reads "Open WhatsApp" / "Abrir o WhatsApp", the link is `START_LINK` with the right `lang`, and clicking it reaches the dev Worker's `/start` (host rewritten by the walk's route interception).
- [ ] Screenshots and video: produced by the `recorder` role for the PR (`/check-ui`), not by the tester; the tester only confirms that the recorder's `.pr-media/start-link/` holds the 1280 and 375 screenshots and `walk.webm` of the redirect and the no-number page, and that they match what the walk saw.

## Edge cases found during execution

Empty on purpose. The tester adds one checkbox per new case (input, exact expected outcome) and a regression test for each.

## Adversarial review

The reviewer picks the three claims most likely to be wrong and tries to refute each.

- [ ] Claim 1: "`/start` can never redirect anywhere but `wa.me/<registered digits>`" — attack: encoded and double-encoded parameters, a malformed stored display number, a `Host` header swap, a registry row with a path-like display number; result: <refuted | held>
- [ ] Claim 2: "A new owner always lands on a number that accepts new accounts" — attack: change the state between the redirect and the first message; read `refuseNewAccount` and `ignored-state` paths; check the `closed`-only registry; result: <refuted | held>
- [ ] Claim 3: "Removing the number check loses no other production gate" — attack: break each remaining preflight input one by one in the dry-run e2e and confirm each still refuses; diff the refusal order against `main`; result: <refuted | held>

## Coverage honesty

- A real WhatsApp client opening `wa.me` and a real first message are not tested: the Cloud API is a test double and `wa.me` is a third-party page. The prefilled-text rendering in the WhatsApp app is verified by the owner during the go-live (human checklist).
- The rate limit binding is a Miniflare/workerd double; Cloudflare's real counters are eventually consistent per location, so the exact 31st request may differ in production. The accepted risk is a few extra redirects under burst, never an unbounded read.
- Meta's per-number throughput and tier limits are not simulated; concentration on the oldest active number is a documented risk, handled by the operator closing a number.
- Link-preview crawlers that fetch `/start` are not special-cased; they follow the 302 to `wa.me`, which is harmless.
