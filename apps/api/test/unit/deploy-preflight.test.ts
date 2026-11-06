import { OFFICIAL_NUMBER_UNSET } from '@zapbip/types';
import { describe, expect, it } from 'vitest';
import { PLACEHOLDER_VALUE_PREFIX } from '../../src/operations/constants';
import { DeployEnvironment } from '../../src/operations/deploy-environment';
import {
  type DeployBlock,
  type EnvironmentVariables,
  PreflightStep,
  type WorkerFacts,
  runDocsPreflight,
  runWorkerPreflight,
} from '../../src/operations/deploy-preflight';
import { SmokeInput } from '../../src/operations/smoke-inputs';
import { WorkerSecret } from '../../src/operations/worker-secret';
import {
  blockOf,
  COMPLETE_VARIABLES,
  type FakeShell,
  fakeShell,
  NPM_VERSION,
  OFFICIAL_NUMBER,
  READY_WORKER_FACTS,
} from './fake-deploy-shell';

function workerInput(input: {
  environment?: DeployEnvironment;
  shell?: FakeShell;
  block?: DeployBlock;
  isInteractive?: boolean;
  firstDeploy?: boolean;
  environmentVariables?: EnvironmentVariables;
  officialWhatsAppNumber?: string;
  workerFacts?: WorkerFacts;
}) {
  const { environment = DeployEnvironment.Staging, isInteractive = true, firstDeploy = false } = input;
  const { shell = fakeShell({}), environmentVariables = COMPLETE_VARIABLES, officialWhatsAppNumber = OFFICIAL_NUMBER } = input;
  const { block = blockOf({ environment }), workerFacts = READY_WORKER_FACTS } = input;
  return { environment, firstDeploy, block, workerFacts, shell, isInteractive, environmentVariables, officialWhatsAppNumber };
}

