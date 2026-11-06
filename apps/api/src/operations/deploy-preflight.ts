import { COMPANY_FACT_UNSET, type CompanyFacts, OFFICIAL_NUMBER_UNSET } from '@zapbip/types';
import { z } from 'zod';
import { PLACEHOLDER_VALUE_PREFIX } from './constants';
import { DeployEnvironment } from './deploy-environment';
import { missingSmokeInputs } from './smoke-inputs';
import { WorkerSecret } from './worker-secret';
import { INSTALL_ROUTE_PATH } from './worker-facts';

const PNPM = 'pnpm';
const GIT = 'git';
const NPM = 'npm';
const WRANGLER_PREFIX = ['--filter', '@zapbip/api', 'exec', 'wrangler'];
const MAIN_BRANCH = 'main';
const ORIGIN_REMOTE = 'origin';
const ORIGIN_MAIN = `${ORIGIN_REMOTE}/${MAIN_BRANCH}`;
const NO_PENDING_MIGRATIONS = 'No migrations to apply';
const NPM_PACKAGE_NAME = 'zapbip';
const DEPLOYABLE_ENVIRONMENTS = [DeployEnvironment.Staging, DeployEnvironment.Production];

export type ShellCommand = { file: string; args: string[]; stdin?: string };
export type ShellResult = { exitCode: number; stdout: string };
export type DeployShell = { run(input: ShellCommand): Promise<ShellResult> };
export type DeployBlock = Record<string, unknown>;
export type EnvironmentVariables = Record<string, string | undefined>;

export enum PreflightStep {
  Environment = 'environment',
  OfficialNumber = 'official number',
  CompanyFacts = 'company facts',
  NpmVersion = 'npm version',
  Git = 'git',
  Gate = 'gate',
  Config = 'config',
  Readiness = 'readiness',
  Secrets = 'secrets',
  Migrations = 'migrations',
  SmokeInputs = 'smoke inputs',
}

export type WorkerFacts = { exportsScheduled: boolean; mountsInstallRoute: boolean };

export type PreflightRefusal = { step: PreflightStep; message: string };

export type WorkerPreflightInput = {
  environment: DeployEnvironment;
  firstDeploy: boolean;
  block: DeployBlock;
  workerFacts: WorkerFacts;
  shell: DeployShell;
  isInteractive: boolean;
  environmentVariables: EnvironmentVariables;
  officialWhatsAppNumber: string;
  company: CompanyFacts;
};

export type DocsPreflightInput = { shell: DeployShell; officialWhatsAppNumber: string; company: CompanyFacts; npmVersion: string };

type PreflightCheck<Input> = { step: PreflightStep; refusalOf: (input: Input) => Promise<string | null> };

const databaseBlockSchema = z.object({ d1_databases: z.tuple([z.object({ database_name: z.string() })], z.unknown()) });
const secretListSchema = z.array(z.object({ name: z.string() }));
const cronBlockSchema = z.object({ triggers: z.object({ crons: z.array(z.string()) }) });

function environmentFlag(input: { environment: DeployEnvironment }): string[] {
  if (input.environment === DeployEnvironment.Production) return [];
  return ['--env', input.environment];
}

export function wranglerCommand(input: { environment: DeployEnvironment; args: string[]; flags?: string[] }): ShellCommand {
  const { environment, args, flags = [] } = input;
  return { file: PNPM, args: [...WRANGLER_PREFIX, ...args, ...environmentFlag({ environment }), ...flags] };
}

export function databaseNameOf(input: { block: DeployBlock }): string {
  return databaseBlockSchema.parse(input.block).d1_databases[0].database_name;
}

async function gitOutput(input: { shell: DeployShell; args: string[] }): Promise<string> {
  const result = await input.shell.run({ file: GIT, args: input.args });
  if (result.exitCode !== 0) throw new Error(`${GIT} ${input.args.join(' ')} failed`);
  return result.stdout.trim();
}

function placeholderPathsOf(input: { value: unknown; path: string }): string[] {
  const { value, path } = input;
  if (typeof value === 'string') return value.startsWith(PLACEHOLDER_VALUE_PREFIX) ? [path] : [];
  if (Array.isArray(value)) return value.flatMap((item, index) => placeholderPathsOf({ value: item, path: `${path}.${index}` }));
  if (typeof value !== 'object' || value === null) return [];
  return Object.entries(value).flatMap(([key, item]) => placeholderPathsOf({ value: item, path: path === '' ? key : `${path}.${key}` }));
}

async function refuseUnlessDeployable(input: WorkerPreflightInput): Promise<string | null> {
  if (!DEPLOYABLE_ENVIRONMENTS.includes(input.environment))
    return `deploy supports ${DEPLOYABLE_ENVIRONMENTS.join(' or ')}, not ${input.environment}`;
  if (!input.isInteractive) return 'deploy needs an interactive terminal';
  return null;
}

async function refuseUnsetOfficialNumber(input: { officialWhatsAppNumber: string }): Promise<string | null> {
  if (input.officialWhatsAppNumber !== OFFICIAL_NUMBER_UNSET) return null;
  return `OFFICIAL_WHATSAPP_NUMBER is still ${OFFICIAL_NUMBER_UNSET}; set the official number in libs/types before deploying`;
}

async function refuseUnpublishedPackage(input: DocsPreflightInput): Promise<string | null> {
  const packageVersion = `${NPM_PACKAGE_NAME}@${input.npmVersion}`;
  const result = await input.shell.run({ file: NPM, args: ['view', packageVersion, 'version'] });
  if (result.exitCode === 0) return null;
  return `${packageVersion} does not resolve on npm; publish it before deploying the docs`;
}

