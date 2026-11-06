# `mint dev` shows no component and the console says `__dirname is not defined`

- Date: 2026-11-06
- Inspired by: the `agent-inbox-core` docs fix round 5, where every `<Chat>` vanished under `mint dev`
- Revisited: 2026-11-06 — recorded

## Signal

`pnpm dlx mint@4.2.1207 dev` serves the pages, but no `<Chat>` renders and the browser console throws `ReferenceError: __dirname is not defined` from the initial vendor bundle. The same content rendered an hour earlier.

## Cause

`mint@4.2.1207` pins the CLI, but the preview client is downloaded as `latest` on every start into `~/.mintlify/previews/<port>-beta` (`mint-version.txt`). Client 0.0.4076 throws that error on every page whatever the content: the old snippet at `5702c16` fails the same way under `--client-version 0.0.4076`, and the new one renders under 0.0.4077.

## Do

Pin the client in the `dev` script with `--client-version`, and move the pin only after loading an Overview page in a browser and reading a clean console. When a preview breaks with no content change, read `~/.mintlify/previews/<port>-beta/mint/mint-version.txt` before touching a snippet.

## Anchor

- `apps/docs/package.json` → `dev`
- `tools/repository-shape/src/docs-preview.test.ts`
