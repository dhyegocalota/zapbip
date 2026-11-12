# Tester briefing: Landing quick start

## What changed and where

- `libs/agents`: every install facet gains `hasOfficialLogo` and `quickStart({ locale, connectionLink })` returning `{ hint, code, proof }` (`src/contract.ts`, `src/quick-start.ts`, each `supported/<agent>/install-copy.ts` and `install.ts`). The Claude Code, Gemini CLI and Codex install sections now build their command or table with the same functions the quick start uses. `src/quick-start.test.ts` proves each install section contains its quick start.
- `apps/api/site-public/site/logos/`: six SVGs from Simple Icons (CC0 data) and `NOTICE.md` with source and licence per file.
- `apps/api/src/site`: `views/quick-start-section.tsx` replaces `views/clients-section.tsx`; `code-tokens.ts` tints the code; `site-agents.ts` (`siteQuickStartOf`, `SiteStartTab`, `siteAgents().hasOfficialLogo`), `site-context.ts` (`startTab`), `site-links.ts` (`startPathOf`), `site-copy.ts` (new keys, the tile keys removed), `site-scripts.ts` (tabs, copy), `assets/site.css`.

## How to run

- `pnpm --filter @zapbip/agents test:unit`
- `pnpm --filter @zapbip/api test:unit`, `test:integration -- site-page site-stylesheet site-motion`
- `pnpm --filter @zapbip/api test:landing` (87 specs, desktop 1280 and mobile 375)
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

1. `/?agent=<id>` renders that panel visible and the others hidden; an unknown value shows the first agent; `?agent=any` shows the any tab; the hero hint names the agent for a real id and stays empty for `any`.
2. Each panel's code is the registry text with `<your-link>` / `<seu-link>`; the Claude Code and Gemini CLI lines are the same command their install sections run; the Codex block is the table its install section writes.
3. Tabs: click switches at once, rewrites the address keeping `lang` and `ref`; arrows wrap, Home and End jump, focus follows; only the selected tab is a tab stop once the script runs; with no script the tab links reload the page on the chosen panel.
4. Copy writes exactly the visible code (placeholder included), says "Copied" and announces it in the live region, and resets after two seconds; with no clipboard API the code is selected.
5. Six agents show an official logo on a white chip in both themes; four show the initials badge; every logo has `<Agent> logo` / `logo do <Agent>` alt text.
6. The call to action goes to the join form and carries the agent; the any tab's clears the agent.
7. At 375 px the tab row scrolls inside itself, the page does not, and the selected tab is scrolled into view on load. No layout shift, LCP unchanged.
8. Reduced motion: no running animation, panel visible.

## Known gaps

- Hermes, OpenClaw, Grok Bot and Grok web have no logo in Simple Icons (the nearest entries are other brands), so they show initials; the OpenAI mark stands for Codex and ChatGPT.
- The copied code holds the placeholder, not a real link: accounts are still created by the owner.
- The Playwright landing suite is not part of `pnpm verify`.
