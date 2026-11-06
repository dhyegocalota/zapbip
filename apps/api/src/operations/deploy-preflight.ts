import { COMPANY_FACT_UNSET, type CompanyFacts, OFFICIAL_NUMBER_UNSET } from '@zapbip/types';
import { z } from 'zod';
import { DeployEnvironment } from './deploy-environment';
import { parseJsonOrNull } from './json-text';
import { isPlaceholderValue } from './placeholder';
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
const NPM_NOT_FOUND_CODE = 'E404';
const NO_NPM_ANSWER = 'no answer';
const NO_PENDING_MIGRATIONS = 'No migrations to apply';
const NPM_PACKAGE_NAME = 'zapbip';
export const NPM_PUBLISHER_VARIABLE = 'ZAPBIP_NPM_PUBLISHER';
const OPENCLAW_PLUGIN_PACKAGE = '@zapbip/openclaw-plugin';
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
  npmVersion: string;
  openclawPluginVersion: string;
};

export type DocsPreflightInput = {
  shell: DeployShell;
  officialWhatsAppNumber: string;
  company: CompanyFacts;
  npmVersion: string;
  openclawPluginVersion: string;
  environmentVariables: EnvironmentVariables;
};

type PreflightCheck<Input> = { step: PreflightStep; refusalOf: (input: Input) => Promise<string | null> };

const databaseBlockSchema = z.object({ d1_databases: z.tuple([z.object({ database_name: z.string() })], z.unknown()) });
const npmPersonSchema = z.union([z.string(), z.object({ name: z.string() })]);
const npmPeopleSchema = z.union([npmPersonSchema, z.array(npmPersonSchema)]);

function npmNamesOf(input: { people: z.infer<typeof npmPeopleSchema> }): string[] {
  const people = Array.isArray(input.people) ? input.people : [input.people];
  return people.map((person) => (typeof person === 'string' ? (person.split(' <')[0] as string) : person.name));
}
const npmFailureSchema = z.object({ error: z.object({ code: z.string() }) });
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
  if (typeof value === 'string') return isPlaceholderValue({ value }) ? [path] : [];
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

async function refuseUnsetCompanyFacts(input: { company: CompanyFacts }): Promise<string | null> {
  const unset = Object.entries(input.company)
    .filter(([, value]) => value === COMPANY_FACT_UNSET)
    .map(([field]) => field);
  if (unset.length === 0) return null;
  return `COMPANY facts are still ${COMPANY_FACT_UNSET}: ${unset.join(', ')}; fill the Logic Bit company facts in libs/types before deploying`;
}

function npmFailureReason(input: { packageSpec: string; stdout: string }): string {
  const failure = npmFailureSchema.safeParse(parseJsonOrNull({ text: input.stdout }));
  const code = failure.success ? failure.data.error.code : NO_NPM_ANSWER;
  if (code === NPM_NOT_FOUND_CODE) return `${input.packageSpec} does not resolve on npm; publish it first`;
  return `could not reach npm to read ${input.packageSpec} (${code}); check your network and run it again`;
}

async function untrustedReasonOf(input: { shell: DeployShell; packageSpec: string; publisher: string }): Promise<string | null> {
  const { shell, packageSpec, publisher } = input;
  const maintainerAnswer = await shell.run({ file: NPM, args: ['view', packageSpec, 'maintainers', '--json'] });
  if (maintainerAnswer.exitCode !== 0) return npmFailureReason({ packageSpec, stdout: maintainerAnswer.stdout });
  const maintainers = npmPeopleSchema.safeParse(parseJsonOrNull({ text: maintainerAnswer.stdout }));
  if (!maintainers.success) return `could not read the maintainers of ${packageSpec} as JSON`;
  const names = npmNamesOf({ people: maintainers.data });
  const hasOnlyPublisher = names.length > 0 && names.every((name) => name === publisher);
  if (!hasOnlyPublisher)
    return `${packageSpec} must be maintained only by the npm user ${publisher}; its maintainers are ${names.join(', ')}`;
  const publisherAnswer = await shell.run({ file: NPM, args: ['view', packageSpec, '_npmUser', '--json'] });
  if (publisherAnswer.exitCode !== 0) return `could not read who published ${packageSpec}`;
  const publishedBy = npmPeopleSchema.safeParse(parseJsonOrNull({ text: publisherAnswer.stdout }));
  if (!publishedBy.success) return `could not read who published ${packageSpec} as JSON`;
  const publishers = npmNamesOf({ people: publishedBy.data });
  if (publishers.length === 1 && publishers[0] === publisher) return null;
  return `${packageSpec} was published by ${publishers.join(', ')}, not by the npm user ${publisher}`;
}

