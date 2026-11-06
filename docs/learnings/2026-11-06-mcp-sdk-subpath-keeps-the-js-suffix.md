# The MCP SDK subpath import compiles without `.js` and then fails to bundle

- Date: 2026-11-06
- Inspired by: step S0.5 of the `agent-inbox-core` plan, which assumed `tsc` would reject the suffix-less import
- Revisited: 2026-11-06 — recorded

## Signal

`tsc --noEmit` is green for both `@modelcontextprotocol/sdk/server/webStandardStreamableHttp` and the same path with `.js`. The bundler (esbuild, which wrangler and Vitest use) fails on the first one: `Could not resolve "@modelcontextprotocol/sdk/server/webStandardStreamableHttp"`. The `.js` form bundles.

## Cause

The package maps `./*` to `./dist/esm/*` for the `import` condition, with no extension added, while its `types` condition maps to `./dist/esm/*.d.ts`. TypeScript appends `.d.ts` and finds the declaration; a bundler takes the target literally and finds no file.

## Do

Keep the `.js` suffix on every `@modelcontextprotocol/sdk` subpath import. It is the only place in the repository where a `.js` import is allowed, and `tsc` will not tell you when it is missing: bundle once (`wrangler deploy --dry-run`, or any Vitest run that imports it).

## Anchor

- `docs/features/agent-inbox-core/plan.md` → A9
- `apps/api/package.json` → `@modelcontextprotocol/sdk` 1.32.2
