# 0036. One fixed Meta app, and numbers join through Embedded Signup

- Status: Accepted
- Date: 2026-11-11
- Deciders: Dhyego Calota (owner); Claude (advisor)
- Inspired by: the owner's orders of 2026-11-11 ("o meta app id, label e secret tem que ser fixo, e os dados do phone number tem que usar o onboarding da meta"; "so eu por enquanto"; "não faça tantos gates e verificações"); [ADR 0032](0032-whatsapp-numbers-are-rows-in-a-sealed-registry-not-worker-secrets.md); Meta's Embedded Signup implementation, versions, Tech Provider onboarding and webhook override pages, read 2026-11-11

## Context

ADR 0032 made Meta apps rows: the backoffice form takes a Meta app ID, a label and an app secret, or an existing app, plus the phone number ID, WABA ID, display number, label and access token of each number, typed by hand. zapbip has one Meta app, `714836811568009`, and the owner wants it fixed. He also wants the number data to come from Meta's own onboarding instead of being copied from WhatsApp Manager. For now, only the operator (the owner) onboards zapbip's own numbers, from the backoffice.

Meta's Embedded Signup v4 is selected by a Facebook Login for Business configuration; v2 and v3 were deprecated on 2026-10-15. The flow returns a code to the page. Meta documents that the code lives for 30 seconds and that every follow-up call must be server-to-server. The page also gets a `WA_EMBEDDED_SIGNUP` message event, which carries the `phone_number_id` and the `waba_id`. The server then:

1. exchanges the code for a business token;
2. subscribes the app to the WABA;
3. registers the number for Cloud API with a six-digit two-step PIN.

A webhook override on `subscribed_apps` routes one WABA's deliveries to its own callback URL.

## Decision

1. **One app, fixed in code.** `META_APP_ID` (`714836811568009`), `META_APP_LABEL` and `META_LOGIN_CONFIGURATION_ID` are constants in `libs/types/src/constants.ts`. None of them is a secret. Staging and production use the same app.
2. **One app secret, a Worker secret.** `META_APP_SECRET` is set with `wrangler secret put` in each environment. It verifies `X-Hub-Signature-256` on every attributed delivery and authenticates the code exchange. Decision 4 of ADR 0032 is reversed for this one name. `WHATSAPP_ACCESS_TOKEN` and `WHATSAPP_PHONE_NUMBER_ID` stay removed.
3. **No `meta_apps`.** Migration `0008` drops `meta_apps` and `whatsapp_numbers.meta_app_ref`. Webhook attribution still needs a known phone number ID or WABA ID; the "spans two apps" case is gone. The migration refuses, and changes nothing, when a `meta_apps` row names any other app ID. Rows of the fixed app are copied, and their sealed access tokens still open, because the associated data names only the number.
4. **Numbers join through Embedded Signup.** The backoffice "Connect a WhatsApp number" flow calls `FB.login` with the configuration ID, `response_type: 'code'`, `override_default_response_type: true` and `extras: { setup: {} }`. Then the server, all-or-nothing:
   1. exchanges the code at `oauth/access_token` with the app ID and the secret, in a form-encoded `POST`, so the secret never sits in a URL;
   2. calls `POST /{waba_id}/subscribed_apps` with `override_callback_uri` set to the environment's own webhook URL and `verify_token` set to `WHATSAPP_VERIFY_TOKEN`;
   3. calls `POST /{phone_number_id}/register` with the PIN;
   4. reads `GET /{waba_id}/phone_numbers`. The posted phone number ID must appear there, which proves the number belongs to the WABA; the display number and the verified name come from the same read.

   The number is stored as `pending` with the sealed business token. Verify and activate stay as they are.
5. **The PIN is typed by the operator.** It is never stored, logged or put in a flash. A new number takes it as its two-step PIN. A number that already has one needs that PIN.
6. **Step-up before the popup.** The 30-second code cannot wait for a TOTP code typed after the flow. A fresh code is verified first, and it grants the session one onboarding submission for 10 minutes (`backoffice_sessions.onboarding_grant_until`). The final post consumes the grant atomically before anything else happens.
7. **Graph API version.** The calls use `GRAPH_API_VERSION` (`v24.0`), the version the repository already pins. `FB.init` takes the same constant.

## Alternatives considered

