import { COMPANY_FACT_UNSET, NPM_REGISTRY_URL, PRODUCTION_PUBLIC_ORIGIN, START_LINK, WHATSAPP_LINK_ORIGIN } from '@zapbip/types';
import type { CompanyFacts } from '@zapbip/types';
import { describe, expect, it } from 'vitest';
import { PLACEHOLDER_VALUE_PREFIX } from '../../src/operations/constants';
import { DeployEnvironment } from '../../src/operations/deploy-environment';
import {
  type DeployBlock,
  type EnvironmentVariables,
  PreflightStep,
  type PreflightWarning,
  PreflightWarningKind,
  type WorkerFacts,
  runDocsPreflight,
  runWorkerPreflight,
} from '../../src/operations/deploy-preflight';
import { SmokeInput } from '../../src/operations/smoke-inputs';
import { WarnedWorkerSecret, WorkerSecret } from '../../src/operations/worker-secret';
import {
  blockOf,
  COMPLETE_COMPANY,
  COMPLETE_VARIABLES,
  type FakeNameserverResolver,
  type FakePackageFetcher,
  fakeNameserverResolver,
  type FakeShell,
  fakePackageFetcher,
  fakeShell,
  NPM_PUBLISHER,
  NPM_PUBLISHER_VARIABLE,
  HOSTED_PLUGINS,
  HOSTED_REQUIREMENTS_FILENAME,
  HOSTED_WHEEL_FILENAME,
  NPM_VERSION,
  HOSTED_PLUGIN_VERSION,
  HOSTED_REQUIREMENTS_SHA256,
  HOSTED_REQUIREMENTS_URL,
  HOSTED_WHEEL_SHA256,
  HOSTED_WHEEL_URL,
  OTHER_WHEEL_SHA256,
  READY_WORKER_FACTS,
  START_LINK_FOUND,
} from './fake-deploy-shell';
import { SAMPLE_NPM_PACKAGE_NAME } from '../support/hosted-plugin-sample';

