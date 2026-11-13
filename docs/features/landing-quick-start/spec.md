# Landing quick start

**Status:** Shipped 2026-11-12
**Tier:** 🟡 medium
**Owner approval:** approved 2026-11-12 (owner delegated)
**ADRs:** none new; reads [0033](../../adr/0033-one-folder-per-supported-agent.md) and [0041](../../adr/0041-the-public-site-is-served-by-the-api-worker-through-host-dispatch.md)
**Not changing:** the join route, Turnstile, the waitlist, the why stories, pricing, FAQ, the hero, the CSP, the install sections' text

## Problem

The per-agent tiles of [landing-motion-free-tier](../landing-motion-free-tier/spec.md) repeat one "Get started free" link ten times. The owner's words (2026-11-12, translated): he did not like the repetitive part; it should be official logos and a simple code to paste and start, so that getting started is easy.

## Goals

- One "Start in 30 seconds" block replaces the tile grid. A tablist shows each install-facet agent's official logo and name, in registry order, plus "Any MCP app". The selected tab shows a terminal-styled panel: a hint, the short command or paste-in that connects that agent, a Copy button and the personal link as a marked placeholder. The tabs and the panel span the full width of the section; the tabs sit in balanced rows (6 columns from 1024 px, 4 from 640 px, the any-app tab spanning two) and scroll inside themselves on a phone, with an edge fade only on the side that has more to show. A long command scrolls inside its block and never breaks inside a word.
- Agents that are set up by clicks (the address only) show a numbered click path above the address, in both languages. The path is landing presentation: only the address is proven against the install section.
- The command types in over about 400 ms with a caret that blinks five times, on a tab switch and when the block first enters the viewport. The full text is always in the page and is what Copy writes. Reduced motion shows the text at once with no caret.
- Under the panel, one primary "Get your free link" button to the join form, carrying `?agent=<id>`, with one short line beside it ("Then paste it, and your agent texts you on WhatsApp."). Browsing the tabs never announces a pick; the button does. Without a script the Copy button is not offered.
- The snippet comes from the agent registry: each install facet gains `quickStart` (`hint`, `path`, `code`). The commands and entries the install sections tell the agent to write are built by the same functions, so every install section contains its agent's whole `code`, and a registry test proves it for every agent and language. A code block is at most five lines.
- Logos are self-hosted SVGs under the site's static assets (CSP unchanged), from Simple Icons (CC0 data), one file per mark, named by the install facet's `officialLogo`; source and licence are recorded in a notice beside them. The OpenAI mark is not shipped: Simple Icons withdrew it without its owner's permission, so those agents, like Hermes, OpenClaw, Grok Bot and Grok web, show the initials badge. The visible name sits next to the logo, so the image has an empty alt text.
- Server-rendered, no script needed: the tabs are links `/?agent=<id>&lang=…#start`; the selected tab follows `?agent`, the first agent by default. With script the switch is instant, the address is replaced, language and referral code are kept, and the tabs are a proper tablist (arrows, Home, End).
- Everything in `en_US` and `pt_BR`.

## Non-goals

- A real personal link in the snippet (accounts are created by the owner; the placeholder is `<your-link>`), a logo for an agent the source does not have, endorsement wording.

## Design

### Data flow

`AGENT_INSTALLS[id].quickStart({ locale, connectionLink })` returns `{ hint, path, code }`. The site passes the localized placeholder as the link, tints the code by token kind (command, flag, key, string, table, placeholder) and renders one hidden panel per tab, with the whole code in `data-code`. `libs/agents` tests render each install section with a sentinel link and assert it contains `code`.

### Failure handling

No script: the links navigate and the server renders the chosen panel. No clipboard API: the code is selected and the live region says so. Unknown `?agent`: the first agent.

## Open questions → answers

| Question | Options | Owner's answer | Date |
|----------|---------|----------------|------|
| Which source for logos? | Simple Icons (CC0 data), vendor press kits | Simple Icons 16.37; the OpenAI mark is dropped because upstream withdrew it | owner delegated 2026-11-12 |
| An agent without an official mark? | invent one, initials badge | initials badge | owner delegated 2026-11-12 |
| Where does the snippet live? | site copy, agent registry | agent registry, with a drift check | owner delegated 2026-11-12 |

## Test strategy summary

Unit: token highlighter, initials, quick start per agent and locale, install-section proof, logo files against `hasOfficialLogo`. Integration: the section, tabs, panels, `?agent`, paused page. E2E: both locales, both widths, tabs by click and keyboard, copy, reduced motion.
