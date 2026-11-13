# Web shell

**Status:** Building
**Tier:** 🟡 medium
**Owner approval:** approved 2026-11-13 (owner delegated; the numbered requests are his words)
**ADRs:** none
**Not changing:** sign-in, sessions, CSRF and the Content-Security-Policy of the three hosts; the backoffice navigation and pages; account use cases

## Problem

The site, the customer app and the backoffice each drew their own header and footer. The app switched language with two text links in the header and had no theme switch; the backoffice kept two button groups in the header and a one-line footer; only the site had the flag menu in the footer. The app's signed-out page was a small card.

## Goals

1. One shell for three surfaces. The language menu (flags disclosure, `POST`, works without a script, opens upward from the footer), the theme switch (sun, moon, screen), the footer links and the tokens come from one neutral module, `apps/api/src/web-shell/`, that imports neither the backoffice nor the app.
2. Languages are data. The menu lists every `OwnerLocale` through `LOCALE_PROFILES` (language tag, short code, native name, docs path), so a new locale needs one profile and its copy, never a branch in a view.
3. The app and the backoffice get the compact footer (note, links to docs, terms, privacy and Logic Bit, language menu, theme switch). The app gains `POST /locale` and `POST /theme` (the `__Host-zb_app_theme` cookie) behind an `Origin` check; the backoffice keeps its own `POST /locale` and `POST /theme` behind the CSRF guard.
4. The app sign-in page is a hero: an eyebrow, the headline, one primary "Sign in with WhatsApp" link (the `wa.me` start link, unchanged), a trust line, an agents line that points at the docs, and a labelled phone mock of the `login` exchange drawn in HTML and CSS. No image, no script, no inline style, one stylesheet.
5. Agentic by construction: landmarks, a language on the document, every control named, the phone mock carries its meaning as text.

## Non-goals

New languages (lane L4a adds enum values and profiles). The site footer columns and wordmark stay site-only. No change to the sign-in flow.

## Design

`web-shell/` holds `LanguageMenu`, `ThemeSwitch`, `ShellControls`, `ShellFooter`, the flags and theme icons, `shell-copy.ts` (labels in `en_US` and `pt_BR`), `locale-profiles.ts`, `shell-theme.ts` and `assets/shell.css`. Each surface stylesheet is the shell stylesheet followed by its own (`withShellStylesheet`). `docsUrlOf` and `shellFooterLinksOf` read the site's address tables; the shell never reads the backoffice or the app. `tools/repository-shape/src/backoffice-isolation.test.ts` pins that and that agent-facing code never imports the shell.

## Failure modes

An unknown locale or theme in a preference post is ignored; a `returnTo` outside the allow-list lands on the home page; a post from another origin answers `403` in the app.
