import { execFile } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import {
  COMPANY_FACT_UNSET,
  type CompanyFacts,
  OFFICIAL_NUMBER_UNSET,
  OFFICIAL_WHATSAPP_NUMBER,
  OPENCLAW_PLUGIN_NPM_VERSION,
  ZAPBIP_NPM_VERSION,
  ZAPBIP_PYPI_VERSION,
} from '@zapbip/types';
import { afterAll, describe, expect, test } from 'vitest';
import { readDeployBlock, runDeploy } from '../../scripts/deploy';
import { DeployEnvironment } from '../../src/operations/deploy-environment';
import { PreflightStep } from '../../src/operations/deploy-preflight';
import { PLACEHOLDER_VALUE_PREFIX } from '../../src/operations/constants';
import {
  COMPLETE_COMPANY,
  COMPLETE_VARIABLES,
  fakeNameserverResolver,
  fakePackageFetcher,
  fakeShell,
  OFFICIAL_NUMBER,
  READY_WORKER_FACTS,
} from '../unit/fake-deploy-shell';

const runCommand = promisify(execFile);
const DRY_RUN_TIMEOUT_MS = 120_000;
const MIGRATIONS_LIST = 'd1 migrations list';
const WORKER_DEPLOY = 'wrangler deploy';
const PENDING_MIGRATIONS = { exitCode: 0, stdout: '0002_accounts_and_keys.sql' };
const UNRESOLVED_NPM = { exitCode: 1, stdout: JSON.stringify({ error: { code: 'E404' } }) };
const UNSET_COMPANY: CompanyFacts = {
  legalName: COMPANY_FACT_UNSET,
  tradeName: COMPANY_FACT_UNSET,
  cnpj: COMPANY_FACT_UNSET,
  address: COMPANY_FACT_UNSET,
  website: COMPANY_FACT_UNSET,
  contactEmail: COMPANY_FACT_UNSET,
};
const PLACEHOLDER_PATTERN = new RegExp(`${PLACEHOLDER_VALUE_PREFIX}\\w+`, 'g');
const RESOLVED_VALUE = 'resolved-value';
const EXPECTED_BINDINGS = [
  'ACCOUNT_INBOX',
  'CONNECTIONS',
  'MEDIA',
  'WAKE_METRICS',
  'OWNER_RATE_LIMITER',
  'OUTBOUND_RATE_LIMITER',
  'ACCOUNT_OUTBOUND_RATE_LIMITER',
  'INSTALL_PAGE_LIMITER',
  'PUBLIC_ORIGIN',
];

const outputDirectories: string[] = [];

async function dryRunOutput(input: { extraArguments: string[] }): Promise<string> {
  const outputDirectory = await mkdtemp(join(tmpdir(), 'zapbip-dry-run-'));
  outputDirectories.push(outputDirectory);
  const { stdout, stderr } = await runCommand('pnpm', [
    'exec',
    'wrangler',
    'deploy',
    '--dry-run',
    ...input.extraArguments,
    '--outdir',
    outputDirectory,
  ]);
  return `${stdout}\n${stderr}`;
}

function resolvedBlockOf(input: { environment: DeployEnvironment }) {
  const block = JSON.stringify(readDeployBlock({ environment: input.environment }));
  return JSON.parse(block.replace(PLACEHOLDER_PATTERN, RESOLVED_VALUE));
}

async function refusalOf(input: {
  environment: DeployEnvironment;
  officialWhatsAppNumber: string;
  company: CompanyFacts;
  replies?: Record<string, { exitCode: number; stdout: string }>;
}) {
  const shell = fakeShell({ replies: input.replies });
  const lines: string[] = [];
  const exitCode = await runDeploy({
    environment: input.environment,
    firstDeploy: false,
    block: resolvedBlockOf({ environment: input.environment }),
    workerFacts: READY_WORKER_FACTS,
    shell,
    prompt: { ask: async () => DeployEnvironment.Production },
    isInteractive: true,
    environmentVariables: { ...COMPLETE_VARIABLES, SMOKE_BASE_URL: 'https://mcp.zapbip.com' },
    officialWhatsAppNumber: input.officialWhatsAppNumber,
    company: input.company,
    npmVersion: ZAPBIP_NPM_VERSION,
    openclawPluginVersion: OPENCLAW_PLUGIN_NPM_VERSION,
    pypiVersion: ZAPBIP_PYPI_VERSION,
    packageFetcher: fakePackageFetcher({}),
    nameserverResolver: fakeNameserverResolver({}),
    log: (line) => lines.push(line),
  });
  return { exitCode, shell, output: lines.join('\n') };
}