async function refuseUncleanGit(input: WorkerPreflightInput): Promise<string | null> {
  const { shell, environment } = input;
  const changes = await gitOutput({ shell, args: ['status', '--porcelain'] });
  if (changes !== '') return 'the working tree has uncommitted changes; commit or stash them';
  if (environment !== DeployEnvironment.Production) return null;
  const branch = await gitOutput({ shell, args: ['rev-parse', '--abbrev-ref', 'HEAD'] });
  if (branch !== MAIN_BRANCH) return `production deploys from ${MAIN_BRANCH}, not ${branch}`;
  await gitOutput({ shell, args: ['fetch', ORIGIN_REMOTE, MAIN_BRANCH] });
  const head = await gitOutput({ shell, args: ['rev-parse', 'HEAD'] });
  const originHead = await gitOutput({ shell, args: ['rev-parse', ORIGIN_MAIN] });
  if (head !== originHead) return `HEAD is not ${ORIGIN_MAIN}; pull or push so they match`;
  return null;
}

async function refuseFailedGate(input: WorkerPreflightInput): Promise<string | null> {
  const isProduction = input.environment === DeployEnvironment.Production;
  const args = isProduction ? ['verify', 'all'] : ['verify'];
  const result = await input.shell.run({ file: PNPM, args });
  if (result.exitCode === 0) return null;
  return `the gate failed: ${PNPM} ${args.join(' ')}`;
}

async function refuseLeftoverPlaceholder(input: WorkerPreflightInput): Promise<string | null> {
  const paths = placeholderPathsOf({ value: input.block, path: '' });
  if (paths.length === 0) return null;
  return `the ${input.environment} block still holds placeholders: ${paths.join(', ')}`;
}

async function refuseUnreadyProduction(input: WorkerPreflightInput): Promise<string | null> {
  if (input.environment !== DeployEnvironment.Production) return null;
  const parsed = cronBlockSchema.safeParse(input.block);
  const hasCronTrigger = parsed.success && parsed.data.triggers.crons.length > 0;
  const missing = [
    input.workerFacts.exportsScheduled ? null : 'the Worker does not export scheduled',
    hasCronTrigger ? null : 'wrangler has no cron trigger',
    input.workerFacts.mountsInstallRoute ? null : `the ${INSTALL_ROUTE_PATH} route is not mounted`,
  ].filter((reason) => reason !== null);
  if (missing.length === 0) return null;
  return `production is not ready: ${missing.join('; ')}; merge the missing slices into main first`;
}

async function refuseMissingSecrets(input: WorkerPreflightInput): Promise<string | null> {
  const command = wranglerCommand({ environment: input.environment, args: ['secret', 'list'], flags: ['--format', 'json'] });
  const result = await input.shell.run(command);
  if (result.exitCode !== 0) return 'could not list the Worker secrets';
  const present = secretListSchema.parse(JSON.parse(result.stdout)).map((secret) => secret.name);
  const missing = Object.values(WorkerSecret).filter((name) => !present.includes(name));
  if (missing.length === 0) return null;
  return `missing Worker secrets: ${missing.join(', ')}`;
}

async function refusePendingMigrations(input: WorkerPreflightInput): Promise<string | null> {
  const { environment, shell, block } = input;
  const command = wranglerCommand({ environment, args: ['d1', 'migrations', 'list', databaseNameOf({ block })], flags: ['--remote'] });
  const result = await shell.run(command);
  if (result.exitCode !== 0) return 'could not list the pending migrations';
  if (result.stdout.includes(NO_PENDING_MIGRATIONS)) return null;
  return `migrations are pending; run ${PNPM} migrate:${environment} first`;
}

async function refuseMissingSmokeInputs(input: WorkerPreflightInput): Promise<string | null> {
  const missing = missingSmokeInputs(input);
  if (missing.length === 0) return null;
  return `set these in .env before deploying: ${missing.join(', ')}`;
}

const WORKER_CHECKS: PreflightCheck<WorkerPreflightInput>[] = [
  { step: PreflightStep.Environment, refusalOf: refuseUnlessDeployable },
  { step: PreflightStep.OfficialNumber, refusalOf: refuseUnsetOfficialNumber },
  { step: PreflightStep.Git, refusalOf: refuseUncleanGit },
  { step: PreflightStep.Gate, refusalOf: refuseFailedGate },
  { step: PreflightStep.Config, refusalOf: refuseLeftoverPlaceholder },
  { step: PreflightStep.Readiness, refusalOf: refuseUnreadyProduction },
  { step: PreflightStep.Secrets, refusalOf: refuseMissingSecrets },
  { step: PreflightStep.Migrations, refusalOf: refusePendingMigrations },
  { step: PreflightStep.SmokeInputs, refusalOf: refuseMissingSmokeInputs },
];

const DOCS_CHECKS: PreflightCheck<DocsPreflightInput>[] = [
  { step: PreflightStep.OfficialNumber, refusalOf: refuseUnsetOfficialNumber },
  { step: PreflightStep.NpmVersion, refusalOf: refuseUnpublishedPackage },
];

async function firstRefusal<Input>(input: { checks: PreflightCheck<Input>[]; subject: Input }): Promise<PreflightRefusal | null> {
  const [current, ...remaining] = input.checks;
  if (!current) return null;
  const message = await current.refusalOf(input.subject);
  if (message !== null) return { step: current.step, message };
  return firstRefusal({ checks: remaining, subject: input.subject });
}

export function runWorkerPreflight(input: WorkerPreflightInput): Promise<PreflightRefusal | null> {
  return firstRefusal({ checks: WORKER_CHECKS, subject: input });
}

export function runDocsPreflight(input: DocsPreflightInput): Promise<PreflightRefusal | null> {
  return firstRefusal({ checks: DOCS_CHECKS, subject: input });
}
