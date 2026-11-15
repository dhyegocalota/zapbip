# Test plan: Connector runtime configured by one zapbip.json file

Every checkbox states the input and the exact expected outcome. A ticked box carries evidence after ` — evidence: `.

## The failing test first

- [ ] `apps/connector/test/unit/connector-config.test.ts::launchOf` — input: `{"agents": {"claude-code": {"command": "ccs", "args": ["--some-flag"]}}}` for `claude-code`; expected: `command` is `ccs`, `args` is `["--some-flag"]`
- [ ] Confirmed it fails for the right reason: the module `connector-config` does not exist yet (`Failed to load url ../../src/connector-config`), not a broken assertion

## Unit

- [ ] `resolveConnectorConfigPath` — input: flag, variable and a `zapbip.json` in the working directory all set; expected: the flag path
- [ ] `resolveConnectorConfigPath` — input: variable and the working-directory file; expected: the variable path
- [ ] `resolveConnectorConfigPath` — input: only the working-directory file; expected: its path
- [ ] Edge: empty variable — input: `ZAPBIP_CONNECTOR_CONFIG=""` and the working-directory file; expected: the working-directory file
- [ ] Edge: nothing given and no file — input: empty working directory; expected: `null`, the built-in defaults apply
- [ ] Edge: a directory named `zapbip.json` — input: directory in the working directory; expected: `null`
- [ ] `readConnectorConfig` — input: `null`; expected: `{}`
- [ ] Edge: the error path, not JSON — input: `{ not json`; expected: `connector config is not valid JSON: <path>`
- [ ] Edge: the error path, missing file — input: a path that does not exist; expected: `connector config not found: <path>`
- [ ] Edge: the error path, unknown agent id `not-an-agent`; expected: `invalid connector config <path>` with the validation message
- [ ] Edge: the error path, unknown field `model` in an entry; expected: `invalid connector config <path>`
- [ ] Edge: the error path, `args` with a number; expected: `invalid connector config <path>`
- [ ] Edge: the error path, empty `command`; expected: `invalid connector config <path>`
- [ ] Edge: the error path, `timeoutMilliseconds: 0`; expected: `invalid connector config <path>`
- [ ] `launchOf` for each client with no entry — input: `{}`; expected: the runtime `binaryName`, `args: []`, `environment: {}`, `timeoutMilliseconds` of the wake timeout
- [ ] `launchOf` for each client with only `command` — expected: that command, the other defaults kept
- [ ] `launchOf` for each client with every field — expected: every field taken from the entry
- [ ] `launchOf` for the other client — input: an entry for `claude-code` only; expected: `codex` keeps `codex`
- [ ] `connectorConfigJsonSchema` — input: the committed `apps/docs/schemas/connector-config.json`; expected: equal to the generated schema
- [ ] `parseConnectArguments` — input: `--config custom.json`; expected: the absolute path of `custom.json`; without the flag: `null`
- [ ] `connector-config` suites pass under `apps/connector` `pnpm test:unit` — evidence: 

## Integration

- [ ] `apps/connector/test/integration/connector-config.test.ts` — input: a `zapbip.json` in the working directory naming `ccs` with `--some-flag` and an environment probe, a fake `ccs` binary on the path; expected: `ccs` runs (`clientName` is `ccs`), its first argument is `--some-flag`, its arguments include the session id, the probe reads `from-config`, and the outcome is `answered` with exit code 0
- [ ] `apps/connector/test/integration/wake-runner.test.ts` (both runtimes) and `connect.test.ts` — expected: unchanged behaviour with the built-in launch
- [ ] `apps/connector/test/integration/wake-runner.test.ts`, runtime defaults — expected: the existing argument checks still pass

## E2E (Playwright specs)

Not applicable: the change is in the local connector process and the docs site, with no browser flow of the product.

## Prove it for real

- [ ] The docs page renders the new section in English and pt-BR, and the `$schema` link resolves on the docs host — evidence: after the docs deploy, the URL is served; not checked before the merge (no deploy here)

## Edge cases found during execution

Empty on purpose.

## Adversarial review

- [ ] A config in a folder someone else owns runs a command: documented in the page and in ADR 0066 as trust in the folder, not a code fix.
- [ ] The connection link cannot reach the child through `environment`: covered by the filter in `childEnvironment`; the test is the integration case plus review.
