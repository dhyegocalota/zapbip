import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';

const SCRIPT = join(import.meta.dirname, 'install-e2e.sh');
const SCRIPT_TIMEOUT_MS = 30_000;
const CONFIG_DIRECTORY_VARIABLE = 'ZAPBIP_E2E_CLAUDE_CONFIG_DIR';
const BARE_CLAUDE_CALL = /^\s*(run_logged\s+)?claude\b/m;

const script = readFileSync(SCRIPT, 'utf8');

describe('the owner-run install script', () => {
  test('applies the directory migrations, then seeds through the running worker and shows seed errors', () => {
    expect(script.indexOf('d1 migrations apply')).toBeGreaterThan(-1);
    expect(script.indexOf('d1 migrations apply')).toBeLessThan(script.indexOf('dev:seed'));
    expect(script.indexOf('wrangler dev')).toBeLessThan(script.indexOf('dev:seed'));
    expect(script).toContain('dev:seed --origin');
    expect(script).toContain('--env development');
    expect(script).not.toMatch(/dev:seed[^\n]*>\/dev\/null/);
    expect(script).toContain('fail "the seed failed');
  });

  test('keeps the owner Claude configuration untouched by installing at project scope', () => {
    expect(script).toContain('--scope project');
    expect(script).toContain('.claude/skills/zapbip/SKILL.md');
    expect(script).not.toContain('--scope user');
  });

  test('refuses to run without an isolated Claude configuration directory', () => {
    const environment = Object.fromEntries(Object.entries(process.env).filter(([name]) => name !== CONFIG_DIRECTORY_VARIABLE));
    const run = spawnSync('bash', [SCRIPT], { encoding: 'utf8', env: environment, timeout: SCRIPT_TIMEOUT_MS });
    expect(run.status).not.toBe(0);
    expect(run.stderr).toContain(CONFIG_DIRECTORY_VARIABLE);
  });

  test.each([join(homedir(), '.claude'), homedir(), 'relative/directory'])(
    'refuses %s as the Claude configuration directory',
    (directory) => {
      const run = spawnSync('bash', [SCRIPT], {
        encoding: 'utf8',
        env: { ...process.env, [CONFIG_DIRECTORY_VARIABLE]: directory },
        timeout: SCRIPT_TIMEOUT_MS,
      });
      expect(run.status).not.toBe(0);
      expect(run.stderr).toContain(CONFIG_DIRECTORY_VARIABLE);
    },
  );

  test('runs every claude call through the isolated configuration', () => {
    expect(script).toContain('CLAUDE_CONFIG_DIR="$claude_config_directory"');
    expect(script).toContain('HOME="$claude_config_directory"');
    expect(script).not.toMatch(BARE_CLAUDE_CALL);
    expect(script).not.toContain('claude mcp list');
    expect(script).toContain('.mcp.json');
  });
});
