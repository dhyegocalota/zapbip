# Test plan: Visual localization

## The failing test first

- [ ] `apps/api/test/unit/demo-copy.test.ts` — expected: red with `demoScriptOf is not implemented`
- [ ] `apps/api/test/unit/site-assets.test.ts` — expected: red on `demo-de-960.mp4` missing and `siteAssetOf` returning the English file

## Unit

- [ ] The script of each language takes the question, buttons and reply from `WhyAsk*`
- [ ] Each non-English terminal line differs from English
- [ ] The Open Graph data of each language equals the copy
- [ ] Every media file exists, is named for its language and fits its budget; the total stays under 6 MB

## Integration (after "integration clear")

- [ ] `site-language.test.ts` and `site-page.test.ts`: every language's page points at its own demo, posters and card

## Prove it for real

- [ ] Open the home page in each of the eight languages: the poster and the video show that language's question, buttons and terminal lines
- [ ] The Open Graph image of each language shows its own bubble
