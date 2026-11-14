# Test plan: Agentic site

## The failing tests first

- [ ] `apps/api/test/unit/markdown-document.test.ts` — each block kind renders its Markdown
- [ ] `apps/api/test/unit/markdown-negotiation.test.ts` — `text/markdown` wins only when it outranks `text/html`
- [ ] `apps/api/test/integration/site-agentic.test.ts` — every route below answers 404 before the change

## Integration

- [ ] `/index.md`, `/pt-br.md`, `/terms.md`, `/privacy.md`, `/pt-br/termos.md`, `/pt-br/privacidade.md` answer `text/markdown` with the page's title and sections
- [ ] `GET /` with `Accept: text/markdown` answers Markdown; with `text/html`, `*/*` or no header answers HTML; both carry `Vary: Accept`
- [ ] Every HTML page head names its twin with `rel="alternate" type="text/markdown"`
- [ ] `/llms.txt` and `/pt-br/llms.txt` start with `# zapbip`, a blockquote and sections of links to the twins, the docs and the endpoints; `/llms-full.txt` holds the home and both legal documents; a locale added to `OwnerLocale` gets its pair
- [ ] `robots.txt` allows the AI crawlers by name and lists the llms files and the sitemap
- [ ] `/.well-known/mcp.json`, `mcp/server-card.json`, `agent-card.json` parse and point at `https://mcp.zapbip.com` and the docs; `security.txt` has Contact, Expires a year out, Policy, Preferred-Languages
- [ ] `GET /api/pricing` and `GET /api/quick-start` answer JSON in the requested language and `404` for an unknown agent
- [ ] `POST /api/request-access`: new email `200` and a row with source `agent` and no referrer; duplicate `200` with the same body and one row; bad email `422`; unknown language `422`; wrong content type `415`; broken JSON `400`; no address `400`; the fourth call from one address in a minute `429` with `Retry-After`; the third call for one email `429`; paused (no secret) `503` and no row; Turnstile is never called
- [ ] The form path still writes source `form`
- [ ] Semantic HTML: landmarks, labelled controls, `autocomplete`, `lang` on language options, error association

## E2E (Playwright)

- [ ] `landing-webmcp.spec.ts`: with a stub of `document.modelContext`, the four tools register; `request_access` creates a row with source `agent`; `get_pricing` and `get_quick_start` return data; `switch_language` lands on `/pt-br`; without the stub the page works and logs no error

## Edge cases

- [ ] Accept `text/markdown;q=0.1, text/html;q=0.9` answers HTML
- [ ] `/index.md` with `?ref=` keeps answering Markdown
- [ ] An email of 255 characters is refused `422`, never stored
- [ ] An email with upper case and spaces stores lowercase once
- [ ] The agent path never writes `referred_by` even when the body carries `referralCode`
