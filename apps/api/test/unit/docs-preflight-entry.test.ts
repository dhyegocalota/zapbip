import { COMPANY_FACT_UNSET } from '@zapbip/types';
import { describe, expect, it } from 'vitest';
import { runDocsPreflightEntry } from '../../scripts/docs-preflight';
import type { ShellResult } from '../../src/operations/deploy-preflight';
import { COMPLETE_COMPANY, COMPLETE_VARIABLES, fakeShell, NPM_VERSION, OFFICIAL_NUMBER } from './fake-deploy-shell';

async function preflight(input: { company?: typeof COMPLETE_COMPANY; replies?: Record<string, ShellResult> }) {
  const { company = COMPLETE_COMPANY, replies } = input;
  const lines: string[] = [];
  const exitCode = await runDocsPreflightEntry({
    shell: fakeShell({ replies }),
    environmentVariables: COMPLETE_VARIABLES,
    officialWhatsAppNumber: OFFICIAL_NUMBER,
    company,
    npmVersion: NPM_VERSION,
    openclawPluginVersion: NPM_VERSION,
    log: (line) => lines.push(line),
  });
  return { exitCode, output: lines.join('\n') };
}

describe('docs preflight entry', () => {
  it('exits zero and says the docs are ready when everything resolves', async () => {
    const { exitCode, output } = await preflight({});
    expect(exitCode).toBe(0);
    expect(output).toContain('ready');
  });

  it('exits one and prints the refusal when a company fact is unset', async () => {
    const { exitCode, output } = await preflight({ company: { ...COMPLETE_COMPANY, cnpj: COMPANY_FACT_UNSET } });
    expect(exitCode).toBe(1);
    expect(output).toContain('cnpj');
  });

  it('exits one when a package does not resolve on npm', async () => {
    const { exitCode, output } = await preflight({ replies: { 'maintainers --json': { exitCode: 1, stdout: '' } } });
    expect(exitCode).toBe(1);
    expect(output).toContain(`zapbip@${NPM_VERSION}`);
  });
});
