# Preflight pre-launch

**Status:** Building
**Tier:** 🟡 medium
**Owner approval:** approved 2026-11-08 (owner delegated 2026-11-06)
**ADRs:** none
**Not changing:** the docs preflight (`apps/api/scripts/docs-preflight.ts`), the company facts check, the trusted-publisher check, the Worker's product code

## Problem

The owner said on 2026-11-08: "I don't have the official number yet" and "sobre npm eu publico quando eu chegar mas que isso nao seja bloqueante". Everything else can be deployed, but the Worker deploy preflight refuses production while `OFFICIAL_WHATSAPP_NUMBER` is `OFFICIAL_NUMBER_UNSET`, and while a published package does not resolve on npm. The Worker's product code never reads the number (`git grep OFFICIAL_WHATSAPP_NUMBER -- apps/api/src libs` shows only the preflight); account numbers live in the backoffice registry. The constant only feeds the static docs through the `wa.me` links.

## Goals

- The Worker deploy preflight no longer checks the official number, and the input type loses the field.
- In the Worker deploy preflight a package that does not resolve on npm (`E404`) becomes a printed warning, `<spec> is not on npm yet; publish it before launch`, and the deploy goes on. The warning goes through a typed `warn` callback of the preflight input, which `runDeploy` wires to its `log`.
- "Absent" means the version and the name are both absent. `npm view <name>@<version>` answers `E404` when the name exists but that version does not, so a squatter holding `zapbip@0.0.1` must not read as unpublished: on a versioned `E404` the check queries the bare name, warns only if that is `E404` too, and runs the maintainer and publisher comparison against the name when it exists.
- Still refused: a package on npm with any maintainer or publisher other than `ZAPBIP_NPM_PUBLISHER` (the squatting guard), and any other npm failure (network or unknown), including on the name query, because squatted and absent cannot be told apart.
- The warning is a typed `PreflightWarning` (`PreflightWarningKind.PackageUnpublished`). `runDeploy` prints it when raised and again, under a heading, after the smoke test.
- The runbook wording follows.

## Non-goals

- The docs preflight keeps both refusals: the published docs must never show the placeholder number nor pin a package that is missing. A later feature replaces the single official number in the docs; the owner believes there will not be one single number.
- Company facts, hosted plugin files and every other Worker refusal stay as they are.

## Design

### Data flow

`runDeploy` calls `runWorkerPreflight({ ...input, warn: log })`. `refuseUntrustedPackages` takes an `onAbsentPackage` function: the docs check returns the `does not resolve on npm; publish it first` refusal, the Worker check calls `warn` and returns no refusal. `WORKER_CHECKS` loses its `OfficialNumber` row; `DOCS_CHECKS` keeps it.

### Failure handling

A skipped package skips its `_npmUser` check too; it is not on npm, so there is nothing to read. After the owner publishes, the next deploy checks it fully.

## Open questions → answers

| Question | Options | Owner's answer | Date |
|----------|---------|----------------|------|
| Move the official number refusal out of the Worker preflight | keep · move to the docs preflight only | move; owner delegated | 2026-11-06 |
| Unpublished npm package in the Worker preflight | refuse · warn | warn, "sobre npm eu publico quando eu chegar mas que isso nao seja bloqueante" | 2026-11-08 |

## Test strategy summary

Unit: the Worker preflight passes with the number unset; E404 warns and passes; a foreign maintainer and a network error refuse; the docs preflight still refuses both. Deploy entry and the dry-run end-to-end suite run the real `runDeploy`.
