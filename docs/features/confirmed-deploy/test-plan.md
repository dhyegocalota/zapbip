# Test plan: Confirmed deploy

## Unit

- [x] Production deploys without a terminal and asks nothing when `--confirm production` is given — evidence: `deploy-entry.test.ts`
- [x] Without a terminal, `--confirm staging` for production refuses and runs no command — evidence: same file
- [x] The preflight refuses when it cannot confirm — evidence: `deploy-preflight.test.ts`
- [x] The hooks suite passes without the deploy guard — evidence: `hooks.test.sh` all checks passed

## Edge cases

- [x] No source file or document names the street, the neighbourhood or the city of the company — evidence: `git grep` returns nothing
- [x] The company facts are five and each legal page still fills its placeholders — evidence: `company-docs.test.ts` and the api unit and integration suites
