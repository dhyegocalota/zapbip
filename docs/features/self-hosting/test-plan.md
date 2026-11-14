# Test plan: Self-hosting

## Unit

- [x] The container files exist, the entrypoint is executable, and the image, Compose file and entrypoint agree on the port, the volume and the data directory — evidence: `self-hosting.test.ts`
- [x] The four generated secrets are kept by the entrypoint and passed through by Compose — evidence: same file
- [x] The three Open source pages exist in every language and the local page names the volume, the port and the compose command — evidence: same file, 10 languages each
- [x] The navigation has the sixth group in every language and the visual baseline ignores added groups — evidence: `docs-navigation.test.ts`, `docs-visual.test.ts`

## Manual

- [x] `docker compose up --build` answers `/health` with `{"ok":true,"environment":"development"}` — evidence: run on this machine
- [x] `docker compose exec zapbip pnpm --silent dev:seed ...` prints one `alpha zb_conn_...` line — evidence: run on this machine
- [x] A restart keeps `secrets.env` byte for byte — evidence: `md5sum` before and after
- [x] The Mintlify build renders the new group in ten languages — evidence: the docs gate, `broken-links` exit 0 and `test:walk` 1800 passed, 10800 skipped, exit 0

## Edge cases

- [x] The README licence badge URL answers an SVG with AGPL-3.0, and the contributors image comes from `contributors-img.web.app` — evidence: `curl` of both
