# Legal pages

**Status:** Shipped 2026-11-13
**Tier:** 🟢 small
**Owner approval:** approved 2026-11-13 (owner request; decisions owner delegated)
**ADRs:** none new; reads [0041](../../adr/0041-the-public-site-is-served-by-the-api-worker-through-host-dispatch.md)
**Not changing:** the join route and Turnstile, the waitlist tables, the client app, the backoffice

## Problem

The owner's words (2026-11-13, translated): "make a simple terms of use and privacy page, since Logic Bit is from Brazil, but in both languages." The site linked its waitlist note only to the privacy band; there was no terms of use and no privacy policy, which Meta also asks for on a WhatsApp Business app.

## Goals

- **Two documents, two languages.** Terms of use at `/terms` and `/pt-br/termos`; privacy policy at `/privacy` and `/pt-br/privacidade`. Plain language, one page each, server-rendered by the site like the landing.
- **Brazilian law.** The privacy policy follows the LGPD (Law 13,709/2018): the controller and its contact, what is collected, the legal basis of each use (article 7), retention, sharing (Meta, Cloudflare, Mintlify), international transfer (article 33), cookies, the holder's rights (article 18) and the ANPD. The terms follow Brazilian law with Brazilian courts, keep the Consumer Defense Code rights, and say the Portuguese version prevails.
- **Facts from the code.** Company facts come from `COMPANY`, the Free allowance from `PRICING_FREE_MESSAGES`, retention from `QUEUE_RETENTION_MS`, `MEDIA_RETENTION_MS` and `CLIENT_APP_SESSION_TTL_MS` (moved to `libs/types` so the site can read it), the date from `LEGAL_UPDATED_ON`. Nothing promises a customer-owned number.
- **Links.** The site footer links both documents in the page language; the waitlist note links the privacy policy; the docs privacy page links both.
- **Twins.** The language menu and the theme switch return to the same document; canonical, hreflang (`x-default` = English) and the sitemap pair the twins.
- **Light pages.** No captcha script and no demo poster preload; the skip link goes to the content; the header join button goes to the form on the home page.

## Non-goals

- A cookie banner: the site sets no tracking cookie.
- A legal review: the text is a plain-language draft the owner can hand to a lawyer.
