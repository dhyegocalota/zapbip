# Test plan: A person presses the button

## Integration

- [x] `/?email=Maria@Example.com` opens the form with `maria@example.com`, in English and in Portuguese — evidence: `site-page.test.ts`
- [x] An invalid or hostile `email` value leaves the form empty and is never written raw into the page — evidence: same file
- [x] A filled page answers `private, no-cache` — evidence: same file
- [x] The home twin carries the join link and the instruction in both languages, and neither the twin nor `llms.txt` names `/api/request-access` — evidence: `site-agentic-twins.test.ts`
- [x] The landing page has no `id="agents"` section and does not mention WebMCP — evidence: same file
- [x] The agent card names `help_join` — evidence: `site-agentic-discovery.test.ts`

## Unit

- [x] `fill_join_form` fills the field, scrolls, focuses the button and makes no request; a page without the form answers `form_not_available` — evidence: `site-webmcp-script.test.ts`

## E2E

- [x] The landing spec calls `fill_join_form` and the field holds the address with the button focused and no waitlist row; `/?email=` opens a filled field — evidence: `landing-webmcp.spec.ts` (run by the e2e gate)
