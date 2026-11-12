# Test plan: Landing quick start

Every checkbox states the input and the exact expected outcome. A ticked box carries evidence after ` — evidence: `.

## The failing test first

- [ ] `libs/agents/src/quick-start.test.ts::every install section holds its quick start` — input: each agent, each locale, a sentinel link; expected: the section contains `quickStart().proof`.
- [ ] `apps/api/test/unit/code-tokens.test.ts` — input: a command line; expected: command, flag and placeholder tokens.

## Unit

- [ ] Every agent has a hint and code in both locales, and the code contains the link it was given.
- [ ] `hasOfficialLogo` is true exactly for the agents with a file under `site-public/site/logos`, and every file has a source and licence line in the notice.
- [ ] Every logo file is under 4 KB, has a `viewBox` and no script.

## Integration

- [ ] One tab per agent in registry order plus Any MCP app, one panel each, exactly one visible; a logo image only where `hasOfficialLogo`.
- [ ] `?agent=<id>` selects that panel and shows the hint; `?agent=nope` selects the first; `?agent=any` selects the any tab.
- [ ] Tab links carry `agent`, `lang`, and `ref`, and end in `#start`.
- [ ] The code of each panel shows the localized placeholder; copy labels exist in both locales.
- [ ] A paused waitlist still shows the section.

## E2E (Playwright)

- [ ] Both locales, both widths: clicking a tab shows its panel without reload, rewrites the address, keeps lang and ref.
- [ ] Arrow keys, Home and End move between tabs; focus follows.
- [ ] Copy writes the code and announces it in the live region.
- [ ] Reduced motion: no animation, panel visible.
- [ ] 375 px: no horizontal scroll of the page; the tab row scrolls inside itself.

## Edge cases

- [ ] No script: tab links navigate and the chosen panel renders.
- [ ] No clipboard API: the code is selected and the fallback announcement is read.

## Adversarial review

- [ ] `?agent=<script>`, a repeated parameter, ten thousand characters: nothing echoed, first agent selected.