describe('worker preflight', () => {
  it('passes when every step passes', async () => {
    expect(await runWorkerPreflight(workerInput({}))).toBeNull();
  });

  it('refuses development and records no command', async () => {
    const shell = fakeShell({});
    const refusal = await runWorkerPreflight(workerInput({ environment: DeployEnvironment.Development, shell }));
    expect(refusal?.step).toBe(PreflightStep.Environment);
    expect(refusal?.message).toContain('staging or production');
    expect(shell.commands).toEqual([]);
  });

  it('refuses a terminal that is not interactive and records no command', async () => {
    const shell = fakeShell({});
    const refusal = await runWorkerPreflight(workerInput({ environment: DeployEnvironment.Production, shell, isInteractive: false }));
    expect(refusal?.step).toBe(PreflightStep.Environment);
    expect(refusal?.message).toContain('interactive');
    expect(shell.commands).toEqual([]);
  });

  it('refuses while the official number is the unset sentinel, before any command', async () => {
    const shell = fakeShell({});
    const refusal = await runWorkerPreflight(workerInput({ shell, officialWhatsAppNumber: OFFICIAL_NUMBER_UNSET }));
    expect(refusal?.step).toBe(PreflightStep.OfficialNumber);
    expect(refusal?.message).toContain('OFFICIAL_WHATSAPP_NUMBER');
    expect(shell.commands).toEqual([]);
  });

  it('refuses production from a branch other than main', async () => {
    const shell = fakeShell({ replies: { 'git rev-parse --abbrev-ref HEAD': { exitCode: 0, stdout: 'feat/x\n' } } });
    const refusal = await runWorkerPreflight(workerInput({ environment: DeployEnvironment.Production, shell }));
    expect(refusal?.step).toBe(PreflightStep.Git);
    expect(refusal?.message).toContain('main');
  });

  it.each([DeployEnvironment.Staging, DeployEnvironment.Production])('refuses a dirty tree on %s', async (environment) => {
    const shell = fakeShell({ replies: { 'git status --porcelain': { exitCode: 0, stdout: ' M file.ts\n' } } });
    const refusal = await runWorkerPreflight(workerInput({ environment, shell }));
    expect(refusal?.step).toBe(PreflightStep.Git);
    expect(refusal?.message).toContain('uncommitted');
  });

  it('refuses production when HEAD differs from origin/main, fetching first', async () => {
    const shell = fakeShell({ replies: { 'git rev-parse HEAD': { exitCode: 0, stdout: 'def456\n' } } });
    const refusal = await runWorkerPreflight(workerInput({ environment: DeployEnvironment.Production, shell }));
    expect(refusal?.step).toBe(PreflightStep.Git);
    expect(refusal?.message).toContain('origin/main');
    const fetchIndex = shell.commands.findIndex((command) => command.includes('git fetch origin main'));
    const compareIndex = shell.commands.findIndex((command) => command.includes('git rev-parse origin/main'));
    expect(fetchIndex).toBeGreaterThanOrEqual(0);
    expect(fetchIndex).toBeLessThan(compareIndex);
  });

  it('lets staging deploy from a feature branch', async () => {
    const shell = fakeShell({ replies: { 'git rev-parse --abbrev-ref HEAD': { exitCode: 0, stdout: 'feat/x\n' } } });
    expect(await runWorkerPreflight(workerInput({ shell }))).toBeNull();
  });

  it('runs the full gate for production and the plain gate for staging', async () => {
    const production = fakeShell({});
    await runWorkerPreflight(workerInput({ environment: DeployEnvironment.Production, shell: production }));
    expect(production.commands).toContain('pnpm verify all');
    const staging = fakeShell({});
    await runWorkerPreflight(workerInput({ shell: staging }));
    expect(staging.commands).toContain('pnpm verify');
  });

  it('refuses when the gate fails and runs nothing after it', async () => {
    const shell = fakeShell({ replies: { 'pnpm verify': { exitCode: 1, stdout: '' } } });
    const refusal = await runWorkerPreflight(workerInput({ shell }));
    expect(refusal?.step).toBe(PreflightStep.Gate);
    expect(shell.commands.some((command) => command.includes('secret list'))).toBe(false);
  });

  it('refuses a placeholder database id, naming database_id', async () => {
    const block = blockOf({ environment: DeployEnvironment.Staging, databaseId: `${PLACEHOLDER_VALUE_PREFIX}STAGING_D1_DATABASE_ID` });
    const refusal = await runWorkerPreflight(workerInput({ block }));
    expect(refusal?.step).toBe(PreflightStep.Config);
    expect(refusal?.message).toContain('database_id');
  });

  it('refuses a placeholder bucket, naming bucket_name', async () => {
    const block = blockOf({ environment: DeployEnvironment.Production, bucketName: `${PLACEHOLDER_VALUE_PREFIX}bucket` });
    const refusal = await runWorkerPreflight(workerInput({ environment: DeployEnvironment.Production, block }));
    expect(refusal?.step).toBe(PreflightStep.Config);
    expect(refusal?.message).toContain('bucket_name');
  });

  it('refuses a placeholder anywhere else in the block', async () => {
    const block = { ...blockOf({ environment: DeployEnvironment.Staging }), vars: { PUBLIC_ORIGIN: `${PLACEHOLDER_VALUE_PREFIX}ORIGIN` } };
    const refusal = await runWorkerPreflight(workerInput({ block }));
    expect(refusal?.step).toBe(PreflightStep.Config);
    expect(refusal?.message).toContain('PUBLIC_ORIGIN');
  });

  it('refuses production when the Worker does not export scheduled', async () => {
    const workerFacts = { ...READY_WORKER_FACTS, exportsScheduled: false };
    const refusal = await runWorkerPreflight(workerInput({ environment: DeployEnvironment.Production, workerFacts }));
    expect(refusal?.step).toBe(PreflightStep.Readiness);
    expect(refusal?.message).toContain('scheduled');
  });

  it('refuses production when the install route is not mounted', async () => {
    const workerFacts = { ...READY_WORKER_FACTS, mountsInstallRoute: false };
    const refusal = await runWorkerPreflight(workerInput({ environment: DeployEnvironment.Production, workerFacts }));
    expect(refusal?.step).toBe(PreflightStep.Readiness);
    expect(refusal?.message).toContain('/i/:installCode');
  });

  it('refuses production when wrangler has no cron trigger', async () => {
    const block = { ...blockOf({ environment: DeployEnvironment.Production }), triggers: { crons: [] } };
    const refusal = await runWorkerPreflight(workerInput({ environment: DeployEnvironment.Production, block }));
    expect(refusal?.step).toBe(PreflightStep.Readiness);
    expect(refusal?.message).toContain('cron');
  });

  it('does not require the production readiness facts on staging', async () => {
    const workerFacts = { exportsScheduled: false, mountsInstallRoute: false };
    expect(await runWorkerPreflight(workerInput({ workerFacts }))).toBeNull();
  });

  it('lists the missing secret and only it', async () => {
    const present = Object.values(WorkerSecret)
      .filter((name) => name !== WorkerSecret.WakeSecretKey)
      .map((name) => ({ name }));
    const shell = fakeShell({ replies: { 'secret list': { exitCode: 0, stdout: JSON.stringify(present) } } });
    const refusal = await runWorkerPreflight(workerInput({ shell }));
    expect(refusal?.step).toBe(PreflightStep.Secrets);
    expect(refusal?.message).toContain(WorkerSecret.WakeSecretKey);
    expect(refusal?.message).not.toContain(WorkerSecret.MetaAppSecret);
  });

  it('lists secrets with the environment flag on staging and without it on production', async () => {
    const staging = fakeShell({});
    await runWorkerPreflight(workerInput({ shell: staging }));
    expect(staging.commands).toContain('pnpm --filter @zapbip/api exec wrangler secret list --env staging --format json');
    const production = fakeShell({});
    await runWorkerPreflight(workerInput({ environment: DeployEnvironment.Production, shell: production }));
    expect(production.commands).toContain('pnpm --filter @zapbip/api exec wrangler secret list --format json');
    expect(production.commands.filter((command) => command.includes('--env'))).toEqual([]);
  });

  it('refuses a pending migration and prints the migrate command', async () => {
    const shell = fakeShell({ replies: { 'migrations list': { exitCode: 0, stdout: '0003_usage.sql' } } });
    const refusal = await runWorkerPreflight(workerInput({ shell }));
    expect(refusal?.step).toBe(PreflightStep.Migrations);
    expect(refusal?.message).toContain('pnpm migrate:staging');
  });

  it('reads migrations of the environment database, remotely', async () => {
    const shell = fakeShell({});
    await runWorkerPreflight(workerInput({ shell }));
    expect(shell.commands).toContain('pnpm --filter @zapbip/api exec wrangler d1 migrations list zapbip-staging --env staging --remote');
  });

  it('refuses a missing smoke input before any later step', async () => {
    const environmentVariables = { ...COMPLETE_VARIABLES, [SmokeInput.OwnerPhone]: undefined };
    const refusal = await runWorkerPreflight(workerInput({ environmentVariables }));
    expect(refusal?.step).toBe(PreflightStep.SmokeInputs);
    expect(refusal?.message).toContain(SmokeInput.OwnerPhone);
  });

  it('refuses a placeholder smoke input', async () => {
    const environmentVariables = { ...COMPLETE_VARIABLES, [SmokeInput.ConnectionSecret]: `${PLACEHOLDER_VALUE_PREFIX}x` };
    const refusal = await runWorkerPreflight(workerInput({ environmentVariables }));
    expect(refusal?.message).toContain(SmokeInput.ConnectionSecret);
  });

  it('does not ask for the smoke connection on a first deploy', async () => {
    const environmentVariables = {
      ...COMPLETE_VARIABLES,
      [SmokeInput.ConnectionSecret]: `${PLACEHOLDER_VALUE_PREFIX}x`,
      [SmokeInput.OwnerPhone]: undefined,
    };
    expect(await runWorkerPreflight(workerInput({ environmentVariables, firstDeploy: true }))).toBeNull();
  });
});

