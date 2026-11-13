# Test plan: Site polish

## The failing test first

- [ ] `apps/api/test/integration/site-polish.test.ts` — input: GET `/`, `/pt-br`, `/terms`; expected before the change: the header holds `lang-menu`, the footer has no columns, the labels say "Get started free", the quick start shows `&lt;your-link&gt;`
- [ ] `apps/api/test/unit/code-tokens.test.ts::keeps an address whole as one url` — expected before: `plain` instead of `url`

## Integration

- [ ] The header has no language menu and the footer has exactly one, with the `/locale` form and the legal twin's return path
- [ ] The footer groups Product, Legal and Company with `#pricing`, `#start`, docs, support mailto and the Logic Bit link with `rel="noopener"`, in both languages, on the home and legal pages
- [ ] The footer wordmark is decorative text, no image, and the stylesheet fits it by viewport width
- [ ] The CTA says "Request access" / "Pedir acesso" on header, form, both pricing cards and the final call; the retired labels appear nowhere
- [ ] The example connection link matches the real secret pattern; the caption is present; `data-code` carries the same link
- [ ] The thank-you shows the early access confirmation with no invite link, meter, share or count; the FAQ drops the referral entry; the final call drops the invite button
- [ ] The dormant referral panel still renders link, copy, share, count and cap line (`site-referral-panel.test.ts`)
- [ ] Referral credit and cap still hold in the backend (`site-join.test.ts`)
- [ ] No pt-BR string contains "você toca" or "seu toque"
- [ ] `COMPANY.contactEmail` is `support@zapbip.com`; the old address is on no page

## E2E (Playwright specs)

- [ ] `landing-footer.spec.ts` — 1440 and 375: the footer menu opens upward, stays on screen, switches to `/pt-br`; the wordmark spans 80 to 100 percent of the container
- [ ] `landing-language.spec.ts` — keyboard, Escape, outside click, no-script and remembered language all work from the footer
- [ ] `landing-join.spec.ts`, `landing-cap.spec.ts` — the thank-you has no referral surface; cap and credits asserted from the database

## Prove it for real — Playwright MCP

- [ ] Footer at 375 and 1440, light and dark, en and pt-BR, reduced motion: wordmark whole, columns aligned, menu opens upward
- [ ] Quick start at 375 and 1440: the example link wraps, the caption is visible, Copy copies the full link
- [ ] Join flow: the thank-you panel is calm in both languages

## Edge cases found during execution

Empty on purpose.
