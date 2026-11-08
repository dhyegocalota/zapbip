# Test plan: Preflight pre-launch

## The failing test first

- [x] `apps/api/test/unit/deploy-preflight.test.ts` — input: production, official number unset, everything else valid; expected: `null` (red: refusal at `official number`) — evidence: unit 'lets production deploy when only the official number is unset'; 120/120 green across 4 files at e0c42f2d
- [x] Same file — input: production, `npm view ... maintainers` answers `E404`; expected: `null` and the warning `zapbip@<version> is not on npm yet; publish it before launch` (red: refusal `does not resolve`) — evidence: unit 'warns and passes when npm answers E404'; kind package unpublished, message exact (deploy-preflight.test.ts:259)

## Unit

- [x] Pin (green when it landed, `feaee3d5`): a sole foreign maintainer is refused at `npm version`, naming the maintainer, with no warning — evidence: unit 'refuses production when the only maintainer is not the owner npm user'; green, no warning
- [x] A network error (`ENOTFOUND`) is refused with `could not reach npm` — evidence: unit 'says npm could not be reached ... network error'; green
- [x] The docs preflight with the number unset is refused at `official number` before any command — evidence: unit 'docs preflight > refuses while the official number is the unset sentinel, before any command'; green
- [x] The docs preflight with a package answering `E404` is refused with `does not resolve` — evidence: unit 'docs preflight > refuses until npm view resolves the pinned version'; docs-preflight-entry E404 test green
- [x] `deploy-entry.test.ts`: production with `E404` exits 0 and prints the warning — evidence: deploy-entry 'warns and deploys production when a package is not on npm yet'; green

- [x] Versioned `E404`, bare name answers a foreign maintainer: refused at `npm version` naming it, no warning — evidence: unit 'version is absent but the package name belongs to a foreign maintainer'; green; mutation M1 turns it red
- [x] Versioned `E404`, bare name fails with `ENOTFOUND`: refused with `could not reach npm`, no warning — evidence: unit 'version is absent and npm cannot be reached for the package name'; green; mutation M1 turns it red
- [x] Versioned and bare `E404`: warned with `PreflightWarningKind.PackageUnpublished` and passes — evidence: unit warns PackageUnpublished and passes; real npm probe through runWorkerPreflight: zapbip@0.1.0 and bare zapbip both E404 -> refusal null, 1 warning
- [x] Deploy entry: the warning is printed again under `warnings to resolve before launch:` after the smoke test — evidence: deploy-entry 'prints the warnings again under a heading'; smoke pass green; smoke FAIL path proven with a throwaway test (exit 1, reprint after heading), see F1 for the missing committed test
- [x] Pin (green when it landed, `644338ce`): docs preflight with `E404` on both: `does not resolve on npm; publish it first`; mutating the docs handler to `() => null` turns it red — evidence: docs-preflight-entry 'E404 for the version and the name' green; mutation M2 (docs onAbsentPackage -> null) turns it red

- [ ] Versioned `E404`, bare name answers the owner as maintainer and publisher: the Worker warns `PackageUnpublished` and passes — evidence:
- [ ] Same input in the docs preflight: refused with `zapbip@<version> does not resolve on npm; publish it first` — evidence:
- [ ] Pin (green when it landed): deploy entry with `E404` and a failing smoke test exits 1 and prints the warning again under the heading, after the rollback commands — evidence:

## End-to-end

- [x] `deploy-dry-run.e2e.test.ts`: with the real constants (number unset) production is not refused and exits 0; `E404` prints the warning and exits 0 — evidence: e2e deploy-dry-run: 'production is not refused while the official number is the sentinel' and 'production warns and goes on while the npm package does not resolve' green (5 e2e tests, 2 dry runs)

## Edge cases

- [x] Staging with the number unset still deploys — evidence: worker preflight input has no number field; staging passes with sentinel constants (unit 'lets staging deploy ...', e2e dry run staging bundle); green
- [x] Production with the company facts unset is still refused — evidence: e2e 'production is refused while the company facts are the sentinel' and unit per-fact refusals green

## Coverage honesty

- No real npm registry is called; `npm view` answers come from the fake shell.

F1: no committed test pins the warning reprint when the smoke test FAILS. Mutation M3b (reprint only on smoke pass, `if (smoke.exitCode === 0) logWarnings(...)`) survives all 113 unit tests; a throwaway test confirmed the real code reprints on failure, and turned red under M3b. Request a regression test from the developer.
