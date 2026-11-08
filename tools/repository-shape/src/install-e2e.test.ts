import { spawnSync } from 'node:child_process';
import { accessSync, constants } from 'node:fs';
import { AgentFacet } from '@zapbip/agents';
import { discoverAgents } from '@zapbip/agents/generate';
import { describe, expect, test } from 'vitest';
import { readRepositoryFile, repositoryPath } from './repository-files';

const SUPPORTED_ROOT = 'libs/agents/supported';
const FIXTURE_LINK = 'https://mcp.zapbip.com/c/zb_conn_fixturesecret0123456789/mcp';
const LINK_ENVIRONMENT_VARIABLE = 'ZAPBIP_E2E_FIXTURE_LINK';
const REDACTION_CHECK_FLAG = '--check-redaction';
const LEAK_PATTERN = /zb_conn_|\/c\//;
const SCRIPT_TIMEOUT_MS = 30_000;

const ownerRunAgents = discoverAgents({ roots: [SUPPORTED_ROOT] }).filter((agent) => agent.facets.includes(AgentFacet.OwnerRunInstall));

describe('the agents with an owner-run install script', () => {
  test('keep the script in their folder', () => {
    ownerRunAgents.forEach((agent) => expect(agent.folder.startsWith(`${SUPPORTED_ROOT}/`)).toBe(true));
  });
});

describe.each(ownerRunAgents)('owner-run install script of $id', ({ folder }) => {
  const SCRIPT = `${folder}/${AgentFacet.OwnerRunInstall}`;

  test('is executable and parses', () => {
    accessSync(repositoryPath(SCRIPT), constants.X_OK);
    const syntaxCheck = spawnSync('bash', ['-n', repositoryPath(SCRIPT)], { encoding: 'utf8' });
    expect(syntaxCheck.status).toBe(0);
  });

  test('IS-D7 never prints the connection link', () => {
    const run = spawnSync('bash', [repositoryPath(SCRIPT), REDACTION_CHECK_FLAG], {
      encoding: 'utf8',
      env: { ...process.env, [LINK_ENVIRONMENT_VARIABLE]: FIXTURE_LINK },
      timeout: SCRIPT_TIMEOUT_MS,
    });
    expect(run.status).toBe(0);
    expect(run.stdout).not.toMatch(LEAK_PATTERN);
    expect(run.stderr).not.toMatch(LEAK_PATTERN);
  });

  test('never echoes the link variable outside the redaction filter', () => {
    expect(readRepositoryFile(SCRIPT)).not.toMatch(/echo "?\$\{?(connection_url|CONNECTION_URL)/);
  });
});
