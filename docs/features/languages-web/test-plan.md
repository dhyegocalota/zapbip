# Test plan: Languages (web)

## The failing test first

- [ ] `apps/api/test/unit/site-language.test.ts` — input: `/es`, `/zh`, `Accept-Language: ja;q=0.4, ko;q=0.6`; expected before: no path, English
- [ ] `apps/api/test/unit/robots-and-sitemap.test.ts` — input: the sitemap; expected before: 6 locations, not 24
- [ ] `apps/api/test/unit/client-app-paths.test.ts` — input: `/de/agents`; expected before: English
- [ ] `apps/api/test/unit/{site,client-app,backoffice,legal}-copy*.test.ts`, `locale-profiles.test.ts` — input: the eight languages; expected before: `undefined` copy and profiles

## Integration

- [ ] Each of the eight paths answers 200 with its `<html lang>`, a canonical, the eight hreflang alternates and `x-default`, its Open Graph locale and seven alternates
- [ ] The sixteen legal pages answer in their language with the company data and the twin alternates
- [ ] `/` redirects by `Accept-Language` to each language, varying on the header; `zh-TW`, `ja;q=0`, `*` and an unknown language stay on English
- [ ] `POST /locale` to each language keeps the agent and the referral code
- [ ] The language menu lists eight options on every language page, the current one marked
- [ ] The app answers every prefix; the signed-out page shows the WhatsApp word of its owner language

## E2E and walks

- [ ] The menu opens and switches to each of the eight languages at 1440 and 375 on the site
- [ ] Screenshots of the Japanese, Chinese, Korean and German heroes at 375 show no clipped text and a CJK font
- [ ] The app signed-out page and the backoffice sign-in in a new language at 375
- [ ] The existing landing, app and backoffice walks stay green

## Edge cases

- [ ] `/zh/` answers 301 to `/zh` and keeps the query
- [ ] A cookie with `zh_CN` sends `/` to `/zh`; a cookie with `zh-CN` is ignored
- [ ] `/ja/terms` is the Japanese terms; `/ja/termos` is a 404
- [ ] A French page has no space before `: ; ? !` that can break the line
- [ ] Prices read in dollars on every page except Portuguese
