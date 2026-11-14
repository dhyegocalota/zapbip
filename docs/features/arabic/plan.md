# Plan: Arabic

**Spec:** spec.md
**Tier:** 🔴 structural
**Seam:** the `OwnerLocale`, `WebLanguageTag` and `DocsPageLanguage` enums and every `Record` over them
**Assumptions (decided, owner can override):**
- Arabic ships with the English Meta template until the Arabic pair is approved.

## File map

| Group | Paths owned | Developer sub-agent |
|-------|-------------|---------------------|
| G1 | `libs/types`, `libs/core`, `libs/agents`, `apps/api`, `apps/docs`, `tools/repository-shape`, `docs/**` | `developer` |

## Sequencing

Enums first (the compiler lists the gaps), copy, right to left, media, docs, tests.

## Steps

### G1

- [x] **Step 1:** enums, calling codes, core copy and commands, install copy (`0f811682`)
- [x] **Step 2:** site, legal, app, backoffice, shell, flag, WhatsApp copy and templates (`7d44a9d5`)
- [x] **Step 3:** right to left, the Arabic demo and card, the agent docs tables (`ba6764a8`)
- [x] **Step 4:** the documentation (`ac2e0505`)
- [ ] **Step 5:** the `/ar` Playwright spec and the integration runs

## Failure modes

| Step | What breaks | How I notice (the concrete signal) | How I back out |
|---|---|---|---|
| 3 | A mirrored layout overflows at 360 px | `landing-arabic.spec.ts` | fix the rule, never `overflow-x: hidden` |
