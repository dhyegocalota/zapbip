# 0037. Only the onboarding page loads the Facebook SDK, under its own policy

- Status: Accepted
- Date: 2026-11-11
- Deciders: Dhyego Calota (owner); Claude (advisor)
- Inspired by: [ADR 0031](0031-the-backoffice-is-a-separate-host-signed-in-with-a-key-and-totp-enrolled-from-the-owners-terminal.md) decision 5; [ADR 0036](0036-one-fixed-meta-app-and-numbers-join-through-embedded-signup.md); the owner's order of 2026-11-11 to loosen the policy only on the onboarding page

## Context

ADR 0031 sets one strict policy on every backoffice response:

- `default-src 'none'; style-src 'self'; img-src 'self'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'`;
- `Cross-Origin-Opener-Policy: same-origin`;
- no client script at all.

Embedded Signup (ADR 0036) needs the Facebook JavaScript SDK. The SDK loads from `connect.facebook.net`, opens a login popup on `www.facebook.com`, talks to its frames on `*.facebook.com`, and reports back through `postMessage`. `same-origin` opener isolation cuts a cross-origin popup off from its opener, so the `WA_EMBEDDED_SIGNUP` message and the login callback would never arrive.

## Decision

1. **One page, one exception.** `GET /numbers/connect/meta` alone answers with the onboarding policy:

   ```
   default-src 'none';
   script-src 'self' https://connect.facebook.net;
   frame-src https://www.facebook.com https://web.facebook.com https://staticxx.facebook.com;
   connect-src https://www.facebook.com https://graph.facebook.com;
   img-src 'self' https://www.facebook.com;
   style-src 'self';
   form-action 'self';
   frame-ancestors 'none';
   base-uri 'none'
   ```

   It also sends `Cross-Origin-Opener-Policy: same-origin-allow-popups`. Every other header (HSTS, `X-Frame-Options: DENY`, `nosniff`, `no-store`, `noindex`, `Referrer-Policy: same-origin`, the permissions policy) and every other response stay exactly as ADR 0031 sets them.
2. **No inline script, so no nonce and no hash.** The page's own logic is a static asset, `/assets/embedded-signup.js`, served from `'self'` the way the stylesheet is. The app ID, the configuration ID and the Graph version reach it as `data-` attributes rendered by the server. It defines `fbAsyncInit` before the SDK tag, and both tags are `defer`, so the order holds.
3. **The policy is chosen by the route.** The route marks the response with a page policy kind, and `securityHeaders` picks the header set from a record keyed by that kind. The default kind is the strict set, so a route that names nothing keeps the strict policy.
4. **The message is trusted only from Meta.** The script accepts a message event only when its origin is `https` and its host is `facebook.com` or ends in `.facebook.com`. It accepts only `type: 'WA_EMBEDDED_SIGNUP'`, and posts only after `FINISH` with digits-only IDs and a code. The server re-validates everything it receives (ADR 0036).
5. **The allowlist is proven, not guessed.** The test walk serves the SDK stub and a `www.facebook.com` frame through Playwright routes under this exact policy. The owner's first connect on staging, with the real SDK, must show zero CSP violations in the console. A host the real SDK needs and the list lacks is added by a dated amendment to this record, never by widening to `*`.

## Alternatives considered

| Option | Pros | Cons | Why not |
|--------|------|------|---------|
| One inline handler with a per-response nonce | one file | a nonce generator per response, and inline script on a page that loads third-party code | a `'self'` asset needs neither |
| One inline handler with a hash | no per-response state | the hash changes with every edit and must be pinned by a test | same reason |
| Loosen the policy for the whole backoffice | one header set | every page runs third-party script and loses opener isolation | the owner ordered only the onboarding page |
| `https://*.facebook.com` for frames and connections | survives Meta host changes | allows any Facebook subdomain to frame or receive | an explicit list, amended when proven short |
| Embedded Signup hosted by Meta (redirect, no SDK) | no third-party script on our origin | the flow's ID and code return through a redirect URI that the backoffice must then expose; less documented for v4 | the SDK flow is Meta's documented path |

## Consequences

- Third-party script runs on one backoffice page. It can read that page's DOM: the CSRF field, the label and the PIN the operator typed. It cannot read the session cookie (`HttpOnly`), and the page holds no token or secret. Meta is already the PIN's authority.
- The onboarding page cannot carry Subresource Integrity, because Meta changes `sdk.js` in place.
- `.claude/rules/backoffice.md` changes from "no script" to "no script except the onboarding page" in the same commit as the code.

## Evidence

- `apps/api/src/backoffice/backoffice-constants.ts` (`CONTENT_SECURITY_POLICY`, `STATIC_SECURITY_HEADERS`) and `apps/api/src/backoffice/security-headers.ts` (`applySecurityHeaders`) on `origin/main` at `75a3272` set one header set for every response.
- Meta's Embedded Signup implementation page loads `https://connect.facebook.net/en_US/sdk.js` and checks `event.origin` against `facebook.com` before it reads `WA_EMBEDDED_SIGNUP`.

## Revisit when

- Meta ships a flow without the JavaScript SDK, or the SDK needs a host this list lacks.
- A second page needs third-party script.
- Browsers change how opener isolation treats popups.