describe('docs preflight', () => {
  it('refuses while the official number is the unset sentinel, before any command', async () => {
    const shell = fakeShell({});
    const refusal = await runDocsPreflight({ shell, officialWhatsAppNumber: OFFICIAL_NUMBER_UNSET, npmVersion: NPM_VERSION });
    expect(refusal?.step).toBe(PreflightStep.OfficialNumber);
    expect(shell.commands).toEqual([]);
  });

  it('refuses until npm view resolves the pinned version, naming it', async () => {
    const shell = fakeShell({ replies: { 'npm view': { exitCode: 1, stdout: '' } } });
    const refusal = await runDocsPreflight({ shell, officialWhatsAppNumber: OFFICIAL_NUMBER, npmVersion: NPM_VERSION });
    expect(refusal?.step).toBe(PreflightStep.NpmVersion);
    expect(refusal?.message).toContain(`zapbip@${NPM_VERSION}`);
    expect(shell.commands).toEqual([`npm view zapbip@${NPM_VERSION} version`]);
  });

  it('passes when the number is set and the version resolves', async () => {
    const shell = fakeShell({});
    expect(await runDocsPreflight({ shell, officialWhatsAppNumber: OFFICIAL_NUMBER, npmVersion: NPM_VERSION })).toBeNull();
  });
});
