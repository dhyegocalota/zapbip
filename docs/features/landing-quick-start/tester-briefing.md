# Tester briefing: Landing quick start

## What changed and where

- `libs/agents`: every install facet gains `officialLogo` and `quickStart({ locale, connectionLink })` returning `{ hint, path, code }` (`src/contract.ts`, `src/quick-start.ts`, each `supported/<agent>/install-copy.ts` and `install.ts`). The Claude Code, Gemini CLI, Codex, Hermes and OpenClaw install sections build their command or entry with the same functions the quick start uses (the last two now show the whole entry in a fenced block). `src/quick-start.test.ts` proves each install section contains its agent's whole code.
- `apps/api/site-public/site/logos/`: three SVGs (Claude, Cursor, Gemini) from Simple Icons (CC0 data), one file per mark and named by the install facet's `officialLogo`, and `NOTICE.md` with source and licence per file. The OpenAI mark is not shipped.
- `apps/api/src/site`: `views/quick-start-section.tsx` replaces `views/clients-section.tsx`; `code-tokens.ts` tints the code; `site-agents.ts` (`siteQuickStartOf`, `SiteStartTab`, `siteAgents().hasOfficialLogo`), `site-context.ts` (`startTab`), `site-links.ts` (`startPathOf`), `site-copy.ts` (new keys, the tile keys removed), `site-scripts.ts` (tabs, copy), `assets/site.css`.

## How to run

- `pnpm --filter @zapbip/agents test:unit`
- `pnpm --filter @zapbip/api test:unit`, `test:integration -- site-page site-stylesheet site-motion`
- `pnpm --filter @zapbip/api test:landing` (desktop 1280 and mobile 375)
- Look: `pnpm --filter @zapbip/api dev`, open `http://site.localhost:8787/?lang=pt-BR&agent=codex#start`.

## Red today, green after

| Test | Red failure text at 8447f29a | Green at |
|------|------------------------------|----------|
| `libs/agents/src/quick-start.test.ts` (70 cases) | `Error: quickStart is not implemented` | 4cad4ff8 |
| `test/unit/code-tokens.test.ts` | `Error: highlightCode is not implemented` | 2d0c25fb |
| `test/unit/site-logos.test.ts` | `ENOENT: no such file or directory, scandir '…/site-public/site/logos'` | 2d0c25fb |
| `test/integration/site-page.test.ts` (quick start, section order) | tab and panel lists empty, `expected […] to deeply equal ['claude-code', …]` | 2d0c25fb |
| `e2e/landing/landing-quick-start.spec.ts` | not run red; first green at 39af43ce | 39af43ce |

## Hypotheses for the tester

1. `/?agent=<id>` renders that panel visible and the others hidden; an unknown value shows the first agent; `?agent=any` shows the any tab. Browsing tabs never changes the hero hint; the panel's button sets it, the any-app one clears it.
2. Each panel's code is the registry text with `<your-link>` / `<seu-link>`; each install section contains that whole code. Cursor, claude.ai, ChatGPT, Grok Bot, Grok web and the any tab show a numbered click path above the address.
3. Tabs: click switches at once and rewrites the address keeping `lang` and `ref`; arrows wrap, Home and End jump; only the selected tab is a tab stop once the script runs; with no script the tab links reload on the chosen panel.
4. Copy writes exactly `data-code`, says "Copied" in the live region, resets after two seconds; with no clipboard API the code is selected and the fallback is announced.
5. Three marks (Claude on two agents, Cursor, Gemini) sit on a white chip in both themes with empty alt text; every other agent shows initials.
6. At 1280 px the panel and the tabs span the section in two full rows; at 375 px the tab row scrolls inside itself with an edge fade, the header has no dots and keeps words whole, the selected tab is in view on load.
7. The command types in over about 400 ms on a tab switch and when the block first scrolls into view, with a caret that blinks five times; the page text and Copy are complete at once. No flash of text before it types. Reduced motion: text at once, no caret, no animation.

## Known gaps

- Codex, ChatGPT, Hermes, OpenClaw, Grok Bot and Grok web show initials: Simple Icons has no mark for them, or withdrew it (OpenAI).
- The copied code holds the placeholder, not a real link: accounts are still created by the owner.
- The click paths are landing presentation; only the address is proven against the install sections.
- A removed agent leaves its logo file behind (the lifecycle removal proof only deletes the agent folder).
- The Playwright landing suite is not part of `pnpm verify`.
