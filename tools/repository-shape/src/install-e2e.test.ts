import { homedir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { accessSync, constants } from 'node:fs';
import { AgentFacet } from '@zapbip/agents';
import { discoverAgents } from '@zapbip/agents/generate';
import { describe, expect, test } from 'vitest';
import { readRepositoryFile, repositoryPath } from './repository-files';

const SUPPORTED_ROOT = 'libs/agents/supported';
const OWNER_RUN_AGENT_IDS = ['claude-code'];
const FIXTURE_LINK = 'https://mcp.zapbip.com/c/zb_conn_fixturesecret0123456789/mcp';
const LINK_ENVIRONMENT_VARIABLE = 'ZAPBIP_E2E_FIXTURE_LINK';
const REDACTION_CHECK_FLAG = '--check-redaction';
const LEAK_PATTERN = /zb_conn_|\/c\//;
const SCRIPT_TIMEOUT_MS = 30_000;
const CONFIG_DIRECTORY_VARIABLE = 'ZAPBIP_E2E_CLAUDE_CONFIG_DIR';
const BARE_CLAUDE_CALL = /^\s*(run_logged\s+)?claude\b/m;

const ownerRunAgents = discoverAgents({ roots: [SUPPORTED_ROOT] }).filter((agent) => agent.facets.includes(AgentFacet.OwnerRunInstall));

describe('the agents with an owner-run install script', () => {
  test('are the ones that bring one', () => {
    expect(ownerRunAgents.map((agent) => agent.id)).toEqual(OWNER_RUN_AGENT_IDS);
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

  test('applies the directory migrations, then seeds through the running worker and shows seed errors', () => {
    const script = readRepositoryFile(SCRIPT);
    expect(script.indexOf('d1 migrations apply')).toBeGreaterThan(-1);
    expect(script.indexOf('d1 migrations apply')).toBeLessThan(script.indexOf('dev:seed'));
    expect(script.indexOf('wrangler dev')).toBeLessThan(script.indexOf('dev:seed'));
    expect(script).toContain('dev:seed --origin');
    expect(script).toContain('--env development');
    expect(script).not.toMatch(/dev:seed[^\n]*>\/dev\/null/);
    expect(script).toContain('fail "the seed failed');
  });

  test('keeps the owner Claude configuration untouched by installing at project scope', () => {
    const script = readRepositoryFile(SCRIPT);
    expect(script).toContain('--scope project');
    expect(script).toContain('.claude/skills/zapbip/SKILL.md');
    expect(script).not.toContain('--scope user');
  });

  test('refuses to run without an isolated Claude configuration directory', () => {
    const environment = Object.fromEntries(Object.entries(process.env).filter(([name]) => name !== CONFIG_DIRECTORY_VARIABLE));
    const run = spawnSync('bash', [repositoryPath(SCRIPT)], { encoding: 'utf8', env: environment, timeout: SCRIPT_TIMEOUT_MS });
    expect(run.status).not.toBe(0);
    expect(run.stderr).toContain(CONFIG_DIRECTORY_VARIABLE);
  });

  test.each([join(homedir(), '.claude'), homedir(), 'relative/directory'])(
    'refuses %s as the Claude configuration directory',
    (directory) => {
      const run = spawnSync('bash', [repositoryPath(SCRIPT)], {
        encoding: 'utf8',
        env: { ...process.env, [CONFIG_DIRECTORY_VARIABLE]: directory },
        timeout: SCRIPT_TIMEOUT_MS,
      });
      expect(run.status).not.toBe(0);
      expect(run.stderr).toContain(CONFIG_DIRECTORY_VARIABLE);
    },
  );

  test('runs every claude call through the isolated configuration', () => {
    const script = readRepositoryFile(SCRIPT);
    expect(script).toContain('CLAUDE_CONFIG_DIR="$claude_config_directory"');
    expect(script).toContain('HOME="$claude_config_directory"');
    expect(script).not.toMatch(BARE_CLAUDE_CALL);
    expect(script).not.toContain('claude mcp list');
    expect(script).toContain('.mcp.json');
  });
});
