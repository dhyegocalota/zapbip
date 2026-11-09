import { COMPANY_FACT_UNSET } from '@zapbip/types';
import { describe, expect, it } from 'vitest';
import { runDocsPreflightEntry } from '../../scripts/docs-preflight';
import type { ShellResult } from '../../src/operations/deploy-preflight';
import {
  COMPLETE_COMPANY,
  COMPLETE_VARIABLES,
  fakePackageFetcher,
  fakeShell,
  HOSTED_PLUGINS,
  NPM_VERSION,
  HOSTED_WHEEL_URL,
  OTHER_WHEEL_SHA256,
} from './fake-deploy-shell';
import type { PackageFetcher } from '../../src/operations/package-fetcher';

async function preflight(input: {
  company?: typeof COMPLETE_COMPANY;
  replies?: Record<string, ShellResult>;
  packageFetcher?: PackageFetcher;
}) {
  const { company = COMPLETE_COMPANY, replies, packageFetcher = fakePackageFetcher({}) } = input;
  const lines: string[] = [];
  const exitCode = await runDocsPreflightEntry({
    shell: fakeShell({ replies }),
    environmentVariables: COMPLETE_VARIABLES,
    company,
    npmVersion: NPM_VERSION,
    plugins: HOSTED_PLUGINS,
    packageFetcher,
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

  it('exits one saying the package does not resolve when npm answers E404 for the version and the name', async () => {
    const notFound = { exitCode: 1, stdout: JSON.stringify({ error: { code: 'E404' } }) };
    const { exitCode, output } = await preflight({ replies: { 'maintainers --json': notFound } });
    expect(exitCode).toBe(1);
    expect(output).toContain('does not resolve on npm; publish it first');
  });

  it('exits one saying the version does not resolve when npm has the package name but not the version', async () => {
    const notFound = { exitCode: 1, stdout: JSON.stringify({ error: { code: 'E404' } }) };
    const { exitCode, output } = await preflight({ replies: { [`zapbip@${NPM_VERSION} maintainers --json`]: notFound } });
    expect(exitCode).toBe(1);
    expect(output).toContain(`zapbip@${NPM_VERSION} does not resolve on npm; publish it first`);
  });

  it('exits one and names the wheel when the Worker does not host it', async () => {
    const { exitCode, output } = await preflight({
      packageFetcher: fakePackageFetcher({ answer: { status: 404, sha256: OTHER_WHEEL_SHA256, location: null } }),
    });
    expect(exitCode).toBe(1);
    expect(output).toContain(HOSTED_WHEEL_URL);
  });
});