function workerInput(input: {
  environment?: DeployEnvironment;
  shell?: FakeShell;
  block?: DeployBlock;
  isInteractive?: boolean;
  firstDeploy?: boolean;
  environmentVariables?: EnvironmentVariables;
  company?: CompanyFacts;
  npmVersion?: string;
  packageFetcher?: FakePackageFetcher;
  nameserverResolver?: FakeNameserverResolver;
  workerFacts?: WorkerFacts;
  warnings?: PreflightWarning[];
}) {
  const { environment = DeployEnvironment.Staging, isInteractive = true, firstDeploy = false, warnings = [] } = input;
  const { shell = fakeShell({}), environmentVariables = COMPLETE_VARIABLES } = input;
  const {
    block = blockOf({ environment }),
    workerFacts = READY_WORKER_FACTS,
    company = COMPLETE_COMPANY,
    npmVersion = NPM_VERSION,
    packageFetcher = fakePackageFetcher({}),
    nameserverResolver = fakeNameserverResolver({}),
  } = input;
  return {
    environment,
    firstDeploy,
    block,
    workerFacts,
    shell,
    isInteractive,
    environmentVariables,
    company,
    npmVersion,
    plugins: HOSTED_PLUGINS,
    packageFetcher,
    nameserverResolver,
    warn: (warning: PreflightWarning) => warnings.push(warning),
  };
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

  it('passes production when every step passes, with no number input', async () => {
    expect(await runWorkerPreflight(workerInput({ environment: DeployEnvironment.Production }))).toBeNull();
  });

  it.each(['legalName', 'cnpj', 'address', 'website', 'contactEmail'])(
    'refuses production while company %s is unset, before any command',
    async (field) => {
      const shell = fakeShell({});
      const company = { ...COMPLETE_COMPANY, [field]: COMPANY_FACT_UNSET };
      const refusal = await runWorkerPreflight(workerInput({ environment: DeployEnvironment.Production, shell, company }));
      expect(refusal?.step).toBe(PreflightStep.CompanyFacts);
      expect(refusal?.message).toContain(field);
      expect(shell.commands).toEqual([]);
    },
  );

  it('refuses production until the zapbip package resolves on npm, naming it', async () => {
    const shell = fakeShell({ replies: { 'maintainers --json': { exitCode: 1, stdout: '' } } });
    const refusal = await runWorkerPreflight(workerInput({ environment: DeployEnvironment.Production, shell }));
    expect(refusal?.step).toBe(PreflightStep.NpmVersion);
    expect(refusal?.message).toContain(`zapbip@${NPM_VERSION}`);
    expect(shell.commands).toEqual([
      `npm view zapbip@${NPM_VERSION} maintainers --json --registry=${NPM_REGISTRY_URL} --@zapbip:registry=${NPM_REGISTRY_URL}`,
    ]);
  });

  it('refuses production when the maintainers do not include the owner npm user', async () => {
    const shell = fakeShell({
      replies: { 'maintainers --json': { exitCode: 0, stdout: JSON.stringify(['someone-else <x@example.com>']) } },
    });
    const refusal = await runWorkerPreflight(workerInput({ environment: DeployEnvironment.Production, shell }));
    expect(refusal?.step).toBe(PreflightStep.NpmVersion);
    expect(refusal?.message).toContain(NPM_PUBLISHER);
  });

  it.each([undefined, '', `${PLACEHOLDER_VALUE_PREFIX}NPM_USER`])(
    'refuses production when ZAPBIP_NPM_PUBLISHER is %j, running no npm command',
    async (value) => {
      const shell = fakeShell({});
      const environmentVariables = { ...COMPLETE_VARIABLES, [NPM_PUBLISHER_VARIABLE]: value };
      const refusal = await runWorkerPreflight(workerInput({ environment: DeployEnvironment.Production, shell, environmentVariables }));
      expect(refusal?.step).toBe(PreflightStep.NpmVersion);
      expect(refusal?.message).toContain(NPM_PUBLISHER_VARIABLE);
      expect(shell.commands).toEqual([]);
    },
  );

  it('refuses production until the npm plugin also resolves, with the owner as its only maintainer and publisher', async () => {
    const shell = fakeShell({ replies: { [`${SAMPLE_NPM_PACKAGE_NAME}@0.1.0 maintainers --json`]: { exitCode: 1, stdout: '' } } });
    const refusal = await runWorkerPreflight(workerInput({ environment: DeployEnvironment.Production, shell }));
    expect(refusal?.step).toBe(PreflightStep.NpmVersion);
    expect(refusal?.message).toContain(`${SAMPLE_NPM_PACKAGE_NAME}@0.1.0`);
  });

  it('passes production when the hosted wheel hashes to the constant, reading it from the bucket through wrangler', async () => {
    const shell = fakeShell({});
    expect(await runWorkerPreflight(workerInput({ environment: DeployEnvironment.Production, shell }))).toBeNull();
    const [getCommand, hashCommand, removeCommand] = shell.commands.filter(
      (command) => command.includes('r2 object get') || command.startsWith('shasum') || command.startsWith('rm'),
    );
    expect(getCommand).toContain(`r2 object get zapbip-packages/${HOSTED_WHEEL_FILENAME} --remote --file `);
    expect(hashCommand).toContain('shasum -a 256 ');
    expect(removeCommand).toContain('rm -f ');
  });

  it('refuses production when the hosted wheel hashes to something else, naming both hashes', async () => {
    const shell = fakeShell({ replies: { 'shasum -a 256': { exitCode: 0, stdout: `${OTHER_WHEEL_SHA256}  /tmp/zapbip-wheel.whl\n` } } });
    const refusal = await runWorkerPreflight(workerInput({ environment: DeployEnvironment.Production, shell }));
    expect(refusal?.step).toBe(PreflightStep.PluginWheel);
    expect(refusal?.message).toContain(HOSTED_WHEEL_SHA256);
    expect(refusal?.message).toContain(OTHER_WHEEL_SHA256);
  });

  it('refuses production when the wheel is not in the bucket, naming the upload step', async () => {
    const shell = fakeShell({ replies: { 'r2 object get': { exitCode: 1, stdout: 'The specified key does not exist' } } });
    const refusal = await runWorkerPreflight(workerInput({ environment: DeployEnvironment.Production, shell }));
    expect(refusal?.step).toBe(PreflightStep.PluginWheel);
    expect(refusal?.message).toContain(`${HOSTED_WHEEL_FILENAME}`);
    expect(refusal?.message).toContain('wrangler r2 object put');
  });

  it('also reads the requirements file from the bucket', async () => {
    const shell = fakeShell({});
    await runWorkerPreflight(workerInput({ environment: DeployEnvironment.Production, shell }));
    expect(shell.commands.some((command) => command.includes(`r2 object get zapbip-packages/${HOSTED_REQUIREMENTS_FILENAME} `))).toBe(true);
  });

  it('refuses production when the hosted requirements file hashes to something else, naming both hashes', async () => {
    const shell = fakeShell({
      replies: { 'requirements.txt': { exitCode: 0, stdout: `${OTHER_WHEEL_SHA256}  /tmp/zapbip-requirements.txt\n` } },
    });
    const refusal = await runWorkerPreflight(workerInput({ environment: DeployEnvironment.Production, shell }));
    expect(refusal?.step).toBe(PreflightStep.PluginWheel);
    expect(refusal?.message).toContain('requirements.txt');
    expect(refusal?.message).toContain(HOSTED_REQUIREMENTS_SHA256);
    expect(refusal?.message).toContain(OTHER_WHEEL_SHA256);
  });

  it('refuses production when the requirements file is not in the bucket, naming the upload step', async () => {
    const missing = `r2 object get zapbip-packages/${HOSTED_REQUIREMENTS_FILENAME}`;
    const shell = fakeShell({ replies: { [missing]: { exitCode: 1, stdout: 'The specified key does not exist' } } });
    const refusal = await runWorkerPreflight(workerInput({ environment: DeployEnvironment.Production, shell }));
    expect(refusal?.step).toBe(PreflightStep.PluginWheel);
    expect(refusal?.message).toContain(`${HOSTED_REQUIREMENTS_FILENAME}`);
    expect(refusal?.message).toContain('wrangler r2 object put');
  });

  it('refuses production when the downloaded wheel cannot be hashed', async () => {
    const shell = fakeShell({ replies: { 'shasum -a 256': { exitCode: 1, stdout: '' } } });
    const refusal = await runWorkerPreflight(workerInput({ environment: DeployEnvironment.Production, shell }));
    expect(refusal?.step).toBe(PreflightStep.PluginWheel);
    expect(refusal?.message).toContain('could not hash');
  });

  it('does not require a PyPI publisher variable', async () => {
    const { ZAPBIP_NPM_PUBLISHER: publisher } = COMPLETE_VARIABLES;
    const environmentVariables = { ZAPBIP_NPM_PUBLISHER: publisher };
    const refusal = await runWorkerPreflight(workerInput({ environment: DeployEnvironment.Production, environmentVariables }));
    expect(refusal === null || refusal.step !== PreflightStep.PluginWheel).toBe(true);
  });

  it('checks npm before the wheel, so a missing npm package never reads the bucket', async () => {
    const shell = fakeShell({ replies: { 'maintainers --json': { exitCode: 1, stdout: '' } } });
    const refusal = await runWorkerPreflight(workerInput({ environment: DeployEnvironment.Production, shell }));
    expect(refusal?.step).toBe(PreflightStep.NpmVersion);
    expect(shell.commands.some((command) => command.includes('r2 object get'))).toBe(false);
  });

  it('does not read the bucket for a staging deploy', async () => {
    const shell = fakeShell({});
    expect(await runWorkerPreflight(workerInput({ shell }))).toBeNull();
    expect(shell.commands.some((command) => command.includes('r2 object get'))).toBe(false);
  });

  it('says npm could not be reached, not that the package is missing, when the failure is a network error', async () => {
    const networkError = JSON.stringify({ error: { code: 'ENOTFOUND', summary: 'request to https://registry.npmjs.org failed' } });
    const shell = fakeShell({ replies: { 'maintainers --json': { exitCode: 1, stdout: networkError } } });
    const refusal = await runWorkerPreflight(workerInput({ environment: DeployEnvironment.Production, shell }));
    expect(refusal?.step).toBe(PreflightStep.NpmVersion);
    expect(refusal?.message).toContain('could not reach npm');
    expect(refusal?.message).toContain('ENOTFOUND');
    expect(refusal?.message).not.toContain('does not resolve');
  });

  it('warns and passes when npm answers E404, so an unpublished package never blocks production', async () => {
    const notFound = JSON.stringify({ error: { code: 'E404', summary: 'not found' } });
    const shell = fakeShell({ replies: { 'maintainers --json': { exitCode: 1, stdout: notFound } } });
    const warnings: PreflightWarning[] = [];
    const refusal = await runWorkerPreflight(workerInput({ environment: DeployEnvironment.Production, shell, warnings }));
    expect(refusal).toBeNull();
    expect(warnings).toContainEqual({
      kind: PreflightWarningKind.PackageUnpublished,
      message: `zapbip@${NPM_VERSION} is not on npm yet; publish it before launch`,
    });
  });

  it('warns and passes when the version is absent but the package name belongs to the owner', async () => {
    const notFound = JSON.stringify({ error: { code: 'E404' } });
    const shell = fakeShell({ replies: { [`zapbip@${NPM_VERSION} maintainers --json`]: { exitCode: 1, stdout: notFound } } });
    const warnings: PreflightWarning[] = [];
    const refusal = await runWorkerPreflight(workerInput({ environment: DeployEnvironment.Production, shell, warnings }));
    expect(refusal).toBeNull();
    expect(warnings).toContainEqual({
      kind: PreflightWarningKind.PackageUnpublished,
      message: `zapbip@${NPM_VERSION} is not on npm yet; publish it before launch`,
    });
  });

  it('refuses production when the version is absent but the package name belongs to a foreign maintainer', async () => {
    const notFound = JSON.stringify({ error: { code: 'E404' } });
    const squatter = JSON.stringify(['squatter <s@example.com>']);
    const shell = fakeShell({
      replies: {
        [`zapbip@${NPM_VERSION} maintainers --json`]: { exitCode: 1, stdout: notFound },
        'view zapbip maintainers --json': { exitCode: 0, stdout: squatter },
      },
    });
    const warnings: PreflightWarning[] = [];
    const refusal = await runWorkerPreflight(workerInput({ environment: DeployEnvironment.Production, shell, warnings }));
    expect(refusal?.step).toBe(PreflightStep.NpmVersion);
    expect(refusal?.message).toContain('squatter');
    expect(warnings).toEqual([]);
  });

  it('refuses production when the version is absent and npm cannot be reached for the package name', async () => {
    const notFound = JSON.stringify({ error: { code: 'E404' } });
    const networkError = JSON.stringify({ error: { code: 'ENOTFOUND' } });
    const shell = fakeShell({
      replies: {
        [`zapbip@${NPM_VERSION} maintainers --json`]: { exitCode: 1, stdout: notFound },
        'view zapbip maintainers --json': { exitCode: 1, stdout: networkError },
      },
    });
    const warnings: PreflightWarning[] = [];
    const refusal = await runWorkerPreflight(workerInput({ environment: DeployEnvironment.Production, shell, warnings }));
    expect(refusal?.step).toBe(PreflightStep.NpmVersion);
    expect(refusal?.message).toContain('could not reach npm');
    expect(warnings).toEqual([]);
  });

  it('refuses production when the only maintainer is not the owner npm user', async () => {
    const maintainers = JSON.stringify(['squatter <s@example.com>']);
    const shell = fakeShell({ replies: { 'maintainers --json': { exitCode: 0, stdout: maintainers } } });
    const warnings: PreflightWarning[] = [];
    const refusal = await runWorkerPreflight(workerInput({ environment: DeployEnvironment.Production, shell, warnings }));
    expect(refusal?.step).toBe(PreflightStep.NpmVersion);
    expect(refusal?.message).toContain('squatter');
    expect(warnings).toEqual([]);
  });

  it('refuses production when the owner npm user has a co-maintainer', async () => {
    const maintainers = JSON.stringify([`${NPM_PUBLISHER} <o@example.com>`, 'second-person <s@example.com>']);
    const shell = fakeShell({ replies: { 'maintainers --json': { exitCode: 0, stdout: maintainers } } });
    const refusal = await runWorkerPreflight(workerInput({ environment: DeployEnvironment.Production, shell }));
    expect(refusal?.step).toBe(PreflightStep.NpmVersion);
    expect(refusal?.message).toContain('second-person');
  });

  it('refuses production when the version was published by someone other than the owner npm user', async () => {
    const published = JSON.stringify('foreign-publisher <f@example.com>');
    const shell = fakeShell({ replies: { '_npmUser --json': { exitCode: 0, stdout: published } } });
    const refusal = await runWorkerPreflight(workerInput({ environment: DeployEnvironment.Production, shell }));
    expect(refusal?.step).toBe(PreflightStep.NpmVersion);
    expect(refusal?.message).toContain('foreign-publisher');
  });

  it('refuses production when the publisher answer is not readable', async () => {
    const shell = fakeShell({ replies: { '_npmUser --json': { exitCode: 0, stdout: 'not json' } } });
    const refusal = await runWorkerPreflight(workerInput({ environment: DeployEnvironment.Production, shell }));
    expect(refusal?.step).toBe(PreflightStep.NpmVersion);
    expect(refusal?.message).toContain('JSON');
  });

  it('accepts a single maintainer that npm prints as a string', async () => {
    const shell = fakeShell({
      replies: { 'maintainers --json': { exitCode: 0, stdout: JSON.stringify(`${NPM_PUBLISHER} <o@example.com>`) } },
    });
    expect(await runWorkerPreflight(workerInput({ environment: DeployEnvironment.Production, shell }))).toBeNull();
  });

  it('does not look at npm for a staging deploy', async () => {
    const shell = fakeShell({});
    await runWorkerPreflight(workerInput({ shell }));
    expect(shell.commands.some((command) => command.startsWith('npm'))).toBe(false);
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

  it('runs the scoped gate for production and staging, never the full one', async () => {
    const production = fakeShell({});
    await runWorkerPreflight(workerInput({ environment: DeployEnvironment.Production, shell: production }));
    expect(production.commands).toContain('pnpm verify');
    expect(production.commands).not.toContain('pnpm verify all');
    const staging = fakeShell({});
    await runWorkerPreflight(workerInput({ shell: staging }));
    expect(staging.commands).toContain('pnpm verify');
  });

  it('lets staging deploy while the company facts are unset', async () => {
    const company = { ...COMPLETE_COMPANY, cnpj: COMPANY_FACT_UNSET };
    expect(await runWorkerPreflight(workerInput({ company }))).toBeNull();
  });

  it('refuses when the gate fails, after every cheap step has passed', async () => {
    const shell = fakeShell({ replies: { 'pnpm verify': { exitCode: 1, stdout: '' } } });
    const refusal = await runWorkerPreflight(workerInput({ shell }));
    expect(refusal?.step).toBe(PreflightStep.Gate);
    expect(shell.commands.at(-1)).toBe('pnpm verify');
    expect(shell.commands.some((command) => command.includes('secret list'))).toBe(true);
    expect(shell.commands.some((command) => command.includes('migrations list'))).toBe(true);
  });

  it.each([
    [
      'a placeholder in the block',
      { block: blockOf({ environment: DeployEnvironment.Staging, databaseId: `${PLACEHOLDER_VALUE_PREFIX}ID` }) },
    ],
    ['a missing smoke input', { environmentVariables: { ...COMPLETE_VARIABLES, [SmokeInput.OwnerPhone]: undefined } }],
  ])('refuses %s before running the gate or any command', async (_name, overrides) => {
    const shell = fakeShell({});
    const refusal = await runWorkerPreflight(workerInput({ shell, ...overrides }));
    expect(refusal).not.toBeNull();
    expect(shell.commands).toEqual([]);
  });

  it('refuses a lowercase placeholder in the block', async () => {
    const block = blockOf({ environment: DeployEnvironment.Staging, databaseId: 'replace-with-staging-id' });
    const refusal = await runWorkerPreflight(workerInput({ block }));
    expect(refusal?.step).toBe(PreflightStep.Config);
    expect(refusal?.message).toContain('database_id');
  });

  it('refuses a lowercase placeholder smoke input', async () => {
    const environmentVariables = { ...COMPLETE_VARIABLES, [SmokeInput.ConnectionSecret]: 'replace-with-x' };
    const refusal = await runWorkerPreflight(workerInput({ environmentVariables }));
    expect(refusal?.step).toBe(PreflightStep.SmokeInputs);
  });

  it('warns and passes when META_APP_SECRET is not set, so the deploy is never blocked by it', async () => {
    const present = [...Object.values(WorkerSecret), WarnedWorkerSecret.ResendApiKey].map((name) => ({ name }));
    const shell = fakeShell({ replies: { 'secret list': { exitCode: 0, stdout: JSON.stringify(present) } } });
    const warnings: PreflightWarning[] = [];
    expect(await runWorkerPreflight(workerInput({ shell, warnings }))).toBeNull();
    expect(warnings).toEqual([
      {
        kind: PreflightWarningKind.MetaAppSecretMissing,
        message: 'META_APP_SECRET is not set; the webhook refuses every delivery until you run wrangler secret put META_APP_SECRET',
      },
    ]);
  });

  it('warns and passes when RESEND_API_KEY is not set, so production deploys before the key exists', async () => {
    const present = [...Object.values(WorkerSecret), WarnedWorkerSecret.MetaAppSecret].map((name) => ({ name }));
    const shell = fakeShell({ replies: { 'secret list': { exitCode: 0, stdout: JSON.stringify(present) } } });
    const warnings: PreflightWarning[] = [];
    expect(await runWorkerPreflight(workerInput({ shell, warnings }))).toBeNull();
    expect(warnings).toEqual([
      {
        kind: PreflightWarningKind.ResendApiKeyMissing,
        message: 'RESEND_API_KEY is not set; no welcome or digest email is sent until you run wrangler secret put RESEND_API_KEY',
      },
    ]);
  });

  it('does not warn when META_APP_SECRET is set', async () => {
    const warnings: PreflightWarning[] = [];
    expect(await runWorkerPreflight(workerInput({ warnings }))).toBeNull();
    expect(warnings).toEqual([]);
  });

  it('refuses a secret list that is not JSON, clearly', async () => {
    const shell = fakeShell({ replies: { 'secret list': { exitCode: 0, stdout: 'not json' } } });
    const refusal = await runWorkerPreflight(workerInput({ shell }));
    expect(refusal?.step).toBe(PreflightStep.Secrets);
    expect(refusal?.message).toContain('JSON');
  });

  it('refuses production maintainers that are not JSON, clearly', async () => {
    const shell = fakeShell({ replies: { 'maintainers --json': { exitCode: 0, stdout: 'not json' } } });
    const refusal = await runWorkerPreflight(workerInput({ environment: DeployEnvironment.Production, shell }));
    expect(refusal?.step).toBe(PreflightStep.NpmVersion);
    expect(refusal?.message).toContain('JSON');
  });

  it('refuses production with a clear message when git fetch fails', async () => {
    const shell = fakeShell({ replies: { 'git fetch origin main': { exitCode: 128, stdout: '' } } });
    const refusal = await runWorkerPreflight(workerInput({ environment: DeployEnvironment.Production, shell }));
    expect(refusal?.step).toBe(PreflightStep.Git);
    expect(refusal?.message).toContain('fetch');
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

  it('refuses production when PUBLIC_ORIGIN is not the production origin, before asking DNS', async () => {
    const nameserverResolver = fakeNameserverResolver({});
    const block = { ...blockOf({ environment: DeployEnvironment.Production }), vars: { PUBLIC_ORIGIN: 'https://mcp-staging.zapbip.com' } };
    const refusal = await runWorkerPreflight(workerInput({ environment: DeployEnvironment.Production, block, nameserverResolver }));
    expect(refusal?.step).toBe(PreflightStep.Domain);
    expect(refusal?.message).toContain('PUBLIC_ORIGIN');
    expect(refusal?.message).toContain('https://mcp.zapbip.com');
    expect(nameserverResolver.zones).toEqual([]);
  });

  it('refuses production when the zone nameservers are not Cloudflare', async () => {
    const nameserverResolver = fakeNameserverResolver({ answer: ['ns1.registrar.example'] });
    const refusal = await runWorkerPreflight(workerInput({ environment: DeployEnvironment.Production, nameserverResolver }));
    expect(refusal?.step).toBe(PreflightStep.Domain);
    expect(refusal?.message).toContain('zapbip.com');
    expect(refusal?.message).toContain('Cloudflare nameservers');
    expect(nameserverResolver.zones).toEqual(['zapbip.com']);
  });

  it('refuses production when one of the nameservers is not Cloudflare', async () => {
    const nameserverResolver = fakeNameserverResolver({ answer: ['elisabeth.ns.cloudflare.com', 'ns1.registrar.example'] });
    const refusal = await runWorkerPreflight(workerInput({ environment: DeployEnvironment.Production, nameserverResolver }));
    expect(refusal?.step).toBe(PreflightStep.Domain);
  });

  it('refuses production when the zone has no nameservers', async () => {
    const nameserverResolver = fakeNameserverResolver({ answer: [] });
    const refusal = await runWorkerPreflight(workerInput({ environment: DeployEnvironment.Production, nameserverResolver }));
    expect(refusal?.step).toBe(PreflightStep.Domain);
  });

  it('refuses production when the nameserver lookup fails, naming the reason', async () => {
    const nameserverResolver = fakeNameserverResolver({ failure: new Error('queryNs ENOTFOUND') });
    const refusal = await runWorkerPreflight(workerInput({ environment: DeployEnvironment.Production, nameserverResolver }));
    expect(refusal?.step).toBe(PreflightStep.Domain);
    expect(refusal?.message).toContain('queryNs ENOTFOUND');
  });

  it('does not look up DNS for staging', async () => {
    const nameserverResolver = fakeNameserverResolver({ answer: ['ns1.registrar.example'] });
    expect(await runWorkerPreflight(workerInput({ nameserverResolver }))).toBeNull();
    expect(nameserverResolver.zones).toEqual([]);
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
    expect(refusal?.message).not.toContain(WorkerSecret.WhatsAppVerifyToken);
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

function docsInput(input: { packageFetcher?: FakePackageFetcher }) {
  const { packageFetcher = fakePackageFetcher({}) } = input;
  return {
    shell: fakeShell({}),
    company: COMPLETE_COMPANY,
    npmVersion: NPM_VERSION,
    plugins: HOSTED_PLUGINS,
    packageFetcher,
    environmentVariables: COMPLETE_VARIABLES,
  };
}

describe('docs preflight', () => {
  it('refuses the docs deploy while a company fact is unset, before any command', async () => {
    const shell = fakeShell({});
    const company = { ...COMPLETE_COMPANY, cnpj: COMPANY_FACT_UNSET };
    const refusal = await runDocsPreflight({
      shell,
      company,
      npmVersion: NPM_VERSION,
      plugins: HOSTED_PLUGINS,
      packageFetcher: fakePackageFetcher({}),
      environmentVariables: COMPLETE_VARIABLES,
    });
    expect(refusal?.step).toBe(PreflightStep.CompanyFacts);
    expect(refusal?.message).toContain('cnpj');
    expect(shell.commands).toEqual([]);
  });

  it('refuses until npm view resolves the pinned version, naming it', async () => {
    const shell = fakeShell({ replies: { 'maintainers --json': { exitCode: 1, stdout: '' } } });
    const refusal = await runDocsPreflight({
      shell,
      company: COMPLETE_COMPANY,
      npmVersion: NPM_VERSION,
      plugins: HOSTED_PLUGINS,
      packageFetcher: fakePackageFetcher({}),
      environmentVariables: COMPLETE_VARIABLES,
    });
    expect(refusal?.step).toBe(PreflightStep.NpmVersion);
    expect(refusal?.message).toContain(`zapbip@${NPM_VERSION}`);
    expect(shell.commands).toEqual([
      `npm view zapbip@${NPM_VERSION} maintainers --json --registry=${NPM_REGISTRY_URL} --@zapbip:registry=${NPM_REGISTRY_URL}`,
    ]);
  });

  it('refuses until the npm plugin version resolves on npm, naming it', async () => {
    const shell = fakeShell({ replies: { [`${SAMPLE_NPM_PACKAGE_NAME}`]: { exitCode: 1, stdout: '' } } });
    const refusal = await runDocsPreflight({
      shell,
      company: COMPLETE_COMPANY,
      npmVersion: NPM_VERSION,
      plugins: HOSTED_PLUGINS,
      packageFetcher: fakePackageFetcher({}),
      environmentVariables: COMPLETE_VARIABLES,
    });
    expect(refusal?.step).toBe(PreflightStep.NpmVersion);
    expect(refusal?.message).toContain(`${SAMPLE_NPM_PACKAGE_NAME}@${NPM_VERSION}`);
    expect(shell.commands).toEqual([
      `npm view zapbip@${NPM_VERSION} maintainers --json --registry=${NPM_REGISTRY_URL} --@zapbip:registry=${NPM_REGISTRY_URL}`,
      `npm view zapbip@${NPM_VERSION} _npmUser --json --registry=${NPM_REGISTRY_URL} --@zapbip:registry=${NPM_REGISTRY_URL}`,
      `npm view ${SAMPLE_NPM_PACKAGE_NAME}@${NPM_VERSION} maintainers --json --registry=${NPM_REGISTRY_URL} --@zapbip:registry=${NPM_REGISTRY_URL}`,
    ]);
  });

  it('refuses the docs deploy when the npm plugin is not maintained by the owner npm user', async () => {
    const shell = fakeShell({
      replies: { [`${SAMPLE_NPM_PACKAGE_NAME}`]: { exitCode: 0, stdout: JSON.stringify(['someone-else <x@example.com>']) } },
    });
    const refusal = await runDocsPreflight({
      shell,
      company: COMPLETE_COMPANY,
      npmVersion: NPM_VERSION,
      plugins: HOSTED_PLUGINS,
      packageFetcher: fakePackageFetcher({}),
      environmentVariables: COMPLETE_VARIABLES,
    });
    expect(refusal?.step).toBe(PreflightStep.NpmVersion);
    expect(refusal?.message).toContain(`${SAMPLE_NPM_PACKAGE_NAME}@${NPM_VERSION}`);
    expect(refusal?.message).toContain(NPM_PUBLISHER);
  });

  it('refuses the docs deploy when the npm plugin was published by someone else', async () => {
    const shell = fakeShell({
      replies: {
        [`${SAMPLE_NPM_PACKAGE_NAME}@0.1.0 _npmUser --json`]: { exitCode: 0, stdout: JSON.stringify('foreign-publisher <f@example.com>') },
      },
    });
    const refusal = await runDocsPreflight({
      shell,
      company: COMPLETE_COMPANY,
      npmVersion: NPM_VERSION,
      plugins: HOSTED_PLUGINS,
      packageFetcher: fakePackageFetcher({}),
      environmentVariables: COMPLETE_VARIABLES,
    });
    expect(refusal?.step).toBe(PreflightStep.NpmVersion);
    expect(refusal?.message).toContain(`${SAMPLE_NPM_PACKAGE_NAME}@0.1.0`);
    expect(refusal?.message).toContain('foreign-publisher');
  });

  it.each([
    ['404', { status: 404, sha256: OTHER_WHEEL_SHA256, location: null }, HOSTED_WHEEL_URL],
    ['a wrong hash', { status: 200, sha256: OTHER_WHEEL_SHA256, location: null }, OTHER_WHEEL_SHA256],
  ])('refuses the docs deploy when the hosted wheel answers %s, after npm resolves both packages', async (_name, answer, expectedText) => {
    const shell = fakeShell({});
    const packageFetcher = fakePackageFetcher({ answer });
    const refusal = await runDocsPreflight({ ...docsInput({}), shell, packageFetcher });
    expect(refusal?.step).toBe(PreflightStep.PluginWheel);
    expect(refusal?.message).toContain(expectedText);
    expect(shell.commands).toHaveLength(4);
    expect(packageFetcher.urls).toEqual([HOSTED_WHEEL_URL]);
  });

  it.each([
    ['404', { status: 404, sha256: OTHER_WHEEL_SHA256, location: null }, HOSTED_REQUIREMENTS_URL],
    ['a wrong hash', { status: 200, sha256: OTHER_WHEEL_SHA256, location: null }, OTHER_WHEEL_SHA256],
  ])('refuses the docs deploy when the hosted requirements file answers %s', async (_name, answer, expectedText) => {
    const packageFetcher = fakePackageFetcher({ answers: { [HOSTED_REQUIREMENTS_URL]: answer } });
    const refusal = await runDocsPreflight({ ...docsInput({}), packageFetcher });
    expect(refusal?.step).toBe(PreflightStep.PluginWheel);
    expect(refusal?.message).toContain(expectedText);
    expect(packageFetcher.urls).toEqual([HOSTED_WHEEL_URL, HOSTED_REQUIREMENTS_URL]);
  });

  it('says the wheel could not be reached, not that it is missing, when the fetch fails', async () => {
    const packageFetcher = fakePackageFetcher({ failure: new Error('getaddrinfo ENOTFOUND mcp.zapbip.com') });
    const refusal = await runDocsPreflight({ ...docsInput({}), packageFetcher });
    expect(refusal?.step).toBe(PreflightStep.PluginWheel);
    expect(refusal?.message).toContain('could not reach');
  });

  it('passes the docs deploy when the hosted wheel hashes to the constant', async () => {
    expect(await runDocsPreflight(docsInput({}))).toBeNull();
  });

  it('passes when the number is set and the version resolves', async () => {
    const shell = fakeShell({});
    expect(
      await runDocsPreflight({
        shell,
        company: COMPLETE_COMPANY,
        npmVersion: NPM_VERSION,
        plugins: HOSTED_PLUGINS,
        packageFetcher: fakePackageFetcher({}),
        environmentVariables: COMPLETE_VARIABLES,
      }),
    ).toBeNull();
  });
});

describe('the hosted artifacts the docs preflight checks', () => {
  it('are the artifacts of every registered plugin, in registry order', async () => {
    const packageFetcher = fakePackageFetcher({});
    await runDocsPreflight({ ...docsInput({}), packageFetcher });
    const expectedUrls = HOSTED_PLUGINS.flatMap((plugin) =>
      plugin.hostedArtifacts.map((artifact) => `${PRODUCTION_PUBLIC_ORIGIN}${artifact.path}`),
    );
    expect(packageFetcher.urls).toEqual([...expectedUrls, START_LINK]);
  });
});

describe('the start link the docs preflight checks', () => {
  const OLD_WORKER = { status: 404, sha256: OTHER_WHEEL_SHA256, location: null };
  const NO_NUMBER = { status: 503, sha256: OTHER_WHEEL_SHA256, location: null };
  const FOREIGN_TARGET = { status: 302, sha256: OTHER_WHEEL_SHA256, location: 'https://evil.example/5511999990001' };
  const MISSING_TARGET = { status: 302, sha256: OTHER_WHEEL_SHA256, location: null };

  it.each([
    ['a 404 from the old Worker', OLD_WORKER],
    ['a 503 with no active number', NO_NUMBER],
    ['a 302 to a foreign target', FOREIGN_TARGET],
    ['a 302 without a Location', MISSING_TARGET],
  ])('refuses %s, telling the operator to deploy the Worker and activate a number', async (_name, answer) => {
    const packageFetcher = fakePackageFetcher({ answers: { [START_LINK]: answer } });
    const refusal = await runDocsPreflight({ ...docsInput({}), packageFetcher });
    expect(refusal?.step).toBe(PreflightStep.StartLink);
    expect(refusal?.message).toContain(START_LINK);
    expect(refusal?.message).toContain('deploy the Worker and activate a number');
  });

  it('passes on a 302 to wa.me', async () => {
    expect(START_LINK_FOUND.location?.startsWith(`${WHATSAPP_LINK_ORIGIN}/`)).toBe(true);
    expect(await runDocsPreflight(docsInput({}))).toBeNull();
  });

  it('says the start link could not be reached when the fetch fails for it alone', async () => {
    const packageFetcher = fakePackageFetcher({ failures: { [START_LINK]: new Error('getaddrinfo ENOTFOUND mcp.zapbip.com') } });
    const refusal = await runDocsPreflight({ ...docsInput({}), packageFetcher });
    expect(refusal?.step).toBe(PreflightStep.StartLink);
    expect(refusal?.message).toContain('could not reach');
  });
});