async function firstUntrusted(input: { shell: DeployShell; packageSpecs: string[]; publisher: string }): Promise<string | null> {
  const [current, ...remaining] = input.packageSpecs;
  if (!current) return null;
  const reason = await untrustedReasonOf({ shell: input.shell, packageSpec: current, publisher: input.publisher });
  if (reason !== null) return reason;
  return firstUntrusted({ ...input, packageSpecs: remaining });
}

async function refuseUntrustedPackages(input: {
  shell: DeployShell;
  environmentVariables: EnvironmentVariables;
  packageSpecs: string[];
}): Promise<string | null> {
  const publisher = input.environmentVariables[NPM_PUBLISHER_VARIABLE];
  if (publisher === undefined || publisher === '' || isPlaceholderValue({ value: publisher })) {
    return `${NPM_PUBLISHER_VARIABLE} is not set; set it to the npm user that publishes the packages`;
  }
  return firstUntrusted({ shell: input.shell, packageSpecs: input.packageSpecs, publisher });
}

function publishedPackageSpecsOf(input: { npmVersion: string; openclawPluginVersion: string }): string[] {
  return [`${NPM_PACKAGE_NAME}@${input.npmVersion}`, `${OPENCLAW_PLUGIN_PACKAGE}@${input.openclawPluginVersion}`];
}

async function refuseUntrustedWorkerPackage(input: WorkerPreflightInput): Promise<string | null> {
  return refuseUntrustedPackages({ ...input, packageSpecs: publishedPackageSpecsOf(input) });
}

async function refuseUntrustedDocsPackages(input: DocsPreflightInput): Promise<string | null> {
  return refuseUntrustedPackages({ ...input, packageSpecs: publishedPackageSpecsOf(input) });
}

async function refuseUncleanGit(input: WorkerPreflightInput): Promise<string | null> {
  const { shell, environment } = input;
  const changes = await gitOutput({ shell, args: ['status', '--porcelain'] });
  if (changes !== '') return 'the working tree has uncommitted changes; commit or stash them';
  if (environment !== DeployEnvironment.Production) return null;
  const branch = await gitOutput({ shell, args: ['rev-parse', '--abbrev-ref', 'HEAD'] });
  if (branch !== MAIN_BRANCH) return `production deploys from ${MAIN_BRANCH}, not ${branch}`;
  const fetched = await shell.run({ file: GIT, args: ['fetch', ORIGIN_REMOTE, MAIN_BRANCH] });
  if (fetched.exitCode !== 0) return `could not fetch ${ORIGIN_REMOTE} ${MAIN_BRANCH}; check your network and the remote`;
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
  const secrets = secretListSchema.safeParse(parseJsonOrNull({ text: result.stdout }));
  if (!secrets.success) return 'the Worker secret list is not JSON; update wrangler or check your login';
  const present = secrets.data.map((secret) => secret.name);
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

function productionOnly(input: { refusalOf: (subject: WorkerPreflightInput) => Promise<string | null> }) {
  return async (subject: WorkerPreflightInput): Promise<string | null> => {
    if (subject.environment !== DeployEnvironment.Production) return null;
    return input.refusalOf(subject);
  };
}

const WORKER_CHECKS: PreflightCheck<WorkerPreflightInput>[] = [
  { step: PreflightStep.Environment, refusalOf: refuseUnlessDeployable },
  { step: PreflightStep.OfficialNumber, refusalOf: productionOnly({ refusalOf: refuseUnsetOfficialNumber }) },
  { step: PreflightStep.CompanyFacts, refusalOf: productionOnly({ refusalOf: refuseUnsetCompanyFacts }) },
  { step: PreflightStep.NpmVersion, refusalOf: productionOnly({ refusalOf: refuseUntrustedWorkerPackage }) },
  { step: PreflightStep.Config, refusalOf: refuseLeftoverPlaceholder },
  { step: PreflightStep.Readiness, refusalOf: refuseUnreadyProduction },
  { step: PreflightStep.SmokeInputs, refusalOf: refuseMissingSmokeInputs },
  { step: PreflightStep.Git, refusalOf: refuseUncleanGit },
  { step: PreflightStep.Secrets, refusalOf: refuseMissingSecrets },
  { step: PreflightStep.Migrations, refusalOf: refusePendingMigrations },
  { step: PreflightStep.Gate, refusalOf: refuseFailedGate },
];

const DOCS_CHECKS: PreflightCheck<DocsPreflightInput>[] = [
  { step: PreflightStep.OfficialNumber, refusalOf: refuseUnsetOfficialNumber },
  { step: PreflightStep.CompanyFacts, refusalOf: refuseUnsetCompanyFacts },
  { step: PreflightStep.NpmVersion, refusalOf: refuseUntrustedDocsPackages },
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
