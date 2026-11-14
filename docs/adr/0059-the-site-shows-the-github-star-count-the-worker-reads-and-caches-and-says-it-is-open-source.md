# 0059. The site shows the GitHub star count the Worker reads and caches, and says it is open source

- Status: Accepted
- Date: 2026-11-14
- Deciders: Dhyego Calota (owner); Claude (advisor)
- Inspired by: the owner's words of 2026-11-14 ("show the GitHub stars and make it clear it is open source, following the pattern of big projects"; "in pricing make it clear it is the Cloud version and that we only have a Brazilian number for now"); the repository going public under AGPL-3.0 with MIT clients ([ADR 0055](0055-contributions-come-under-a-contributor-license-agreement.md)); [ADR 0041](0041-the-public-site-is-served-by-the-api-worker-through-host-dispatch.md) and the strict policy of `site-policy.ts`; [ADR 0052](0052-structured-data-is-one-json-ld-graph-built-from-the-same-copy-and-constants-as-the-page.md)

## Context

The repository is public. Open source products (Supabase, Cal.com, PostHog, n8n) put a GitHub button with a live star count in the header, an "open source" signal near the hero and a short story of how the hosted version relates to the code. The site's policy allows no third-party script or image and no client-side request but the theme save, and the mobile budget forbids layout shifts. The unauthenticated GitHub API answers 60 requests an hour per address, and a Worker shares its egress addresses with other tenants, so a request can be refused at any time. The hosted service sends from one Brazilian number, and until now the copy said nobody could use their own number.

## Decision

1. **The Worker reads the count.** `repositoryStarsOf` asks `https://api.github.com/repos/dhyegocalota/zapbip` for `stargazers_count`, with a `User-Agent` and no token, under a two-second timeout. It keeps the count in the Cache API (`caches.default`, keyed by that address) for an hour, and keeps a failure (network, non-2xx status, malformed body or a count that is not a non-negative whole number) for five minutes so page views stop waiting on GitHub while it refuses; each failure is logged as `site.repository_stars_failed` with its reason. The constants live in `site-constants.ts`.
2. **No number is better than a wrong one.** A failure renders the button with the mark and the label "zapbip on GitHub" and no number, never zero or a guess; a real count of zero is shown as zero. The count is written in the page language's compact notation with Latin digits (`formatCompactCount`), and the accessible name carries the full count.
3. **Server-rendered, no shift.** The count is in the first HTML byte, so nothing moves after load; the number keeps a reserved width so a cached and a fresh page look alike. No client request, no third-party image: the GitHub mark is an inline SVG drawn once in the header and reused with `<use>`.
4. **Open source, said plainly.** The hero carries an "Open source · AGPL-3.0" badge linking the repository; a section after the pricing says the code is public, that anyone can host a copy with their own Meta app and numbers, and that zapbip Cloud runs the same code for them, linking the repository and the README's self-hosting section; the FAQ asks "Is zapbip open source?"; the footer links GitHub and the license.
5. **zapbip Cloud is the hosted version.** The pricing is labelled zapbip Cloud, says that for now it messages you from a Brazilian number (+55), and points to self-hosting for your own number. Owning a number is offered only through self-hosting.
6. **Structured data.** The home graph gains a `SoftwareSourceCode` node (`codeRepository`, `license` as the AGPL-3.0 text address, `isAccessibleForFree`, `programmingLanguage`, `targetProduct` pointing to the `WebApplication`), because schema.org defines `codeRepository` on source code, not on an application. `Organization.sameAs` stays empty: the repository is not the company's profile. The About facts gain a source line, so `llms.txt` and the Markdown twin say the same.

## Alternatives considered

| Option | Pros | Cons | Why not |
|--------|------|------|---------|
| Fetch the count in the browser | No server work | A third-party request the policy refuses, a layout shift, the visitor's address sent to GitHub | The policy and the budget forbid it |
| A shields.io badge image | One line | A third-party image, a font of its own, no language | The policy forbids external images |
| A token for the GitHub API | 5,000 requests an hour | A secret to manage for a public number | One request an hour per colo is far below the anonymous limit |
| Cache in D1 or KV, refreshed by the cron | One count everywhere | A table or namespace and a schedule for a decorative number | The Cache API is free and local to the colo |
| Show zero when the fetch fails | The button never changes width | A lie when the repository has stars | The decision is "no number", explicitly |
| `codeRepository` on the `WebApplication` | One node | Not a property of `WebApplication` in schema.org | Validators warn on it |

## Consequences

The first page view in a colo after the cache expires waits for GitHub up to two seconds, and up to five minutes of page views show no number after a failure. The site stylesheet budget of `docs/features/seo-speed/spec.md` moves from 60 KB to 62 KB uncompressed for the button, the badge, the section and the menu rules; the home page stays under 60 KB. The language menu now caps its height to the screen and takes two columns on short screens on every surface, which the menu rules of `web-shell.md` describe.

## Evidence

`apps/api/test/unit/repository-stars.test.ts`, `apps/api/test/unit/price-format.test.ts`, `apps/api/test/integration/site-open-source.test.ts`, `apps/api/test/unit/structured-data.test.ts`, `apps/api/test/unit/site-about-facts.test.ts`, `apps/api/test/unit/site-copy.test.ts`, `apps/api/test/integration/site-weight.test.ts`, `apps/api/e2e/landing/landing-open-source.spec.ts`, `apps/api/e2e/landing/landing-menu-fit.spec.ts`.

## Revisit when

The anonymous GitHub API starts refusing the Worker often enough that the button rarely has a number, the repository moves, the license changes, or zapbip Cloud gets a number outside Brazil.
