# Test plan: Preflight pre-launch

## The failing test first

- [ ] `apps/api/test/unit/deploy-preflight.test.ts` — input: production, official number unset, everything else valid; expected: `null` (red: refusal at `official number`) — evidence:
- [ ] Same file — input: production, `npm view ... maintainers` answers `E404`; expected: `null` and the warning `zapbip@<version> is not on npm yet; publish it before launch` (red: refusal `does not resolve`) — evidence:

## Unit

- [ ] A sole foreign maintainer is refused at `npm version`, naming the maintainer, with no warning — evidence:
- [ ] A network error (`ENOTFOUND`) is refused with `could not reach npm` — evidence:
- [ ] The docs preflight with the number unset is refused at `official number` before any command — evidence:
- [ ] The docs preflight with a package answering `E404` is refused with `does not resolve` — evidence:
- [ ] `deploy-entry.test.ts`: production with `E404` exits 0 and prints the warning — evidence:

- [ ] Versioned `E404`, bare name answers a foreign maintainer: refused at `npm version` naming it, no warning — evidence:
- [ ] Versioned `E404`, bare name fails with `ENOTFOUND`: refused with `could not reach npm`, no warning — evidence:
- [ ] Versioned and bare `E404`: warned with `PreflightWarningKind.PackageUnpublished` and passes — evidence:
- [ ] Deploy entry: the warning is printed again under `warnings to resolve before launch:` after the smoke test — evidence:
- [ ] Docs preflight with `E404` on both: `does not resolve on npm; publish it first`; mutating the docs handler to `() => null` turns it red — evidence:

## End-to-end

- [ ] `deploy-dry-run.e2e.test.ts`: with the real constants (number unset) production is not refused and exits 0; `E404` prints the warning and exits 0 — evidence:

## Edge cases

- [ ] Staging with the number unset still deploys — evidence:
- [ ] Production with the company facts unset is still refused — evidence:

## Coverage honesty

- No real npm registry is called; `npm view` answers come from the fake shell.
