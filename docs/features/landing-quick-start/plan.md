# Plan: Landing quick start

**Spec:** [spec.md](spec.md)
**Tier:** 🟡 medium
**Seam:** `libs/agents` (contract, install copy of every agent), `apps/api/src/site`, `apps/api/site-public/site/logos`.

## File map

| Group | Paths owned |
|-------|-------------|
| G1 | `libs/agents/src/contract.ts`, `libs/agents/supported/*/install.ts` and `install-copy.ts`, `libs/agents/src/quick-start.test.ts`, `apps/api/src/site/**`, `apps/api/site-public/site/logos/**`, `apps/api/test/**` for the site, `apps/api/e2e/landing/**`, this folder, `.claude/rules/site.md` |

## Steps

- [x] **Step 1:** Red tests: the registry proof, the token highlighter, the page section, the tabs e2e. Commit alone with stubs. — evidence: 8447f29a (red, stubs)
- [x] **Step 2:** `quickStart` and `hasOfficialLogo` on every install facet; the shared command builders used by the install copy. — evidence: 4cad4ff8, libs/agents/src/quick-start.test.ts
- [x] **Step 3:** Logos and their notice; the logo files test. — evidence: 2d0c25fb, test/unit/site-logos.test.ts
- [x] **Step 4:** Site context, copy, token highlighter, the quick start section replacing the tiles. — evidence: 2d0c25fb, site-page.test.ts
- [x] **Step 5:** Stylesheet and script: tabs, copy, panel. — evidence: 2d0c25fb, 39af43ce
- [x] **Step 6:** E2E for both locales and widths; rule, briefing. — evidence: landing-quick-start.spec.ts, 87 landing specs green

## Failure modes

| Step | What breaks | Signal | Back out |
|------|-------------|--------|----------|
| 2 | An install section's text changes | the install snapshot tests | the builders return the same strings; the snapshots pin them |
| 4 | Tab switch without script | the no-script walk | tabs are links; the server renders the selection |
| 5 | Logo unreadable on dark | the dark screenshots | logos sit on a white chip in both themes |

**Steps with no backout:** none; all code.
