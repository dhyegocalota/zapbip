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

## Tester walk (Playwright MCP, local dev server, 2026-11-12)

Screenshots: `/private/tmp/claude-501/-Users-dhyegocalota-Projects-zapbip-zapbip/edbded58-c331-44d5-ac8d-6cac14247a14/scratchpad/dev/qs-tester/`. Covered en and pt-BR, 1440 and 375, light and dark, reduced motion. Clean console (0 errors, 0 warnings) and every request 2xx/304. The Cloudflare "no script" run used a context with JavaScript off.

- [x] All 11 tabs, name and mark: Claude and Cursor and Gemini show an SVG with empty alt, the rest an `aria-hidden` initials badge; the accessible names are clean ("Codex", "Any MCP app"). — evidence: `en-1440-light-codex.png`, `pt-1440-dark-chatgpt.png`, aria snapshot
- [x] Panel per agent plausible and complete (Claude Code, Codex, Gemini CLI, OpenClaw, Hermes, Cursor, ChatGPT checked against each `install-copy.ts`): the code is the install text; click paths for Cursor, claude.ai, ChatGPT, Grok Bot, Grok web, Any. — evidence: DOM dump of every `data-code`
- [x] Keyboard: ArrowRight/Left wrap, Home and End jump, one tab stop (`tabindex=0` on the selected tab only), Tab lands on Copy, the address is rewritten and keeps `lang` and a valid `ref`. — evidence: run_code sequence
- [x] Copy writes exactly `data-code`, label "Copied", live region "Code copied". With a rejecting clipboard and with no clipboard API: code selected, "Code selected. Copy it with your keyboard." / "Código selecionado. Copie pelo teclado." — evidence: run_code
- [x] Typing: `code-type` 100 ms per line, lines staggered (about 400 ms for four), `caret-blink` 5 iterations, then no animation. Page text complete in the DOM throughout. — evidence: getAnimations timeline
- [x] Reduced motion: zero `code-type` and `caret-blink` animations. — evidence: `en-375-dark-reduced-claude.png`
- [x] 375: no horizontal scroll (`scrollWidth` 375), tab row scrolls inside itself (1602 px content), `?agent=grok-web` is scrolled into view on load, header keeps words whole, no dots. — evidence: `pt-375-light-grok-web.png`
- [x] Deep links: `nope`, `__proto__`, `<script>…` select the first agent with nothing echoed; `any` selects the any tab; repeated `agent` takes the first. — evidence: run_code
- [x] "Get your free link": scrolls to `#join` with the "You picked X" hint; the any-app CTA clears the hint; browsing tabs alone leaves the hint hidden. — evidence: run_code
- [x] No script: tab links reload on the chosen panel at 1440 and 375, the code is fully visible and readable. — evidence: `qs-nojs-desktop.png`, `qs-nojs-mobile.png`
- [x] Console and network clean (Turnstile noise not seen in this run). — evidence: console 0 messages, network all 200/304

## Defects

- D1 (Low, no-script) the Copy button is visible and does nothing with JavaScript off. Repro: disable JS, open `/?agent=codex#start`; expected: hidden or absent; observed: a dead "Copy" button in the panel header. Evidence: `qs-nojs-desktop.png`, `qs-nojs-mobile.png`. Regression test: a no-script check that `.start-copy` is not visible.
- D2 (Low, cosmetic) at 375 the left edge fade of the tab row covers the first and selected tab (Claude Code) when the row is scrolled to its start: the chip and the first letters wash out. Repro: open `/?lang=en#start` at 375, dark or light. Expected: no left fade at scroll start; observed: the mask fades both edges always. Evidence: `en-375-dark-reduced-claude.png`. Regression test: assert the mask has no left stop at `scrollLeft` 0.
- D3 (Low, cosmetic) at 375 a long command breaks inside a flag: `--transport http -` then `-scope user …` (Claude Code, Gemini CLI). Repro: `/?lang=en&agent=claude-code#start` at 375. Expected: the break between whole words (the briefing says words stay whole in the header only, but a split `--scope` is a hazard when a reader retypes it); observed: a break between the two hyphens. Evidence: `en-375-dark-reduced-claude.png`. Regression test: a computed `overflow-wrap` check on `.code-line`, or a narrower break rule.
- D4 (Info, motion) with a slow script (3 s on a throttled route) the command is shown whole at first paint, then hidden and typed once `site.js` runs. Only when the block is in view on load (`#start` deep link). The briefing says no flash; with a normal-speed script I could not catch a painted frame. A trade-off for no-script safety, recorded for the reviewer.

## Edge cases found during execution

- `ref` is kept on tab switch only for a valid code (12 characters from the code alphabet): `ref=abc` is dropped by the server as designed; `abcdefgh2345` is kept in the address and in every tab link.
- After a `#join` click the address has no `#join` (the script replaces it): intended per the join hint flow, noted so Back does not land on the anchor.
- Two numbered lists on click-path tabs (the 3 or 4 click steps in the terminal, then the 1-2-3 steps) read as two competing sequences; "Get your free link" repeats as step 1 and as the button right under it. Polish, not a defect.
- A `?agent=` deep link also sets the join hint ("You picked ChatGPT") even though the visitor only landed there; same as the pre-existing `?agent=` behaviour.
- Alt text: the brief asked for "<Agent> logo"; the build ships an empty alt (decorative, the tab name carries the label). Accessible names verified clean.
- Not done: Claude Code/Codex tabs were not tried against the real `/c/<code>` install page (needs a created account; local only). The live "Copied" reset after 2 s was read on the label (back to "Copy"); the live region keeps "Code copied" afterwards.

## Summary

Ticked in this walk: 11/11. Earlier rows: 20/20 by the developer (not re-run; verify is running). Blocked: 0. Defects: 0 high, 0 medium, 3 low, 1 info. Verdict: ready for review; the block is polished and easy in both locales and themes, D1 to D3 are small fixes with tests.

## Tester findings (dc9ae8ce)

- [x] No script: the Copy buttons exist but none is visible; with a script the visible panel's button is. — evidence: landing-quick-start.spec.ts
- [x] 375 px: the start of the tab row has no fade until the row scrolls (the snap padding keeps the first tab at scroll start). — evidence: landing-quick-start.spec.ts
- [x] 375 px: the command keeps `white-space: pre`, no flag breaks across lines, the block scrolls and the page does not. — evidence: landing-quick-start.spec.ts
- [x] Each panel has one "Get your free link" button and one note beside it, and no numbered steps row. — evidence: site-page.test.ts
