# Test plan: Web shell

## The failing test first

- [ ] `apps/api/test/integration/web-shell.test.ts` — input: GET the site `/`, the app `/` and the backoffice `/sign-in`; expected before the change: no footer language menu on the app and the backoffice
- [ ] `apps/api/test/integration/client-app-preferences.test.ts` — input: `POST /locale` and `POST /theme` on the app; expected before: `404`
- [ ] `apps/api/test/integration/client-app-sign-in-page.test.ts` — input: GET `/` and `/pt-br` with an active start number; expected before: no phone mock

## Integration

- [ ] The three hosts draw the same menu and the same theme switch, every locale listed, in the footer
- [ ] Header, main and footer landmarks and a document language on each host
- [ ] No inline style, no inline script on any of them
- [ ] A hostile `returnTo` never leaves the app; an unknown locale or theme changes nothing; another origin is refused
- [ ] The app sign-in page has one primary link to `wa.me`, a labelled phone mock with the login word, the trust line and the agents line in both languages
- [ ] The site language menu, theme switch and footer tests stay green

## E2E and walks

- [ ] The landing walks stay green (language, theme, footer, legal)
- [ ] App signed-out page at 1440 and 375, light and dark, English and Portuguese; no horizontal overflow; reduced motion shows the finished chat
- [ ] Backoffice sign-in page: footer menu opens upward and switches language; theme persists
- [ ] The app footer on a signed-in page

## Edge cases

- [ ] A theme cookie with an unknown value renders `system`
- [ ] The sign-in token page keeps its token in the language form and returns to the same page in the other language
