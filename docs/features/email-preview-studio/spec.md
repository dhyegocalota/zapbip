# Email preview studio

**Status:** Shipped 2026-11-14
**Tier:** 🟢 small
**Owner approval:** the owner asked on 2026-11-14 for an easy command to inspect the emails with the React Email studio
**ADRs:** [0058](../../adr/0058-email-is-sent-through-resend-with-react-email-templates.md)
**Not changing:** the templates, the generated module, the Worker bundle

## Problem

The welcome and the digest are React Email components, but nothing opened them in the React Email studio, so a copy or layout change was read only in the generated HTML.

## Goals

- `pnpm emails:preview` opens the studio on `http://localhost:3100` with the welcome in every language and the digest shell.

## Non-goals

- Adding `react-email` to the repository's dependencies: ADR 0058 keeps its preview CLI and servers out of the lockfile.

## Design

### Data flow

`scripts/emails-preview.sh` installs the pinned `react-email` and `@react-email/ui` into a folder under the system temporary directory and starts `react-email dev` there on `apps/api/scripts/emails/previews`. Each preview file default-exports one component that wraps the real template, so the studio shows what `pnpm emails:generate` renders. Slots such as `{{email}}` show as text.

### Failure handling

Without network the install fails and the script stops with npm's message. The studio folder is disposable.

## Open questions → answers

None.

## Test strategy summary

A unit test renders every preview and compares it with the generated module: ten welcomes, one per locale, and the digest shell. The script was run once and served `/preview/welcome-arabic` right to left.
