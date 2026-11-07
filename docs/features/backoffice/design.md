# Backoffice: design

**Feature:** [backoffice](spec.md)
**Written by:** `frontend-designer`, plan step 0c
**Scope:** every page of `backoffice.zapbip.com` in phase 1 (PR A: shell, sign-in, numbers, audit, error pages; PR B: metrics).

## 0. Starting point

- There is no screen to walk or screenshot today. The backoffice is new, and the only server-rendered output in `apps/api` is `routes/install-page.ts`, which returns Markdown for an agent, not HTML for a person. Nothing on screen constrains this design.
- The visual language that exists is the documentation site: `apps/docs/docs.json` sets the Mintlify `mint` theme with one brand colour, `primary: #128C7E` (WhatsApp green). The backoffice reuses that hue so the two surfaces read as one product.
- No token file, no shared web components and no web rule exist yet. This document defines the first token set, as one stylesheet, `apps/api/src/backoffice/assets/backoffice.css`, served at `GET /assets/backoffice.css` ([spec → Interfaces](spec.md#interfaces)).
- The mockups are ASCII wireframes inside this file. No server runs in this step, so there are no screenshots; the Playwright MCP walk in the test plan captures the built pages at 1280 and 375 and compares them with these wireframes.

## 1. Constraints that shape every page

These come from the CSP in the spec: `default-src 'none'; style-src 'self'; img-src 'self'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'`.

| Constraint | Consequence |
|---|---|
| No script | No client validation beyond HTML attributes, no confirm dialogs, no menu toggles, no countdowns, no copy-to-clipboard. Every action is a plain form with POST, 303, GET. |
| `style-src 'self'` | No `style=""` attribute, no `<style>` element. All presentation is classes from `backoffice.css`. Chart geometry is SVG attributes (`x`, `width`, `height`), which are not styles. |
| `font-src` absent | No web fonts. System font stacks only. The docs' Inter cannot load, and the stack is chosen to look close. |
| `img-src 'self'` | No external images. Icons are inline SVG or text glyphs. No QR code is shown in the browser (enrollment is terminal-only). |
| `Cache-Control: no-store`, `Referrer-Policy: same-origin` | No flash cookie and no Referer leaves the site; `no-referrer` would make the browser send `Origin: null` on every form post, which the CSRF check refuses. A flash message is an allow-listed `notice` query value on the redirect target, and a rejected form is POST, `303`, GET: the rejection (status, copy keys, field errors, non-secret values) waits in `backoffice_sessions.flash` for one minute and is shown once, by the GET of the same path; return-after-locale-switch uses an allow-listed `returnTo` path in a hidden field. |
| Strict CSRF | Every form carries the hidden `csrf` field. Every state-changing number form also carries the step-up `code` field. |

## 2. Tokens

Every value below is a CSS custom property declared once in `:root` of `backoffice.css`; no component states a raw colour, length or font. The set is new, so by the harness rule each addition is a decision: recorded in section 8 as chosen under "owner delegated 2026-11-06".

### 2.1 Colour (light first, dark by token switch)

Dark mode is `@media (prefers-color-scheme: dark)` redefining the same properties. No component has a dark-specific rule.

| Token | Light | Dark | Use | Contrast (light / dark) |
|---|---|---|---|---|
| `--color-page` | `#F4F7F6` | `#0F1715` | page background | n/a |
| `--color-surface` | `#FFFFFF` | `#17211F` | cards, tables, inputs | n/a |
| `--color-text` | `#1B2321` | `#E6EDEB` | body and headings | 16:1 / 15.6:1 on page |
| `--color-text-muted` | `#4A5552` | `#A9B6B3` | help text, captions, table headers | 7.7:1 / 8.8:1 |
| `--color-border` | `#C5CFCC` | `#2E3C39` | decorative dividers only | decorative, no text on it |
| `--color-border-control` | `#6F7B78` | `#7F8F8B` | input, select, checkbox borders | 4.4:1 / 4.9:1 (needs 3:1) |
| `--color-brand` | `#128C7E` | `#128C7E` | brand mark, chart bars, active-nav underline | 4.1:1 on white, used only for non-text (needs 3:1) |
| `--color-action` | `#0B6B60` | `#4FD1BF` | links, primary button fill, success text | 6.4:1 / 10:1 |
| `--color-on-action` | `#FFFFFF` | `#06231F` | text on a primary button | 6.4:1 / 9.2:1 |
| `--color-danger` | `#A32D2D` | `#FF9C9C` | danger text, danger button fill, error borders | 7.1:1 / 8:1 |
| `--color-danger-surface` | `#FDECEC` | `#3A1E1E` | error notice background | text on it 6.2:1 / 9:1 |
| `--color-warning` | `#7A4E00` | `#F2C46D` | warning text | 7.2:1 / 10:1 |
| `--color-warning-surface` | `#FFF4D6` | `#3A2E12` | warning notice background | 6.6:1 / 9.5:1 |
| `--color-info-surface` | `#E3F1EF` | `#173330` | info and success notice background | `--color-text` on it 13:1 / 12:1 |
| `--color-focus` | `#1A56DB` | `#8AB4FF` | 3 px focus outline | 6.2:1 / 9:1 against surface |

The brand `#128C7E` fails 4.5:1 as text on white (4.1:1), so it is never used for text or for a button that carries text. `--color-action` is its darkened sibling for those roles. This is the one place the docs' colour is adapted, and it is option 7 in section 7.

### 2.2 Type

| Token | Value |
|---|---|
| `--font-sans` | `system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif` |
| `--font-mono` | `ui-monospace, SFMono-Regular, Menlo, Consolas, monospace` (identifiers, display numbers, codes) |
| `--text-small` | `0.875rem` / line `1.4` (captions, table cells on desktop) |
| `--text-body` | `1rem` / line `1.5` (default; inputs are never below this, so iOS does not zoom) |
| `--text-heading-3` | `1.125rem`, weight 600 |
| `--text-heading-2` | `1.375rem`, weight 600 |
| `--text-heading-1` | `1.75rem`, weight 700 |
| `--text-figure` | `2rem`, weight 700, tabular numerals (metric headline numbers) |

Sizes are `rem`, so the browser's text size setting scales everything. Text is never set to fixed `px`.

### 2.3 Space, radius, size, motion

| Token | Value |
|---|---|
| `--space-1` .. `--space-8` | `0.25rem`, `0.5rem`, `0.75rem`, `1rem`, `1.5rem`, `2rem`, `3rem`, `4rem` |
| `--radius-control` | `0.375rem` (inputs, buttons, badges) |
| `--radius-card` | `0.625rem` |
| `--size-tap` | `2.75rem` (minimum height of any button, input, select, link in a nav) |
| `--size-focus-ring` | `3px` outline, `2px` offset |
| `--measure-page` | `72rem` (maximum content width; a token, not a fixed pixel container) |
| `--measure-form` | `32rem` (maximum form width) |
| `--breakpoint-narrow` | `40rem`, written literally in the one `@media (max-width: 40rem)` block, because custom properties cannot be used in media queries |
| Motion | none. No transition or animation anywhere, so `prefers-reduced-motion` needs no handling. |

### 2.4 Open token questions

None. Every value above is chosen in section 8.

## 3. Components

New components, all under `apps/api/src/backoffice/components/` as Hono JSX function components. There are no shared web components in the repository, so each is new and justified by two or more pages.

| Component | Used by | Notes |
|---|---|---|
| `PageShell` | every page | `<html lang>` from the locale, `<link rel="stylesheet" href="/assets/backoffice.css">`, skip link, header, `<main id="content">`. Signed-out pages use the same shell with the nav hidden. |
| `PrimaryNav` | signed-in pages | `<nav aria-label>` with Home, Numbers, Metrics, Audit. The current page carries `aria-current="page"` and a 3 px `--color-brand` underline (not colour alone: the label is also bold). |
| `LocaleSwitch` | header | A `POST /locale` form with two submit buttons, `Português` (`lang="pt-BR"`) and `English` (`lang="en"`), the active one `aria-pressed="true"` and bold. Hidden `returnTo`. |
| `SignOutButton` | header | `POST /sign-out` form, secondary button. |
| `Notice` | all | Variants `info`, `success`, `warning`, `error`. A visible text label ("Success", "Warning", "Error") and a glyph precede the message, so colour is never the signal. `error` and `warning` carry `role="alert"`; `info` and `success` carry `role="status"`. |
| `Field` | forms | Visible `<label for>`, optional help text linked by `aria-describedby`, optional error text linked the same way plus `aria-invalid="true"`. |
| `CodeField` | sign-in, every step-up | `Field` with `name="code"`, `inputmode="numeric"`, `autocomplete="one-time-code"`, `pattern="[0-9]{6}"`, `maxlength="6"`, mono font, help "6 digits from your authenticator". |
| `SecretField` | key, tokens, app secret | `type="password"`, `autocomplete="off"` (the backoffice key uses `current-password` so a password manager can fill it), `spellcheck="false"`, `autocapitalize="off"`. Never pre-filled. |
| `CredentialStatus` | number detail | The "set, last changed <date>" line. It never renders a value, a mask or a length. |
| `Button` | forms | Variants `primary`, `secondary`, `danger`. All use `<button type="submit">` with a text label. `danger` is never colour alone: its label states the effect ("Disable number"). |
| `StateBadge` | numbers list, detail | Text label always shown, with a glyph: `pending` (hollow circle), `active` (check), `closed` (half circle), `disabled` (cross). Background tone is secondary reinforcement. |
| `DataTable` | numbers, audit | A real `<table>` with `<caption>` (visually hidden), `<th scope>`; at 375 each row becomes a stacked block and each cell shows its header through `td::before { content: attr(data-label) }`. No horizontal scroll. |
| `KeyValueList` | number detail, verify result | `<dl>` of label and value pairs. |
| `Card` | home, metrics, forms | `<section aria-labelledby>` with an `<h2>`. |
| `FigureNumber` | metrics | A big number plus its label and an optional freshness line. |
| `BarChart` | metrics | Inline SVG, `role="img"` with `<title>` and `<desc>` summarising the data, bars drawn as `<rect>` with classes; followed by a native `<details><summary>Show values</summary>` holding the same data as a `<table>`. See 4.8. |
| `BudgetBar` | metrics | A single horizontal SVG bar with a labelled threshold tick and a text status. |
| `FilterForm` | metrics | A `GET` form: number `<select>`, period `<select>`, an "Apply" button. |
| `Timestamp` | tables, detail | `<time datetime>` rendered `YYYY-MM-DD HH:mm UTC` in both locales (unambiguous, no month names to translate). |
| `ErrorPage` | 401, 403, 404, 429, 500, 503 | Title, one sentence, one next action, status code shown as text. |

Reuse from existing code: none for markup (no web UI exists). Copy follows the `renderCopy` pattern in `OwnerLocale`-keyed records; locale resolution is the spec's. Status numbers use the existing `HttpStatus` enum (`apps/api/src/routes/http-status.ts`).

## 4. Screens and states

Common to all: `<html lang="pt-BR">` or `lang="en"`; one `<h1>` per page; the page `<title>` is "`<page> · zapbip backoffice`"; the layout wireframes use `[ ]` for controls and `|` for the stacked layout rules.

**Loading state.** Without script there is no spinner. A submitted form shows the browser's native loading indicator, and every submit button is a single press because the step-up code is single-use (a double submit is refused as a replayed code). This applies to every screen, so it is not repeated below.

**Overloaded state.** A page is overloaded in one of two ways: the sign-in rate limit (429, see 4.10) or a failing dependency (500, see 4.10). No other page has a degraded mode: a metrics page runs one D1 batch, so it renders fully or answers 500.

### 4.1 Shell (header and footer)

```
1280
+--------------------------------------------------------------------------------+
| [skip to content]                                                              |
| zapbip backoffice   Home  Numbers  Metrics  Audit      [Português][English] [Sair]|
+--------------------------------------------------------------------------------+
| <main> max --measure-page, centred, padding --space-6                          |

375
+-------------------------------+
| [skip to content]             |
| zapbip backoffice             |
| Home Numbers Metrics Audit    |   nav wraps, each link 44px tall
| [Português][English]  [Sair]  |
+-------------------------------+
| <main> padding --space-4      |
```

- States: signed in (nav and sign-out), signed out (brand and locale switch only).
- Environment marker: staging shows the badge text "STAGING" beside the brand; development shows "DEVELOPMENT"; production shows nothing. The text is mandatory (not colour), so a staging page is never mistaken for production. Copy keys `EnvironmentStaging`, `EnvironmentDevelopment`.
- Accessibility: focus order is skip link, brand, nav links, locale buttons, sign out, then `<main>`. The skip link is the first focusable element and is visible on focus. Sign-out announces "Sign out". Both locale buttons announce their language name and pressed state.
- The footer holds one line, the product name and the environment, in `--color-text-muted`.

### 4.2 Sign-in (`GET/POST /sign-in`)

```
1280                                         375
+-------------------------------------+      +-----------------------------+
|        zapbip backoffice            |      | zapbip backoffice           |
|   +-----------------------------+   |      | [Português][English]        |
|   | Sign in                     |   |      | +-------------------------+ |
|   | [!] Sign-in failed. ...     |   |      | | Sign in                 | |
|   | Backoffice key              |   |      | | [!] Sign-in failed ...  | |
|   | [************************]  |   |      | | Backoffice key          | |
|   | Authenticator code          |   |      | | [********************]  | |
|   | [______]                    |   |      | | Authenticator code      | |
|   | [ Sign in ]                 |   |      | | [______]                | |
|   +-----------------------------+   |      | | [ Sign in ]  full width | |
+-------------------------------------+      +-------------------------+ ---+
```

The card is centred, `--measure-form` wide, vertically near the top. Nav is hidden; the locale switch stays.

| State | What shows | Status |
|---|---|---|
| Default | Title, two fields, one button | 200 |
| Failure | An `error` Notice above the fields: one generic message, identical for wrong key, wrong code, reused code, expired code and active lockout. Fields are cleared. The key field is not re-filled. | 401 |
| Rate limited | The 429 page (4.10) | 429 |
| Locked | Indistinguishable from Failure by design. The page never says "locked", so a locked operator learns nothing. | 401 |
| Already signed in | Redirect to `/` | 303 |
| Session expired | Same as Default plus an `info` Notice "Your session ended. Sign in again." (`?notice=SessionEnded`) | 200 |
| Success | Redirect to `/` | 303 |

- Components: `PageShell`, `Card`, `Notice`, `SecretField`, `CodeField`, `Button` primary.
- Tokens: `--color-surface` card, `--radius-card`, `--space-5` padding, `--measure-form`, `--text-heading-2` title.
- Accessibility: focus lands first on the key field (`autofocus`). Tab order: key, code, Sign in. Labels are visible and associated. Enter submits from either field. The failure Notice is `role="alert"`, so a screen reader announces it on load. Hidden `csrf` field carries no label. The error is never colour alone: it starts with the word "Error".
- Copy keys: `SignInTitle`, `SignInKeyLabel`, `SignInKeyHelp`, `SignInCodeLabel`, `SignInCodeHelp`, `SignInSubmit`, `SignInFailed`, `SessionEndedNotice`.

### 4.3 Home (`GET /`)

```
1280
+----------------------------------------------------------------+
| Overview                                                       |
| +-------------+ +-------------+ +--------------------------+   |
| | Numbers     | | Metrics     | | Audit log                |   |
| | 2 active    | | accounts,.. | | newest entries           |   |
| | 1 pending   | | [Open]      | | [Open]                   |   |
| | [Manage]    | +-------------+ +--------------------------+   |
| +-------------+                                                |
375: the three cards stack, one per row.
```

| State | What shows |
|---|---|
| No numbers | A `warning` Notice "No number is registered. The channel cannot receive or send until one is active." with a primary button "Register a number". The Numbers card is replaced by this notice. |
| One or more | The Numbers card lists a count per state (`active`, `closed`, `pending`, `disabled`), each with its badge and count, and a "Manage numbers" link. |
| After sign-in, sign-out | A `success` or `info` Notice from `notice=` (`SignedOut` on the sign-in page). |

- Components: `Card`, `StateBadge`, `Notice`, `Button`.
- Accessibility: each card is a `<section>` with its `<h2>`; the link text is specific ("Open metrics", "Open audit log"), not "Open".
- Copy keys: `HomeTitle`, `HomeNumbersTitle`, `HomeNoNumbersWarning`, `HomeRegisterNumber`, `HomeManageNumbers`, `HomeMetricsTitle`, `HomeMetricsLink`, `HomeAuditTitle`, `HomeAuditLink`.

### 4.4 Numbers list (`GET /numbers`)

```
1280
+------------------------------------------------------------------------------------+
| Numbers                                                    [ Register a number ]   |
| +--------------------------------------------------------------------------------+ |
| | Label   | Display number   | State      | Meta app | Accounts | Verified | Upd. | |
| | Brazil  | +55 11 91234-... | (v) Active | Main app |       38 | 2026-11  | ...  | |
| +--------------------------------------------------------------------------------+ |

375 (each row becomes a block)
+-------------------------------+
| Numbers                       |
| [ Register a number ] full    |
| +---------------------------+ |
| | Brazil          (v) Active| |
| | Display number  +55 11 .. | |
| | Meta app        Main app  | |
| | Accounts        38        | |
| | Verified        2026-11-07| |
| | [View Brazil]             | |
| +---------------------------+ |
```

The label cell is a link to `/numbers/:numberId`; its accessible name is the label, and at 375 an explicit "View <label>" link is shown so the target is at least 44 px tall.

| State | What shows |
|---|---|
| Empty | A card: title "No numbers yet", one sentence that explains the consequence ("Nothing is received or sent until you register and activate a number"), and the primary button "Register a number". No table, no header row. |
| One | The table with one row. Under it, if the number is `pending`: a `warning` Notice "This number is not verified yet. Verify it, then activate it." |
| Many | The table, ordered `active`, `closed`, `pending`, `disabled`, then label. No pagination in phase 1: the registry is small by nature (a handful of numbers). If it ever exceeds 100 rows the page still renders, and pagination is a phase 2 item recorded in the plan risks. |
| Notice | After register or state change, a `success` Notice from `notice=`. |
| Error | The 500 page. |

Columns: Label, Display number (mono), State (`StateBadge`), Meta app (its label), Accounts (count bound to this number), Verified (date or "Not verified"), Updated. Credential material is never a column.

- Accessibility: `<caption>` "WhatsApp numbers" (visually hidden); `th scope="col"`; the State column is text plus glyph; numeric column right-aligned on desktop; sorted order is stated in the caption ("sorted by state, then label").
- Copy keys: `NumbersTitle`, `NumbersCaption`, `NumbersRegister`, `NumbersEmptyTitle`, `NumbersEmptyBody`, `NumbersColumnLabel`, `NumbersColumnDisplayNumber`, `NumbersColumnState`, `NumbersColumnMetaApp`, `NumbersColumnAccounts`, `NumbersColumnVerified`, `NumbersColumnUpdated`, `NumbersNotVerified`, `NumbersView` (with `{label}`), `NumbersPendingWarning`, `StatePending`, `StateActive`, `StateClosed`, `StateDisabled`.

### 4.5 Register a number (`GET/POST /numbers/new`)

One form, two fieldsets, in this order so the operator follows Meta's own hierarchy (app, then number).

```
1280 (form is --measure-form wide, left aligned under the heading)
+---------------------------------------------+
| Register a number                            |
| [!] Error summary (when invalid)             |
| Meta app                                     |
|  Meta app   [ Add a new Meta app        v ]  |
|  -- Only when adding a new Meta app --       |
|  Meta app ID        [____________]           |
|  Meta app label     [____________]           |
|  App secret         [************]           |
| Number                                       |
|  Phone number ID    [____________]           |
|  WABA ID            [____________]           |
|  Display number     [+__________]            |
|  Label              [____________]           |
|  Access token       [************]           |
| Confirm                                      |
|  Authenticator code [______]                 |
|  [ Register number ]   Cancel                |
+---------------------------------------------+
375: identical order, one column, buttons full width, Cancel under the button.
```

| State | What shows | Status |
|---|---|---|
| Default | The form. The Meta app select lists existing apps by label, then "Add a new Meta app" last. With no apps yet, the select has only that option and the new-app fieldset is the whole first section. | 200 |
| Invalid input | An `error` Notice listing each problem as a link to its field (anchors, native), the offending fields marked `aria-invalid`, non-secret fields kept, `token`, `app secret` and `code` cleared. | 422 |
| Duplicate | Same page, field error on the duplicated field ("This phone number ID is already registered"). The message names the field, never whose it is. | 422 |
| Code not accepted | `error` Notice "Code not accepted. Wait for the next code and try again." Everything else kept except secrets. | 401 |
| Session ended | Redirect to `/sign-in?notice=SessionEnded` | 303 |
| CSRF or origin failure | The 403 page | 403 |
| Success | Redirect to `/numbers/:numberId?notice=Registered`. The first number also states "Existing accounts without a number were bound to it." only when the backfill ran (a `notice=RegisteredWithBackfill` value). | 303 |

- The new-app fields sit in a `<fieldset>` whose `<legend>` says it only applies when "Add a new Meta app" is selected. Without script they cannot be hidden; the legend carries the rule and the server ignores them when an existing app is chosen.
- Validation the server states in copy: phone number ID and WABA ID are digits; display number is E.164 (`+` then digits); label is 1 to 60 characters; access token and app secret are not empty.
- Help text for each ID names where it is in Meta ("Meta app dashboard, Settings, Basic", "WhatsApp, API Setup").
- Accessibility: labels are visible; the select has a label; the access token and app secret are `SecretField`; focus order is top to bottom as drawn; Cancel is a link that follows the button in the DOM; the submit button's label is "Register number" (not "Submit"). After a 422 the error Notice is first in `<main>`, so it is announced and is the first thing a keyboard user reaches.
- Copy keys: `RegisterTitle`, `RegisterMetaAppLegend`, `RegisterMetaAppLabel`, `RegisterMetaAppAddNew`, `RegisterNewAppLegend`, `RegisterNewAppHelp`, `RegisterMetaAppIdLabel`, `RegisterMetaAppIdHelp`, `RegisterMetaAppNameLabel`, `RegisterAppSecretLabel`, `RegisterAppSecretHelp`, `RegisterNumberLegend`, `RegisterPhoneNumberIdLabel`, `RegisterPhoneNumberIdHelp`, `RegisterWabaIdLabel`, `RegisterWabaIdHelp`, `RegisterDisplayNumberLabel`, `RegisterDisplayNumberHelp`, `RegisterLabelLabel`, `RegisterAccessTokenLabel`, `RegisterAccessTokenHelp`, `RegisterConfirmLegend`, `RegisterSubmit`, `RegisterCancel`, `ErrorSummaryTitle`, `FieldErrorRequired`, `FieldErrorDigits`, `FieldErrorDisplayNumber`, `FieldErrorLabelLength`, `FieldErrorDuplicate`, `StepUpRejected`.

### 4.6 Number detail (`GET /numbers/:numberId`) and its actions

This page holds four independent forms. Each is a separate `<section>` with its own heading and its own step-up code, because a code is single-use.

```
1280                                              375
+---------------------------------------+         +-----------------------------+
| < Numbers                              |         | < Numbers                   |
| Brazil            (v) Active           |         | Brazil      (v) Active      |
| [Notice from ?notice=]                 |         | [Notice]                    |
| Summary (dl)                           |         | Summary (dl, stacked)       |
|  Display number   +55 11 91234-5678    |         | ...                         |
|  Phone number ID  1000000000000001     |         |                             |
|  WABA ID          2000000000000002     |         |                             |
|  Meta app         Main app             |         |                             |
|  Access token     Set, changed 11-07   |         |                             |
|  App secret       Set, changed 11-07   |         |                             |
|  Verified         2026-11-07 14:32 UTC |         |                             |
| 1. Verify with Meta   [code][Verify]   |         | each form: full width       |
| 2. Change state       (radios)[code][..]|         |                             |
| 3. Replace access token [token][code]  |         |                             |
| 4. Replace app secret [secret][code]   |         |                             |
+---------------------------------------+         +-----------------------------+
```

Phone number ID and WABA ID are internal identifiers of the operator's own numbers, so the operator sees them. They are never in a log, a metrics page or an MCP result (spec → Logs). Credentials are shown only as `CredentialStatus`.

| State | What shows |
|---|---|
| `pending`, not verified | Summary; a `warning` Notice "Verify this number before activating it."; the verify form; the state form shows no target and the visible reason "Verify the number first." in place of the radios; rotate forms present. |
| `pending`, verified | The state form offers `active`. |
| `active` | The state form offers `closed` and `disabled`. |
| `closed` | The state form offers `active` and `disabled`. |
| `disabled` | A `warning` Notice "This number is disabled: inbound is ignored and sends are refused."; the state form offers `closed`. Verify and rotate remain available. |
| Unknown ID | The 404 page. |
| Notice | `Registered`, `Verified`, `AccessTokenReplaced`, `AppSecretReplaced`, `StateChanged`: `success` Notices. |
| Action failure | The page re-renders with 401 (code not accepted) or 422 (invalid input) and an `error` Notice at the top; the form that failed keeps its non-secret input. |

**Verify form.** Fields: `CodeField`. Button: "Verify with Meta". The POST stores the outcome in `verification_snapshot` and answers `303` to `GET /numbers/:numberId/verification` (4.7), like every other action.

**State form.** A `<fieldset>` with `<legend>` "Change state", one radio per allowed target (label states the effect: "Active: receives, sends and accepts new accounts"; "Closed: receives and sends, accepts no new accounts"; "Disabled: ignores inbound and refuses sends"), then `CodeField` and the button "Change state". `disabled` additionally needs a required checkbox "I understand this stops this number completely" (option 4). With no allowed target the fieldset shows the reason text and no button.

**Rotate forms.** "Replace access token": `SecretField`, `CodeField`, button "Replace access token". "Replace app secret": the section explains that the secret belongs to the Meta app and affects every number of that app (names the other numbers by label), `SecretField`, `CodeField`, button "Replace app secret". Posts to `/meta-apps/:metaAppId/app-secret`.

- Accessibility: the breadcrumb link "Numbers" is first in `<main>`; the four sections are `<section aria-labelledby>` in the order drawn, and the in-page order is the visual order. Radios are inside a `<fieldset>`; a disabled option is never rendered as a disabled control without text: a state with no allowed target replaces the control with a sentence. Credentials are announced "set, last changed 2026-11-07", never as dots.
- Copy keys: `NumberBack`, `NumberSummaryTitle`, `NumberDisplayNumber`, `NumberPhoneNumberId`, `NumberWabaId`, `NumberMetaApp`, `NumberAccessToken`, `NumberAppSecret`, `NumberVerifiedAt`, `NumberNeverVerified`, `CredentialSet` (with `{date}`), `NumberAccountsBound`, `NumberVerifyTitle`, `NumberVerifyBody`, `NumberVerifySubmit`, `NumberStateTitle`, `NumberStateLegend`, `NumberStateOptionActive`, `NumberStateOptionClosed`, `NumberStateOptionDisabled`, `NumberStateNoTarget`, `NumberStateDisabledConfirm`, `NumberStateSubmit`, `NumberDisabledWarning`, `NumberRotateTokenTitle`, `NumberRotateTokenLabel`, `NumberRotateTokenSubmit`, `NumberRotateSecretTitle`, `NumberRotateSecretBody` (with `{labels}`), `NumberRotateSecretLabel`, `NumberRotateSecretSubmit`, `NoticeRegistered`, `NoticeRegisteredWithBackfill`, `NoticeVerified`, `NoticeAccessTokenReplaced`, `NoticeAppSecretReplaced`, `NoticeStateChanged`, `StepUpRejected`.

### 4.7 Verify result (`GET /numbers/:numberId/verification`, 200, reached by `303` from `POST /numbers/:numberId/verify`)

```
1280 and 375 (single column, --measure-form)
+---------------------------------------+
| Verification result: Brazil            |
| [OK] Verified. Display number matches. |
| Meta reports                           |
|  Verified name   Logic Bit             |
|  Quality rating  GREEN                 |
| Templates                              |
| +-----------------------------------+  |
| | Name                 | pt_BR | en_US |  (stacked at 375)
| | zapbip_agent_notice  | Approved | Pending |
| | zapbip_agent_question| Approved | Missing |
| +-----------------------------------+  |
| [!] Out-of-window notices will fail    |
| [ Back to Brazil ]                     |
+---------------------------------------+
```

| State | What shows |
|---|---|
| Verified, all four templates approved | `success` Notice; the template table; no warning. |
| Verified, a template not approved or missing | `success` Notice plus a `warning` Notice "Out-of-window notices will fail until the templates are approved. You can still activate the number." Each cell reads `Approved`, `Pending`, `Rejected` or `Missing`, text first, with a glyph. |
| Display number differs | `error` Notice "The number Meta reports does not match the registered display number." Shows both numbers (digits only). `verified_at` unchanged. |
| Graph failure | `error` Notice with the kind only: `auth` ("Meta refused the access token"), `not_found` ("Meta does not know this phone number ID"), `network` ("Could not reach Meta; try again"), `upstream` ("Meta answered with an error; try again later"). Never a response body. |
| Never verified | Unknown ID or no `verification_snapshot`: the 404 page. |
| Code not accepted | The number detail page with a 401 `error` Notice. |

Reloading is safe: it repeats a GET and shows the stored snapshot, with the line "Checked <date>" (`VerifyCheckedAt`). The page always offers the "Back to <label>" link.

- Accessibility: the template table has a caption, `th scope`, and a text cell per status; the result Notice is `role="status"` for success and `role="alert"` for errors; focus order is Notice, tables, button.
- Copy keys: `VerifyResultTitle` (with `{label}`), `VerifyOk`, `VerifyMismatch`, `VerifyErrorAuth`, `VerifyErrorNotFound`, `VerifyErrorNetwork`, `VerifyMetaReports`, `VerifyVerifiedName`, `VerifyQualityRating`, `VerifyTemplatesTitle`, `VerifyTemplateName`, `VerifyTemplateStatusApproved`, `VerifyTemplateStatusPending`, `VerifyTemplateStatusRejected`, `VerifyTemplateStatusMissing`, `VerifyTemplatesWarning`, `VerifyCheckedAt`, `VerifyBack` (with `{label}`), `VerifyExpectedNumber`, `VerifyReportedNumber`, `VerifyErrorUpstream`.

### 4.8 Metrics (`GET /metrics`, PR B)

```
1280
+------------------------------------------------------------------------+
| Metrics            Number [All v]  Period [30 days v]  [Apply]          |
| Updated hourly: messages, templates, failures, wake, budget.            |
| +--------+ +--------+ +--------+ +--------+     <- FigureNumber row     |
| |Accounts| |Agents  | |Agents  | |Blocked |                             |
| |   38   | |active  | |connect.| |phones 2|                             |
| +--------+ +--------+ +--------+ +--------+                             |
| Accounts            (card)  by state (table) | per number (table)       |
| New accounts / day  (BarChart + Show values)                            |
| Agents              by client (table) | created and revoked / day (chart)|
| Messages            in and out / day (BarChart, two series)             |
| Template sends      notice and question (table by day)                  |
| Send failures       / day (BarChart)                                    |
| Wake success        % per day (BarChart) + overall figure               |
| Durable Object budget  (BudgetBar) used / 13 000 gigabyte-seconds       |
| Restricted numbers  (table)                                             |

375: filter controls stack (labels above), figure cards 2 per row, then one card
per row; charts scale to the width; no horizontal scroll.
```

| State | What shows |
|---|---|
| Populated | All cards. Today's row of an hourly metric reads "updates hourly". |
| Empty (no accounts, no activity yet) | Each card renders its own empty text ("No data yet") and the figures read `0`. Charts are replaced by that text, never an empty axis. |
| One number selected | Cards show that number only; "Accounts per number" collapses to one row. |
| Many | Charts show up to 30 bars; the numeric table holds the exact values. |
| Budget below 80% | `BudgetBar` in `--color-brand`, status text "Within budget". |
| Budget at or above 80% (`isBudgetWarning`) | Bar in `--color-warning`, hatched fill (an SVG pattern), status text "Warning: above 80% of the daily budget", and the 80% threshold tick labelled. A legend line explains the hatch. |
| Query failure | The 500 page. |

Chart rules:

- Bars are SVG `<rect>` with a class; a bar's height is an attribute computed server-side. Two-series charts (messages in and out) use `--color-brand` and `--color-action` and differ by pattern (solid and hatched), and a legend with the series names, so the series are not told apart by colour alone.
- Each chart is `role="img"`, with a `<title>` ("New accounts per day, last 30 days") and a `<desc>` giving the range and the total. Right under it, `<details><summary>Show values</summary>` holds the exact data as a table. Both are native and need no script.
- Axes: a baseline and the maximum value as text; no gridlines. Day labels every seventh bar in text.
- Wake success is shown as a percentage with one decimal, and "no wakes" when the denominator is zero (never `0%`, never `NaN`).
- Freshness: every card sourced from `activity_daily` or `usage_daily` carries "Updated hourly" in its subtitle; D1-live cards carry "Live".

Accessibility: the filter form is labelled and keyboard operable; `FigureNumber` is a `<p>` pair (label then value) in a `<section aria-labelledby>`; headings go `h1` page, `h2` card, `h3` sub-block; no information lives only in a chart (the tables carry it).

Copy keys: `MetricsTitle`, `MetricsFilterNumber`, `MetricsFilterNumberAll`, `MetricsFilterPeriod`, `MetricsPeriod7`, `MetricsPeriod30`, `MetricsFilterApply`, `MetricsFreshnessLive`, `MetricsFreshnessHourly`, `MetricsUpdatesHourly`, `MetricsNoData`, `MetricsShowValues`, `MetricsAccountsTitle`, `MetricsAccountsByState`, `MetricsAccountsPerNumber`, `MetricsNewAccountsPerDay`, `MetricsAgentsTitle`, `MetricsAgentsActive`, `MetricsAgentsConnected`, `MetricsAgentsByClient`, `MetricsAgentsNotReported`, `MetricsAgentsCreatedRevoked`, `MetricsMessagesTitle`, `MetricsMessagesIn`, `MetricsMessagesOut`, `MetricsTemplatesTitle`, `MetricsTemplatesNotice`, `MetricsTemplatesQuestion`, `MetricsFailuresTitle`, `MetricsWakeTitle`, `MetricsWakeNoWakes`, `MetricsBudgetTitle`, `MetricsBudgetWithin`, `MetricsBudgetWarning`, `MetricsBudgetThreshold`, `MetricsBudgetUsed` (with `{used}` and `{limit}`), `MetricsBlockedPhones`, `MetricsRestrictedTitle`, `ChartLegendSolid`, `ChartLegendHatched`, `ChartTitle` (with `{metric}` and `{days}`), `ChartDescription` (with `{from}`, `{to}`, `{total}`), `ColumnDay`, `ColumnCount`, `ColumnCreated`, `ColumnRevoked`.

### 4.9 Audit log (`GET /audit`)

```
1280
+-----------------------------------------------------------------------+
| Audit log                                                             |
| Newest 200 entries. Entries are kept 365 days.                        |
| +-------------------------------------------------------------------+ |
| | When (UTC)        | Action            | Target      | Outcome | IP  | |
| | 2026-11-07 14:32  | Number verified   | number 3f.. | OK      | ... | |
375: blocks as in 4.4 (When as the block heading, Action under it).
```

| State | What shows |
|---|---|
| Empty | "No entries yet." (practically unreachable after enrollment, which writes `operator.enrolled`, but handled.) |
| One / many | The table, newest first, at most 200 rows. Footer line states the limit and the retention. |
| Failed attempts | The outcome cell reads `Failed` or `Locked` as text with a glyph, in `--color-danger` weight 600; success is `OK`. |
| Error | The 500 page. |

- Columns: When (`Timestamp`), Action (the `BackofficeAuditAction` label), Target (kind and short internal ID, mono), Outcome, Address (mono). No submitted value exists in a row, so none can be shown.
- Accessibility: caption "Audit log, newest first"; `th scope`; outcome as text.
- Copy keys: `AuditTitle`, `AuditIntro`, `AuditEmpty`, `AuditColumnWhen`, `AuditColumnAction`, `AuditColumnTarget`, `AuditColumnOutcome`, `AuditColumnAddress`, `AuditOutcomeSucceeded`, `AuditOutcomeFailed`, `AuditOutcomeLocked`, and one key per action: `AuditActionOperatorEnrolled`, `AuditActionSignInSucceeded`, `AuditActionSignInFailed`, `AuditActionSignInLocked`, `AuditActionSignOut`, `AuditActionNumberRegistered`, `AuditActionNumberVerified`, `AuditActionNumberAccessTokenRotated`, `AuditActionMetaAppSecretRotated`, `AuditActionNumberStateChanged`.

### 4.10 Error pages

One `ErrorPage` layout, centred card, `--measure-form` wide. Every error page carries the full security header set from the spec, answers inside the shell (nav shown only when a valid session exists), shows the status code as visible text, names one next action, and never echoes the request path, an exception message, a stack, a request ID or a credential.

```
1280 and 375 (same, narrower at 375)
+-----------------------------+
| 404                         |
| Page not found              |
| The page you asked for is   |
| not here.                   |
| [ Go to the home page ]     |
+-----------------------------+
```

| Status | When | Title, next action |
|---|---|---|
| 401 | A POST with an expired or unknown session | "Your session ended." Action: "Sign in" (link to `/sign-in`). Pages (GET) redirect instead. Sign-in failure is not this page: it is the sign-in form with an error (4.2). |
| 403 | Missing or foreign `Origin`, or a bad `csrf` field | "Request refused." One sentence: "The request did not come from this page. Reload the page and try again." Action: "Go to the home page" (or "Sign in" when signed out). The reason is not more specific. |
| 404 | Unknown path, unknown number ID, and every MCP-host path asked on this host | "Page not found." Action: "Go to the home page". |
| 429 | Sign-in rate limit | "Too many attempts." "Wait one minute and try again." The `Retry-After` header carries the number. Action: "Back to sign-in". There is no countdown (no script). |
| 500 | Any unhandled error | "Something went wrong." "Nothing was changed on this page. Try again; if it persists, check the Workers logs." Action: "Go to the home page". No error class is shown (it is only in the log, per spec). |
| 503 | A `BACKOFFICE_*` secret is missing | "The backoffice is not configured." "Run the enrollment from the terminal." No action link. Status text and the one command name are the only content. |

For a state-changing POST the 500 page also says whether the change happened: "Nothing was changed" is only true because every write is one D1 batch, which the spec guarantees (registration batch, conditional TOTP update).

- Accessibility: `<h1>` is the title; the status code is part of the heading text ("404 Page not found") for a screen reader; focus order is the action link; contrast as in section 2.1.
- Copy keys: `ErrorHomeAction`, `ErrorSignInAction`, `ErrorBackToSignIn`, `Error401Title`, `Error401Body`, `Error403Title`, `Error403Body`, `Error404Title`, `Error404Body`, `Error429Title`, `Error429Body`, `Error500Title`, `Error500Body`, `Error503Title`, `Error503Body`.

## 5. Copy

Every string lives in `apps/api/src/backoffice/backoffice-copy.ts` as `BACKOFFICE_COPY: Record<OwnerLocale, Record<BackofficeCopyKey, string>>`, `BackofficeCopyKey` an enum with PascalCase members (as `OwnerCopyKey` is). No JSX string literal children (the plan's source-scan test). Placeholders are `{name}`, rendered by `renderCopy`. Product names (`zapbip`, `WhatsApp`, `Meta`, `WABA`, `TOTP`) are not translated. Tone: second person, short, an action verb on every button, no exclamation marks, no emoji.

The per-page key lists are in section 4. The strings:

### 5.1 Shell, sign-in, home

| Key | pt_BR | en_US |
|---|---|---|
| `SkipToContent` | Ir para o conteúdo | Skip to content |
| `BrandName` | zapbip backoffice | zapbip backoffice |
| `EnvironmentStaging` | HOMOLOGAÇÃO | STAGING |
| `EnvironmentDevelopment` | DESENVOLVIMENTO | DEVELOPMENT |
| `NavigationLabel` | Principal | Main |
| `NavigationHome` | Início | Home |
| `NavigationNumbers` | Números | Numbers |
| `NavigationMetrics` | Métricas | Metrics |
| `NavigationAudit` | Auditoria | Audit |
| `LocaleLabel` | Idioma | Language |
| `LocalePortuguese` | Português | Português |
| `LocaleEnglish` | English | English |
| `SignOut` | Sair | Sign out |
| `SignedOutNotice` | Você saiu. | You signed out. |
| `SessionEndedNotice` | Sua sessão terminou. Entre de novo. | Your session ended. Sign in again. |
| `FooterLine` | zapbip backoffice · {environment} | zapbip backoffice · {environment} |
| `SignInTitle` | Entrar | Sign in |
| `SignInKeyLabel` | Chave do backoffice | Backoffice key |
| `SignInKeyHelp` | Começa com zb_bo_. Fica no seu gerenciador de senhas. | Starts with zb_bo_. Kept in your password manager. |
| `SignInCodeLabel` | Código do autenticador | Authenticator code |
| `SignInCodeHelp` | 6 dígitos do seu app autenticador | 6 digits from your authenticator app |
| `SignInSubmit` | Entrar | Sign in |
| `SignInFailed` | Não foi possível entrar. | Sign-in failed. |
| `HomeTitle` | Visão geral | Overview |
| `HomeNumbersTitle` | Números | Numbers |
| `HomeNoNumbersWarning` | Nenhum número cadastrado. O canal não recebe nem envia mensagens até haver um número ativo. | No number is registered. The channel cannot receive or send until one is active. |
| `HomeRegisterNumber` | Cadastrar um número | Register a number |
| `HomeManageNumbers` | Gerenciar números | Manage numbers |
| `HomeMetricsTitle` | Métricas | Metrics |
| `HomeMetricsLink` | Abrir métricas | Open metrics |
| `HomeAuditTitle` | Auditoria | Audit log |
| `HomeAuditLink` | Abrir auditoria | Open audit log |

### 5.2 Numbers, register, detail, verify

| Key | pt_BR | en_US |
|---|---|---|
| `NumbersTitle` | Números | Numbers |
| `NumbersCaption` | Números de WhatsApp, por estado e rótulo | WhatsApp numbers, by state then label |
| `NumbersRegister` | Cadastrar um número | Register a number |
| `NumbersEmptyTitle` | Nenhum número ainda | No numbers yet |
| `NumbersEmptyBody` | Nada é recebido nem enviado até você cadastrar e ativar um número. | Nothing is received or sent until you register and activate a number. |
| `NumbersColumnLabel` | Rótulo | Label |
| `NumbersColumnDisplayNumber` | Número | Display number |
| `NumbersColumnState` | Estado | State |
| `NumbersColumnMetaApp` | App da Meta | Meta app |
| `NumbersColumnAccounts` | Contas | Accounts |
| `NumbersColumnVerified` | Verificado | Verified |
| `NumbersColumnUpdated` | Atualizado | Updated |
| `NumbersNotVerified` | Não verificado | Not verified |
| `NumbersView` | Ver {label} | View {label} |
| `NumbersPendingWarning` | Este número ainda não foi verificado. Verifique e depois ative. | This number is not verified yet. Verify it, then activate it. |
| `StatePending` | Pendente | Pending |
| `StateActive` | Ativo | Active |
| `StateClosed` | Fechado | Closed |
| `StateDisabled` | Desativado | Disabled |
| `RegisterTitle` | Cadastrar um número | Register a number |
| `RegisterMetaAppLegend` | App da Meta | Meta app |
| `RegisterMetaAppLabel` | App da Meta | Meta app |
| `RegisterMetaAppAddNew` | Adicionar um novo app da Meta | Add a new Meta app |
| `RegisterNewAppLegend` | Só ao adicionar um novo app da Meta | Only when adding a new Meta app |
| `RegisterNewAppHelp` | Ignorado quando você escolhe um app existente. | Ignored when you choose an existing app. |
| `RegisterMetaAppIdLabel` | ID do app da Meta | Meta app ID |
| `RegisterMetaAppIdHelp` | Painel do app da Meta, Configurações, Básico. | Meta app dashboard, Settings, Basic. |
| `RegisterMetaAppNameLabel` | Rótulo do app | Meta app label |
| `RegisterAppSecretLabel` | Segredo do app | App secret |
| `RegisterAppSecretHelp` | Painel do app da Meta, Configurações, Básico. Guardado cifrado; nunca exibido de novo. | Meta app dashboard, Settings, Basic. Stored sealed; never shown again. |
| `RegisterNumberLegend` | Número | Number |
| `RegisterPhoneNumberIdLabel` | ID do número de telefone | Phone number ID |
| `RegisterPhoneNumberIdHelp` | WhatsApp, Configuração da API. Só dígitos. | WhatsApp, API Setup. Digits only. |
| `RegisterWabaIdLabel` | ID da conta do WhatsApp Business (WABA) | WhatsApp Business account ID (WABA) |
| `RegisterWabaIdHelp` | WhatsApp, Configuração da API. Só dígitos. | WhatsApp, API Setup. Digits only. |
| `RegisterDisplayNumberLabel` | Número exibido | Display number |
| `RegisterDisplayNumberHelp` | Formato internacional, por exemplo +5511912345678. | International format, for example +5511912345678. |
| `RegisterLabelLabel` | Rótulo | Label |
| `RegisterAccessTokenLabel` | Token de acesso | Access token |
| `RegisterAccessTokenHelp` | Guardado cifrado; nunca exibido de novo. | Stored sealed; never shown again. |
| `RegisterConfirmLegend` | Confirmar | Confirm |
| `RegisterSubmit` | Cadastrar número | Register number |
| `RegisterCancel` | Cancelar | Cancel |
| `ErrorSummaryTitle` | Corrija os campos abaixo | Fix the fields below |
| `FieldErrorRequired` | Preencha este campo. | Fill in this field. |
| `FieldErrorDigits` | Use apenas dígitos. | Use digits only. |
| `FieldErrorDisplayNumber` | Use o formato internacional, começando com +. | Use international format, starting with +. |
| `FieldErrorLabelLength` | Use de 1 a 60 caracteres. | Use 1 to 60 characters. |
| `FieldErrorDuplicate` | Já está cadastrado. | Already registered. |
| `StepUpRejected` | Código não aceito. Espere o próximo código e tente de novo. | Code not accepted. Wait for the next code and try again. |
| `NumberBack` | Números | Numbers |
| `NumberSummaryTitle` | Resumo | Summary |
| `NumberDisplayNumber` | Número exibido | Display number |
| `NumberPhoneNumberId` | ID do número de telefone | Phone number ID |
| `NumberWabaId` | WABA | WABA |
| `NumberMetaApp` | App da Meta | Meta app |
| `NumberAccessToken` | Token de acesso | Access token |
| `NumberAppSecret` | Segredo do app | App secret |
| `NumberVerifiedAt` | Verificado em | Verified at |
| `NumberNeverVerified` | Nunca verificado | Never verified |
| `CredentialSet` | Definido, alterado em {date} | Set, last changed {date} |
| `NumberAccountsBound` | Contas neste número | Accounts on this number |
| `NumberVerifyTitle` | Verificar com a Meta | Verify with Meta |
| `NumberVerifyBody` | Confere o número e o estado dos modelos de mensagem. | Checks the number and the status of the message templates. |
| `NumberVerifySubmit` | Verificar com a Meta | Verify with Meta |
| `NumberStateTitle` | Estado | State |
| `NumberStateLegend` | Alterar estado | Change state |
| `NumberStateOptionActive` | Ativo: recebe, envia e aceita novas contas | Active: receives, sends and accepts new accounts |
| `NumberStateOptionClosed` | Fechado: recebe e envia, não aceita novas contas | Closed: receives and sends, accepts no new accounts |
| `NumberStateOptionDisabled` | Desativado: ignora o que chega e recusa envios | Disabled: ignores inbound and refuses sends |
| `NumberStateNoTarget` | Verifique o número primeiro. | Verify the number first. |
| `NumberStateDisabledConfirm` | Entendo que isso para este número por completo | I understand this stops this number completely |
| `NumberStateSubmit` | Alterar estado | Change state |
| `NumberDisabledWarning` | Este número está desativado: o que chega é ignorado e os envios são recusados. | This number is disabled: inbound is ignored and sends are refused. |
| `NumberRotateTokenTitle` | Trocar o token de acesso | Replace access token |
| `NumberRotateTokenLabel` | Novo token de acesso | New access token |
| `NumberRotateTokenSubmit` | Trocar token de acesso | Replace access token |
| `NumberRotateSecretTitle` | Trocar o segredo do app | Replace app secret |
| `NumberRotateSecretBody` | O segredo é do app da Meta e vale para todos os números dele: {labels}. | The secret belongs to the Meta app and applies to all its numbers: {labels}. |
| `NumberRotateSecretLabel` | Novo segredo do app | New app secret |
| `NumberRotateSecretSubmit` | Trocar segredo do app | Replace app secret |
| `NoticeRegistered` | Número cadastrado. Verifique antes de ativar. | Number registered. Verify it before activating. |
| `NoticeRegisteredWithBackfill` | Número cadastrado. As contas sem número foram vinculadas a ele. | Number registered. Accounts without a number were bound to it. |
| `NoticeVerified` | Número verificado. | Number verified. |
| `NoticeAccessTokenReplaced` | Token de acesso trocado. | Access token replaced. |
| `NoticeAppSecretReplaced` | Segredo do app trocado. | App secret replaced. |
| `NoticeStateChanged` | Estado alterado. | State changed. |
| `VerifyResultTitle` | Resultado da verificação: {label} | Verification result: {label} |
| `VerifyOk` | Verificado. O número confere. | Verified. The display number matches. |
| `VerifyMismatch` | O número informado pela Meta não confere com o número cadastrado. | The number Meta reports does not match the registered display number. |
| `VerifyExpectedNumber` | Cadastrado | Registered |
| `VerifyReportedNumber` | Informado pela Meta | Reported by Meta |
| `VerifyErrorAuth` | A Meta recusou o token de acesso. | Meta refused the access token. |
| `VerifyErrorNotFound` | A Meta não conhece este ID de número de telefone. | Meta does not know this phone number ID. |
| `VerifyErrorNetwork` | Não foi possível falar com a Meta. Tente de novo. | Could not reach Meta. Try again. |
| `VerifyMetaReports` | A Meta informa | Meta reports |
| `VerifyVerifiedName` | Nome verificado | Verified name |
| `VerifyQualityRating` | Qualidade | Quality rating |
| `VerifyTemplatesTitle` | Modelos de mensagem | Message templates |
| `VerifyTemplateName` | Modelo | Template |
| `VerifyTemplateStatusApproved` | Aprovado | Approved |
| `VerifyTemplateStatusPending` | Em análise | Pending |
| `VerifyTemplateStatusRejected` | Rejeitado | Rejected |
| `VerifyTemplateStatusMissing` | Ausente | Missing |
| `VerifyTemplatesWarning` | Avisos fora da janela vão falhar até os modelos serem aprovados. Você ainda pode ativar o número. | Out-of-window notices will fail until the templates are approved. You can still activate the number. |
| `VerifyCheckedAt` | Verificado em {date} | Checked {date} |
| `VerifyErrorUpstream` | A Meta respondeu com erro. Tente de novo mais tarde. | Meta answered with an error. Try again later. |
| `VerifyBack` | Voltar para {label} | Back to {label} |

### 5.3 Metrics, audit, errors

| Key | pt_BR | en_US |
|---|---|---|
| `MetricsTitle` | Métricas | Metrics |
| `MetricsFilterNumber` | Número | Number |
| `MetricsFilterNumberAll` | Todos | All |
| `MetricsFilterPeriod` | Período | Period |
| `MetricsPeriod7` | 7 dias | 7 days |
| `MetricsPeriod30` | 30 dias | 30 days |
| `MetricsFilterApply` | Aplicar | Apply |
| `MetricsFreshnessLive` | Ao vivo | Live |
| `MetricsFreshnessHourly` | Atualiza de hora em hora | Updated hourly |
| `MetricsUpdatesHourly` | atualiza de hora em hora | updates hourly |
| `MetricsNoData` | Sem dados ainda | No data yet |
| `MetricsShowValues` | Mostrar valores | Show values |
| `MetricsAccountsTitle` | Contas | Accounts |
| `MetricsAccountsByState` | Contas por estado | Accounts by state |
| `MetricsAccountsPerNumber` | Contas por número | Accounts per number |
| `MetricsNewAccountsPerDay` | Novas contas por dia | New accounts per day |
| `MetricsAgentsTitle` | Agentes | Agents |
| `MetricsAgentsActive` | Agentes ativos | Agents active |
| `MetricsAgentsConnected` | Agentes conectados | Agents connected |
| `MetricsAgentsByClient` | Agentes por cliente | Agents by client |
| `MetricsAgentsNotReported` | Não informado | Not reported |
| `MetricsAgentsCreatedRevoked` | Agentes criados e revogados por dia | Agents created and revoked per day |
| `MetricsMessagesTitle` | Mensagens | Messages |
| `MetricsMessagesIn` | Recebidas | In |
| `MetricsMessagesOut` | Enviadas | Out |
| `MetricsTemplatesTitle` | Envios de modelo | Template sends |
| `MetricsTemplatesNotice` | Avisos | Notices |
| `MetricsTemplatesQuestion` | Perguntas | Questions |
| `MetricsFailuresTitle` | Falhas de envio | Send failures |
| `MetricsWakeTitle` | Sucesso do despertar | Wake success |
| `MetricsWakeNoWakes` | Sem despertares | No wakes |
| `MetricsBudgetTitle` | Orçamento dos Durable Objects | Durable Object budget |
| `MetricsBudgetWithin` | Dentro do orçamento | Within budget |
| `MetricsBudgetWarning` | Atenção: acima de 80% do orçamento diário | Warning: above 80% of the daily budget |
| `MetricsBudgetThreshold` | Limite de 80% | 80% threshold |
| `MetricsBudgetUsed` | {used} de {limit} gigabytes-segundo | {used} of {limit} gigabyte-seconds |
| `MetricsBlockedPhones` | Telefones bloqueados | Blocked phones |
| `MetricsRestrictedTitle` | Números restritos | Restricted numbers |
| `ChartLegendSolid` | Sólido | Solid |
| `ChartLegendHatched` | Hachurado | Hatched |
| `ChartTitle` | {metric}, últimos {days} dias | {metric}, last {days} days |
| `ChartDescription` | De {from} a {to}. Total: {total}. | From {from} to {to}. Total: {total}. |
| `ColumnDay` | Dia | Day |
| `ColumnCount` | Quantidade | Count |
| `ColumnCreated` | Criados | Created |
| `ColumnRevoked` | Revogados | Revoked |
| `AuditTitle` | Auditoria | Audit log |
| `AuditIntro` | As 200 entradas mais recentes. Guardadas por 365 dias. | The newest 200 entries. Kept for 365 days. |
| `AuditEmpty` | Nenhuma entrada ainda. | No entries yet. |
| `AuditColumnWhen` | Quando (UTC) | When (UTC) |
| `AuditColumnAction` | Ação | Action |
| `AuditColumnTarget` | Alvo | Target |
| `AuditColumnOutcome` | Resultado | Outcome |
| `AuditColumnAddress` | Endereço | Address |
| `AuditOutcomeSucceeded` | OK | OK |
| `AuditOutcomeFailed` | Falhou | Failed |
| `AuditOutcomeLocked` | Bloqueado | Locked |
| `AuditActionOperatorEnrolled` | Operador cadastrado | Operator enrolled |
| `AuditActionSignInSucceeded` | Entrada concluída | Sign-in succeeded |
| `AuditActionSignInFailed` | Entrada falhou | Sign-in failed |
| `AuditActionSignInLocked` | Entrada bloqueada | Sign-in locked |
| `AuditActionSignOut` | Saída | Sign-out |
| `AuditActionNumberRegistered` | Número cadastrado | Number registered |
| `AuditActionNumberVerified` | Número verificado | Number verified |
| `AuditActionNumberAccessTokenRotated` | Token de acesso trocado | Access token replaced |
| `AuditActionMetaAppSecretRotated` | Segredo do app trocado | App secret replaced |
| `AuditActionNumberStateChanged` | Estado do número alterado | Number state changed |
| `ErrorHomeAction` | Ir para o início | Go to the home page |
| `ErrorSignInAction` | Entrar | Sign in |
| `ErrorBackToSignIn` | Voltar para entrar | Back to sign-in |
| `Error401Title` | Sua sessão terminou | Your session ended |
| `Error401Body` | Entre de novo para continuar. | Sign in again to continue. |
| `Error403Title` | Pedido recusado | Request refused |
| `Error403Body` | O pedido não veio desta página. Recarregue a página e tente de novo. | The request did not come from this page. Reload the page and try again. |
| `Error404Title` | Página não encontrada | Page not found |
| `Error404Body` | A página que você pediu não existe aqui. | The page you asked for is not here. |
| `Error429Title` | Tentativas demais | Too many attempts |
| `Error429Body` | Espere um minuto e tente de novo. | Wait one minute and try again. |
| `Error500Title` | Algo deu errado | Something went wrong |
| `Error500Body` | Nada foi alterado nesta página. Tente de novo; se continuar, veja os logs do Worker. | Nothing was changed on this page. Try again; if it persists, check the Workers logs. |
| `Error503Title` | O backoffice não está configurado | The backoffice is not configured |
| `Error503Body` | Rode o cadastro do operador pelo terminal. | Run the operator enrollment from the terminal. |
| `NoticeLabelSuccess` | Sucesso | Success |
| `NoticeLabelInfo` | Informação | Information |
| `NoticeLabelWarning` | Atenção | Warning |
| `NoticeLabelError` | Erro | Error |

The sign-in error and every `Error*` string are the same in both locales for any cause, so no copy leaks which factor failed or whether the operator is locked.

## 6. Interaction and accessibility

- **Standard.** WCAG 2.2 AA is the target, checked in the Playwright walk at 1280 and 375 with a keyboard-only pass and a 200% zoom pass.
- **Keyboard.** Every control is a native element: link, button, input, select, radio, checkbox, `<details>`. No custom widget, no `tabindex` above 0, no focus trap. Tab order equals visual order on every page because the DOM is in visual order.
- **Focus.** Every focusable element shows a `--size-focus-ring` outline in `--color-focus` with an offset; `outline` is never removed. Contrast of the ring against the surface is at least 6:1.
- **Skip link.** First element in the DOM, jumps to `<main id="content">`.
- **Landmarks and headings.** `<header>`, `<nav aria-label>`, `<main>`, `<footer>`; one `h1`; no skipped levels.
- **Labels.** Every input has a visible `<label for>`. Help and error text attach with `aria-describedby`. Placeholders are never used as labels.
- **Errors.** An error Notice leads the page, `role="alert"`, and, on a form, links to each failing field. Invalid fields carry `aria-invalid="true"`. Errors read "Error: ..." in text.
- **No colour-only signals.** State badges have a glyph and a word; Notices have a word and a glyph; outcome cells have a word; chart series differ by pattern and legend; the budget warning has a word, a hatch and a labelled threshold; the current nav item is bold and underlined.
- **Contrast.** Section 2.1 lists every text pair; body text meets 7:1 in both themes, secondary text 7:1, and non-text (control borders, ring, chart bars) 3:1 or more.
- **Disabled reasons.** A control that cannot be used is replaced by a sentence that says why (the state form with no allowed target). The `disabled` attribute is used on nothing, because a disabled control is skipped by the keyboard and carries no reason.
- **Motion.** None.
- **Touch.** Every interactive element is at least `--size-tap` tall; buttons are full width at 375; two adjacent controls are separated by at least `--space-2`.
- **Zoom and reflow.** At 320 CSS pixels and 400% zoom the content reflows to one column with no horizontal scroll; the stacked table layout already does this.
- **Language.** `lang` on `<html>` follows the locale; the locale switch buttons carry their own `lang`.
- **Print.** Not designed in phase 1.
- **Announcements.** Success after a redirect is a `role="status"` Notice, read on load; sign-out confirms on the sign-in page.

## 7. Options

Every option below has two choices, a trade-off and a recommendation. The recommended choice is chosen under "owner delegated 2026-11-06" and recorded in section 8. Mockups are the wireframes in section 4, because no server runs in this step.

### Option 1: navigation shell

| | A: top bar | B: left sidebar |
|---|---|---|
| Desktop | Four links in one row; content gets the full width. | Persistent column; room for more sections later. |
| 375 | Links wrap into two rows, no extra control. | Needs a collapse/expand control; with no script that is a hidden-checkbox trick that is hard to make accessible. |
| Cost | Little CSS. | More CSS and a fragile pattern. |

Recommendation: **A, top bar.** Four items fit; phase 2 adds at most two more, and a wrapping row still works.

### Option 2: tables at 375

| | A: stacked blocks (labels by CSS) | B: horizontal scroll |
|---|---|---|
| Reading | Each row reads as a card; nothing hidden. | Columns stay aligned; the right half is off-screen. |
| Accessibility | Reflows at 400% zoom; native table semantics kept. | A scroll region needs a focusable wrapper and a label; fails reflow at high zoom. |

Recommendation: **A, stacked.** The test plan already expects "the tables stack".

### Option 3: chart style

| | A: SVG vertical bars with a values table | B: horizontal bars drawn as table cells |
|---|---|---|
| Time series | Natural for days. | Awkward: 30 rows tall. |
| CSP | Geometry in SVG attributes; allowed. | A bar width needs a `style` attribute or one class per width; forbidden or 100 classes. |

Recommendation: **A.** B is rejected by the CSP. The budget is the one horizontal bar and is also SVG.

### Option 4: confirming a disabling change

| | A: required checkbox on the same form | B: a confirmation page between the form and the change |
|---|---|---|
| Routes | None added (spec lists one `POST …/state`). | Adds a `GET` confirm route and a pending-intent mechanism with no stored state. |
| Safety | An explicit tick plus the single-use code. | Slightly stronger friction; the code is entered on the second page. |

Recommendation: **A.** The step-up code already gates it, and B would change the spec's route list.

### Option 5: dark mode

| | A: light and dark by `prefers-color-scheme`, token switch | B: light only |
|---|---|---|
| Cost | One media block redefining the tokens; two contrast sets verified. | None. |
| Use | The operator may work at night; the system setting is respected. | Always bright. |

Recommendation: **A.** The harness says dark mode is a token switch, and the cost is one block.

### Option 6: where the step-up code goes

| | A: one `CodeField` in each state-changing form | B: a dedicated "confirm with code" page |
|---|---|---|
| Flow | One submit per action. | Two steps per action, and the first page must carry the pending input through a hidden field. |
| Safety | The code is used on the request that changes things. | The pending input travels through the browser twice. |

Recommendation: **A.** It matches the spec ("a fresh TOTP code in the same form").

### Option 7: the brand colour on text and buttons

| | A: `#128C7E` everywhere | B: `#128C7E` for non-text only, `#0B6B60` for text, links and buttons |
|---|---|---|
| Brand match | Identical to the docs site. | Same hue, one shade darker where text sits. |
| Contrast | 4.1:1 on white: fails 4.5:1 for text and for a white-on-green button. | 6.4:1 on white: passes. |

Recommendation: **B.** A passes nothing the audience needs. The brand colour still marks the brand mark, chart bars and the nav underline.

### Option 8: the environment marker

| | A: text badge in the header on staging and development | B: none, rely on the host name |
|---|---|---|
| Risk | A rotation done on staging cannot be mistaken for production. | Two similar-looking hosts, same page layout. |

Recommendation: **A.** Registration and rotation are credentials work, and the only cost is one string.

## 8. Owner decisions

All answers are the recommended option, chosen under the owner's delegation. Nothing is pending.

| Decision | Choice | Answer |
|---|---|---|
| Option 1, navigation shell | A: top bar | recommended: A (owner delegated 2026-11-06), 2026-11-07 |
| Option 2, tables at 375 | A: stacked blocks | recommended: A (owner delegated 2026-11-06), 2026-11-07 |
| Option 3, chart style | A: SVG vertical bars plus values table | recommended: A (owner delegated 2026-11-06), 2026-11-07 |
| Option 4, confirming a disabling change | A: required checkbox in the same form | recommended: A (owner delegated 2026-11-06), 2026-11-07 |
| Option 5, dark mode | A: `prefers-color-scheme` token switch | recommended: A (owner delegated 2026-11-06), 2026-11-07 |
| Option 6, step-up placement | A: a code field in each form | recommended: A (owner delegated 2026-11-06), 2026-11-07 |
| Option 7, brand colour on text and buttons | B: `#0B6B60` for text and buttons, `#128C7E` for non-text | recommended: B (owner delegated 2026-11-06), 2026-11-07 |
| Option 8, environment marker | A: text badge on staging and development | recommended: A (owner delegated 2026-11-06), 2026-11-07 |
| Token set in section 2 (colour, type, space, radius, size, measure) | adopted as written | recommended (owner delegated 2026-11-06), 2026-11-07 |
| Fonts | system stacks only, no web font (the CSP forbids one) | recommended (owner delegated 2026-11-06), 2026-11-07 |
| Flash messages | allow-listed `notice` query value, no cookie; a rejected form keeps its non-secret values in a single-use, one-minute flash bound to the session | recommended (owner delegated 2026-11-06), 2026-11-07 |
| Verify result | stored as `verification_snapshot`, rendered by a GET after `303` (POST, 303, GET as in section 1) | recommended (owner delegated 2026-11-06), 2026-11-07 |
| Date format | `YYYY-MM-DD HH:mm UTC` in both locales | recommended (owner delegated 2026-11-06), 2026-11-07 |

## 9. Hand-off to the plan

These facts follow from this design and are not in the spec's route table or the plan's test list. The plan's G2 and G3 steps pick them up.

- `notice` is an enum (`BackofficeNotice`: `SignedOut`, `SessionEnded`, `Registered`, `RegisteredWithBackfill`, `Verified`, `AccessTokenReplaced`, `AppSecretReplaced`, `StateChanged`); any other value renders nothing.
- `returnTo` on `POST /locale` is matched against an allow-list of the backoffice's own paths; an unknown value goes to `/`.
- A wrong step-up code answers `401` and re-renders the form's page with `StepUpRejected`; the status of a validation failure is `422`.
- Tests the plan adds: the source scan finds no `style=` attribute and no `<style>` or `<script>` in any view; every page has one `h1`, a skip link and a labelled input per field; the stylesheet contains no raw colour outside the `:root` token blocks; a contrast check of the token pairs in 2.1 runs in a unit test; the Playwright walk screenshots every page at 1280 and 375, in both locales and in light and dark.
