# Landing quick start

**Status:** Building
**Tier:** 🟡 medium
**Owner approval:** approved 2026-11-12 (owner delegated)
**ADRs:** none new; reads [0033](../../adr/0033-one-folder-per-supported-agent.md) and [0041](../../adr/0041-the-public-site-is-served-by-the-api-worker-through-host-dispatch.md)
**Not changing:** the join route, Turnstile, the waitlist, the why stories, pricing, FAQ, the hero, the CSP, the install sections' text

## Problem

The per-agent tiles of [landing-motion-free-tier](../landing-motion-free-tier/spec.md) repeat one "Get started free" link ten times. The owner's words (2026-11-12, translated): he did not like the repetitive part; it should be official logos and a simple code to paste and start, so that getting started is easy.

## Goals

- One "Start in 30 seconds" block replaces the tile grid. A tablist shows each install-facet agent's official logo and name, in registry order, plus "Any MCP app". The selected tab shows a terminal-styled panel with the short command or paste-in that connects that agent, a Copy button and the personal link as a marked placeholder.
- Under the panel, three small steps (get your free link, paste this, your agent texts you on WhatsApp) and one primary "Get your free link" button to the join form, carrying `?agent=<id>`.
- The snippet comes from the agent registry: each agent's install facet gains `quickStart`. The commands the install sections already tell the agent to run are built by the same functions, and a registry check proves every install section contains its agent's quick start, so the two cannot drift.
- Logos are self-hosted SVGs under the site's static assets (CSP unchanged), from Simple Icons (CC0 data), with source and licence recorded in a notice beside them. An agent with no official mark in that source keeps the initials badge; nothing is drawn by hand.
- Server-rendered, no script needed: the tabs are links `/?agent=<id>&lang=…#start`; the selected tab follows `?agent`, the first agent by default. With script the switch is instant, the address is replaced and language and referral code are kept. Proper tablist keys: arrows, Home, End. No motion under reduced motion.
- Everything in `en_US` and `pt_BR`: copy, aria labels, `<Agent> logo` alt text, hints.

## Non-goals

- A real personal link in the snippet (accounts are created by the owner; the placeholder is `<your-link>`), a logo for an agent the source does not have, endorsement wording.

## Design

### Data flow

`AGENT_INSTALLS[id].quickStart({ locale, connectionLink })` returns `{ hint, code, proof }`. The site passes the localized placeholder as the link, tints the code by token kind (command, flag, key, string, table, placeholder) and renders one hidden panel per tab. `proof` is the text the install section must contain; `libs/agents` tests render each install section with a sentinel link and assert it holds `proof`.

### Failure handling

No script: the links navigate and the server renders the chosen panel. No clipboard API: the code is selected and the live region says so. Unknown `?agent`: the first agent.

## Open questions → answers

| Question | Options | Owner's answer | Date |
|----------|---------|----------------|------|
| Which source for logos? | Simple Icons (CC0 data), vendor press kits | Simple Icons, version 15.22 for the OpenAI mark (removed upstream later) and 16.37 for the rest | owner delegated 2026-11-12 |
| An agent without an official mark? | invent one, initials badge | initials badge | owner delegated 2026-11-12 |
| Where does the snippet live? | site copy, agent registry | agent registry, with a drift check | owner delegated 2026-11-12 |

## Test strategy summary

Unit: token highlighter, initials, quick start per agent and locale, install-section proof, logo files against `hasOfficialLogo`. Integration: the section, tabs, panels, `?agent`, paused page. E2E: both locales, both widths, tabs by click and keyboard, copy, reduced motion.
