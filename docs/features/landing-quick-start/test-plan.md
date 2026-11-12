# Test plan: Landing quick start

Every checkbox states the input and the exact expected outcome. A ticked box carries evidence after ` — evidence: `.

## The failing test first

- [x] `libs/agents/src/quick-start.test.ts::is the same text the install section tells the agent to use, whole` — input: each agent, each locale, a sentinel link; expected: the section contains `quickStart().code`. — evidence: red at f4fec5cd for the two agents whose section did not hold the full entry; green after
- [x] `apps/api/test/unit/code-tokens.test.ts` — input: a command line; expected: command, flag and placeholder tokens. — evidence: 8447f29a, green 2d0c25fb

## Unit

- [x] Every agent has a hint and code in both locales, the code contains the link it was given, at most five lines. — evidence: quick-start.test.ts
- [x] An address-only agent has a click path in both locales with no step equal across languages; any other agent has none. — evidence: quick-start.test.ts
- [x] Every `officialLogo` stem has a file under `site-public/site/logos`, small, inert, with a source and licence line; two agents share one file; no OpenAI file or notice line. — evidence: site-logos.test.ts

## Integration

- [x] One tab per agent in registry order plus Any MCP app, one panel each, exactly one visible; the logo image has an empty alt text where the facet names a logo, the initials badge elsewhere.
- [x] `?agent=<id>` selects that panel; `?agent=nope`, a prototype name, markup and ten thousand characters select the first; `?agent=any` selects the any tab.
- [x] Tab links carry `agent`, `lang`, `ref` and end in `#start`; each panel's code, hint and click path come from the registry and the whole code is in `data-code`.
- [x] A paused waitlist still shows the section with CTAs pointing at `#join`.
- [x] The stylesheet types only under the no-preference query, hides lines only under `has-typing`, caps the caret at five blinks and fades the tab row with named colours.

## E2E (Playwright)

- [x] Both locales, both widths: a tab click shows its panel without a reload, rewrites the address keeping lang and ref, and does not touch the join hint; the call to action sets it, the any-app one clears it.
- [x] Arrow keys, Home and End move between tabs; only the selected tab is a tab stop.
- [x] Copy writes the whole code, even while it types, and announces it; without a clipboard the code is selected and the fallback is announced.
- [x] 1280 px: the panel spans the section, the tabs form two full rows. 375 px: the tab row scrolls inside itself with an edge fade, the header keeps words whole and shows no dots, the selected tab is in view on load.
- [x] The command types in (a running `code-type` animation) while the text is complete in the page; before the block is live the lines are hidden; the caret blinks at most five times.
- [x] Reduced motion: no animation and no caret. No script: tab links reload on the chosen panel.

## Adversarial review

- [x] `?agent=<script>`, a repeated parameter, ten thousand characters: nothing echoed, first agent selected.
