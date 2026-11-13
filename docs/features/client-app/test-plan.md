# Test plan: Customer web app

## Unit

- [ ] `login` and `entrar` parse to `CommandKind.Login`, with the locale of the word; `login now` is not a command.
- [ ] A waitlisted account may run `login`; a suspended account gets the suspended reply.
- [ ] `login` and `entrar` are reserved agent names.
- [ ] The CSRF token is stable for one secret and differs between secrets.

## Integration

- [ ] `login` on the WhatsApp path replies with `<APP_ORIGIN>/sign-in/<43 characters>` in the account's language; the D1 row holds only a digest and expires in 10 minutes.
- [ ] A second `login` replaces the first token; the first one no longer signs in.
- [ ] The stored reply is masked once sent.
- [ ] `GET /sign-in/<token>` twice leaves the token usable; `POST` signs in once and the second `POST` answers `410`.
- [ ] An expired token answers `410` with the expired copy.
- [ ] `POST` with a wrong CSRF token or a foreign Origin answers `403` and does not consume.
- [ ] Sign-in rate limit answers `429` with `Retry-After`.
- [ ] The cookie is `__Host-zapbip_app`, HttpOnly, Secure, SameSite=Lax, Path=/.
- [ ] A waitlisted session sees the waitlist state and no agents.
- [ ] Active: list, connect (install prompt once, agent in the list), revoke (confirmation first, then gone).
- [ ] A session never lists nor revokes another account's agent.
- [ ] After account removal, suspension or deletion the session is signed out.
- [ ] Sign-out deletes the session.
- [ ] Headers: CSP without script, `Referrer-Policy: same-origin`, `Cache-Control: no-store`.
- [ ] Host dispatch: the app host serves the app, the MCP host does not.
- [ ] Wrangler: routes and `APP_ORIGIN` per environment; migration `0011` shape; the prune removes expired rows only.

## E2E (Playwright)

- [ ] Sign in with `login` through the owner simulator, list, connect, revoke, sign out, in `en_US` and `pt_BR`, at 1440 and 375.
- [ ] Signed-out, waitlisted, agents list, install prompt shown, expired link screenshots; no horizontal scroll at 375.

## Edge cases

- [ ] Token of 43 characters but unknown: `410`.
- [ ] Name `login` as a new agent: reserved.
- [ ] Ninth agent: the limit reason on the page.

## Coverage honesty

The WhatsApp delivery of the link is proven against the fake channel only; no real Cloud API call is made.
