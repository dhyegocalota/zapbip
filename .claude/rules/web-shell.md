---
paths:
  - "apps/api/src/web-shell/**"
---

# Shared web shell facts

Spec: `docs/features/web-shell/spec.md`.

- **One shell, three surfaces.** The site, the customer app and the backoffice draw the language menu, the theme switch and the footer parts from `apps/api/src/web-shell/`. The module imports neither the backoffice nor the app, and nothing under `apps/api/src/mcp`, `apps/api/src/routes`, `apps/api/src/account-inbox`, `apps/connector` or `libs/` imports it (`tools/repository-shape/src/backoffice-isolation.test.ts`). It reads the site's address tables (`legal-links.ts`, `site-paths.ts`) for the footer links.
- **Languages are data.** `locale-profiles.ts` holds one profile per `OwnerLocale` (language tag, Open Graph locale, Turnstile language, short code, native name, docs path) and `MENU_LOCALES` is its key order; `Record<OwnerLocale, …>` makes a new locale a type error until its profile, flag (`flags.tsx`, one inline SVG per language) and `shell-copy.ts` entries exist. No view branches on a locale.
- **The menu is a form.** `LanguageMenu` is a `<details>` of `POST` buttons with inline flags; `ThemeSwitch` is a form of three icon buttons with `aria-pressed`. Each surface passes its own action and hidden fields: the site and the app a `returnTo`, the backoffice the CSRF token and a `returnTo`. Both open and work with no script; the site script only upgrades them.
- **One stylesheet prefix.** `assets/shell.css` names no colour and no pixel value outside the tokens each surface defines; `withShellStylesheet` puts it in front of the stylesheet of each host, so the three serve the same menu, switch and compact footer rules.
- **Fonts.** The shell stylesheet holds the per-`:lang()` CJK font stacks and the Korean `word-break`; no web font ships.
- **The app's preferences.** `POST /locale` redirects to the page in the chosen language and `POST /theme` stores `__Host-zb_app_theme`; both need an `Origin` equal to `APP_ORIGIN` and rebuild the target from an allow-list (the home page or a well-formed sign-in link), never from the posted text.