| Option | Pros | Cons | Why not |
|--------|------|------|---------|
| Keep `meta_apps` rows and add Embedded Signup | supports a second app later | a form and a table for one fixed app; the secret stays sealed in D1 | the owner fixed the app |
| App secret sealed in D1 under the fixed app | no Worker secret | needs a row and a form only to type it once; a D1 export plus the registry key exposes it | a Worker secret is write-only and encrypted at rest |
| A second Meta app for staging | a leaked staging secret never reaches production | the app ID is no longer one constant; a second Embedded Signup configuration | the owner fixed one app; per-WABA overrides keep staging deliveries on staging |
| Generated PIN, sealed per number | the operator types less | fails on a number that already has two-step verification; one more sealed column | the operator already keeps the PIN in a password manager |
| TOTP on the final post | no grant column | the code dies 30 seconds after the popup; the TOTP step is 30 seconds | the order cannot work |
| Code exchange by `GET` with the secret in the query, as Meta's example does | Meta's own example | the secret sits in a subrequest URL that error messages and traces can carry | a form `POST` is the OAuth token endpoint's standard form |
| Keep the manual form beside the flow | a fallback without the SDK | two ways to create a number, and the old way bypasses Meta's ownership checks | the owner ordered the Meta onboarding |

## Consequences

- One secret serves both environments. A staging leak is a production leak: the staging `.env` holds `SMOKE_META_APP_SECRET` only for the smoke run, and the runbook says to remove it afterwards.
- The app's default webhook callback is one URL, used by template and account-level fields. Each WABA connected from staging gets an override to the staging URL, set by the subscribe call, so message deliveries stay in their environment. Template status for a staging WABA still goes to the default URL, which the Worker does not consume.
- Meta's test number cannot join through Embedded Signup. Staging needs a real number of its own.
- Connecting a number that is already registered answers "Already registered" before any Graph call. The replace-access-token form stays for a token made by hand.
- Migration `0008` breaks the Worker version that is still running (its list query joins `meta_apps`) between `pnpm migrate:<environment>` and the deploy. This exception to the migration rule of `deploy.md` is accepted, because no environment has a number yet. The backout is the D1 time-travel bookmark together with the Worker rollback.
- An exchanged token is held for one request and sealed. It never reaches the browser, a log, an error message or a flash.

## Amendment 2026-11-11 (owner delegated)

- `META_LOGIN_CONFIGURATION_ID` is `946808808378298`, the "Chatwoot v2" configuration on the Logic Bit app. The owner may later create a dedicated "zapbip" configuration and swap the constant.
- `META_APP_SECRET` is not in the required-secrets list of the deploy preflight. The Worker serves without it, so the preflight warns and the webhook fails closed (every delivery answers `401`) until the owner sets it.

## Evidence

- On `origin/main` at `75a3272`, `apps/api/migrations/0005_backoffice.sql` defines `meta_apps` and `whatsapp_numbers.meta_app_ref REFERENCES meta_apps (id)`, and `apps/api/src/routes/whatsapp.ts` (`attributeDelivery`) needs every known ID to share one `metaAppRef` before `registry.openAppSecret` verifies the signature.
- `apps/api/src/numbers/number-sealing.ts` seals the access token with `whatsapp_numbers:<id>:access_token`, which names no app.
- Meta, Embedded Signup implementation: SDK `https://connect.facebook.net/en_US/sdk.js`; `FB.login` with `config_id`, `response_type: 'code'`, `override_default_response_type: true`, `extras: { setup: {} }`; message event `type: 'WA_EMBEDDED_SIGNUP'`, `event: 'FINISH' | 'CANCEL' | 'ERROR'`, `data.phone_number_id`, `data.waba_id`; "the exchangeable token code has a time-to-live of 30 seconds".
- Meta, versions: v4 is selected by the Facebook Login for Business configuration, and `extras` is optional; v2 and v3 were deprecated on 2026-10-15.
- Meta, Tech Provider onboarding: exchange at `oauth/access_token` with `client_id`, `client_secret` and `code`; `POST /<WABA_ID>/subscribed_apps`; `POST /<PHONE_NUMBER_ID>/register` with `messaging_product` and a six-digit `pin`; the customer cannot send or receive until these are done.
- Meta, webhook overrides: `override_callback_uri` and `verify_token` on `POST /<WABA_ID>/subscribed_apps`. The app must already be subscribed. Template and account-level webhooks always go to the app's default callback.

## Revisit when

- A second Meta app is needed, or customers onboard their own numbers (Tech Provider review, Advanced Access, a customer-facing flow).
- Meta deprecates Embedded Signup v4 or `v24.0`, or changes the code lifetime.
- The shared secret across environments becomes unacceptable.
