# Contributing to zapbip

Thank you for helping. zapbip is small and moves fast, so a short conversation first saves everyone time.

## Before you write code

- **Bugs:** open an issue with the bug template: what you did, what you expected, what happened.
- **Features and larger changes:** open an issue first and describe the problem, not only the solution. A change that touches the inbox rules, the MCP tools or the WhatsApp flow needs agreement before code.
- **Security issues:** never in a public issue; follow [SECURITY.md](SECURITY.md).

## How work happens here

The repository has one process for people and for coding agents alike, in [.claude/HARNESS.md](../.claude/HARNESS.md). The parts that matter most for a pull request:

- **Conventions** are in [AGENTS.md](../AGENTS.md): no comments, flat `if`s and early returns, named parameters, enums over string literals, constants over magic literals, no `?? default` that hides a missing value.
- **Tests are mandatory.** Write the failing test first, then the code. Unit tests use Vitest; end-to-end tests use Playwright.
- **The local gate** is `pnpm verify`. Run it before you push; it runs what your diff can break.
- **Commits** follow Conventional Commits (`type(scope): summary`), in English. Never skip the git hooks.
- **Copy** shown to users lives in `*-copy.ts` modules, in every language the product speaks; a missing translation fails the typecheck.

[docs/contributing/local-stack.md](../docs/contributing/local-stack.md) starts everything locally with a test double for WhatsApp.

## Licensing of contributions

By opening a pull request you agree that your contribution is licensed under the license of the files you change: the GNU Affero General Public License v3.0 for the repository, the MIT License for the client packages that carry their own `LICENSE` file.