afterAll(async () => {
  await Promise.all(outputDirectories.map((directory) => rm(directory, { recursive: true, force: true })));
});

describe('wrangler dry run of every deployed block', () => {
  test.each([
    { name: 'production', extraArguments: [] },
    { name: 'staging', extraArguments: ['--env', 'staging'] },
  ])(
    'the $name block bundles with every binding',
    async ({ extraArguments }) => {
      const output = await dryRunOutput({ extraArguments });
      const missing = EXPECTED_BINDINGS.filter((binding) => !output.includes(binding));
      expect(missing).toEqual([]);
    },
    DRY_RUN_TIMEOUT_MS,
  );
});

describe('preflight against the real constants and the real wrangler blocks', () => {
  test('production is refused while the official number is the sentinel', async () => {
    expect(OFFICIAL_WHATSAPP_NUMBER).toBe(OFFICIAL_NUMBER_UNSET);
    const { exitCode, output } = await refusalOf({
      environment: DeployEnvironment.Production,
      officialWhatsAppNumber: OFFICIAL_WHATSAPP_NUMBER,
      company: COMPLETE_COMPANY,
    });
    expect(exitCode).toBe(1);
    expect(output).toContain(`refused at ${PreflightStep.OfficialNumber}`);
  });

  test('production is refused while the company facts are the sentinel', async () => {
    const { exitCode, output } = await refusalOf({
      environment: DeployEnvironment.Production,
      officialWhatsAppNumber: OFFICIAL_NUMBER,
      company: UNSET_COMPANY,
    });
    expect(exitCode).toBe(1);
    expect(output).toContain(`refused at ${PreflightStep.CompanyFacts}`);
  });

  test('production is refused while the npm package does not resolve', async () => {
    const { exitCode, output } = await refusalOf({
      environment: DeployEnvironment.Production,
      officialWhatsAppNumber: OFFICIAL_NUMBER,
      company: COMPLETE_COMPANY,
      replies: { 'maintainers --json': UNRESOLVED_NPM },
    });
    expect(exitCode).toBe(1);
    expect(output).toContain(`refused at ${PreflightStep.NpmVersion}`);
  });

  test('a pending D1 migration stops the deploy before any Worker deploy', async () => {
    const { exitCode, output, shell } = await refusalOf({
      environment: DeployEnvironment.Staging,
      officialWhatsAppNumber: OFFICIAL_NUMBER,
      company: COMPLETE_COMPANY,
      replies: { [MIGRATIONS_LIST]: PENDING_MIGRATIONS },
    });
    expect(exitCode).toBe(1);
    expect(output).toContain(`refused at ${PreflightStep.Migrations}`);
    expect(shell.commands.filter((command) => command.includes(WORKER_DEPLOY))).toEqual([]);
  });

  test('a deploy with nothing pending lists the migrations before it deploys the Worker', async () => {
    const { exitCode, shell } = await refusalOf({
      environment: DeployEnvironment.Staging,
      officialWhatsAppNumber: OFFICIAL_NUMBER,
      company: COMPLETE_COMPANY,
    });
    const listedAt = shell.commands.findIndex((command) => command.includes(MIGRATIONS_LIST));
    const deployedAt = shell.commands.findIndex((command) => command.includes(WORKER_DEPLOY));
    expect(exitCode).toBe(0);
    expect(listedAt).toBeGreaterThanOrEqual(0);
    expect(listedAt).toBeLessThan(deployedAt);
  });
});
