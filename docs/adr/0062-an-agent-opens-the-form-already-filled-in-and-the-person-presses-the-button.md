# 0062. An agent opens the form already filled in and the person presses the button

- Status: Accepted
- Date: 2026-11-14
- Deciders: Dhyego Calota (owner); Claude (advisor)
- Inspired by: [ADR 0044](0044-an-agent-requests-access-without-the-captcha-under-weighted-limits.md), whose captcha-free write path this removes; [ADR 0039](0039-the-public-waitlist-is-guarded-by-turnstile-and-fails-closed.md); the owner's words of 2026-11-14: the agent should tell the person to open the form already filled in and click, and text with technical terms such as POST should not be visible on the page

## Context

ADR 0044 let an agent add an address to the waitlist with `POST /api/request-access`, without Turnstile, under weighted limits and an hourly cap of 200 agent rows. Once the welcome email existed, every row also sent an email to an address the caller chose, so the endpoint could be used to send up to 200 emails an hour to strangers, and the cap itself let a flood lock honest agents out. The landing page also showed the endpoint, `POST` and a JSON body to every visitor.

## Decision

1. There is no captcha-free write path. `POST /api/request-access`, its weighted limits, its hourly row cap and its answers are removed.
2. The home page opens the join form with an address already in the field when the link carries `?email=<address>` (any language path, normalised like the form, an invalid value ignored, written into the page only through the escaped `value` attribute). The page stays `private, no-cache`. The person completes the captcha and presses the button.
3. The agent surface says so: the home twin and `llms.txt` tell an agent to open that link and ask the person to press the button; the agent card names a `help_join` skill; the WebMCP tool `request_access` becomes `fill_join_form`, which fills the field in the open page, brings the form into view and focuses its button, and makes no request.
4. The landing page carries no section written for agents. The Markdown twin, `llms.txt`, the discovery documents and WebMCP stay, because they are for machines.
5. `source = 'agent'` rows written before this stay labelled and filterable in the backoffice.

## Alternatives considered

| Option | Pros | Cons | Why not |
|--------|------|------|---------|
| Keep the endpoint with lower caps | An agent finishes alone | Still sends email to chosen strangers; a lower cap locks honest agents out sooner | The owner asked for a human click |
| Require a proof of work or a signed token | No human needed | Complexity and an arms race for a waitlist | A person pressing a button is the point of a waitlist |
| Pre-filled link, person presses the button | No new write path; reuses the form, Turnstile and limits | The agent cannot finish alone | Chosen |

## Consequences

The only way onto the waitlist is the form, with Turnstile. An agent saves the person the typing and the person adds one click. The migration `0013` column and the `agent` source label stay for old rows. The digest and the backoffice still handle `agent`.

## Evidence

`site-page.test.ts` (prefill, invalid value ignored, private cache), `site-agentic-twins.test.ts` (twin text, no section on the page), `site-webmcp-script.test.ts` and `landing-webmcp.spec.ts` (`fill_join_form`), `site-agentic-discovery.test.ts` (`help_join`).

## Revisit when

A verified-agent identity exists that a captcha-free path can rely on.
