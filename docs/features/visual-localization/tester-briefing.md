# Tester briefing: Visual localization

## What changed

- `apps/api/scripts/landing-demo/demo-copy.ts` — `demoScriptOf` and `openGraphDataOf` for the eight languages; question, buttons and reply come from `WhyAsk*` in the site copy, terminal lines from `TERMINAL_COPY`.
- `apps/api/scripts/record-landing-demo.ts` — records any language (`--locale <code>`), one phone per language; `stage.html` wraps long terminal lines with a hanging indent and takes the page `lang`.
- `apps/api/scripts/render-open-graph-images.ts` — redraws the eight cards from `openGraphDataOf` (`open-graph-copy.ts` removed).
- `apps/api/src/site/site-paths.ts` — `siteAssetOf` has no English fallback.
- `apps/api/site-public/site/` — demo mp4/webm and both posters for es, de, fr, ja, ko, zh_CN; eight cards redrawn. Total 4.9 MB.

## How to run

```bash
cd apps/api
pnpm exec vitest run --config vitest.unit.config.mts test/unit/demo-copy.test.ts test/unit/site-assets.test.ts
pnpm exec tsx scripts/record-landing-demo.ts --locale ja
pnpm exec tsx scripts/render-open-graph-images.ts
```

## Red today, green after

| Test | Red before because | Green after because |
|------|--------------------|---------------------|
| `test/unit/demo-copy.test.ts` | `demoScriptOf is not implemented` | `demo-copy.ts` |
| `test/unit/site-assets.test.ts` (own file per kind, files present) | `siteAssetOf` returned `demo-en_US-…`; `demo-de-960.mp4` missing | no fallback; media recorded |

## Hypotheses to attack

1. Each language's page loads its own poster and video, and the poster text matches the page copy. Break it by: open `/de`, `/ja`, `/zh` with the network panel open.
2. The English and Portuguese media are unchanged. Break it by: `git diff --stat` on `demo-en_US-*` and `demo-pt_BR-*`.
3. Long terminal lines in fr, de and es wrap without running under the phone.

## Known gaps

- The media were recorded before the copy lane (L10) merged: any change to `WhyAsk*` or the hero title needs `record-landing-demo.ts --locale <code>` again, or `render-open-graph-images.ts` for the cards.
- English and Portuguese demos were not re-recorded with the wrapping stage; their lines are short and unchanged.
- The page integration tests and the Playwright walk were not run yet (waiting for "integration clear").
- Arabic needs a right-to-left stage; the steps are in the spec.
