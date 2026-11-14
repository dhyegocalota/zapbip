import { type AgentPlugin, type HostedArtifact, PluginRegistry } from '@zapbip/agents/plugins';
import {
  CLOUDFLARE_NAMESERVER_SUFFIX,
  COMPANY_FACT_UNSET,
  type CompanyFacts,
  HttpStatus,
  NPM_REGISTRY_URL,
  PRODUCTION_PACKAGES_BUCKET,
  PRODUCTION_PUBLIC_ORIGIN,
  PRODUCTION_ZONE,
  START_LINK,
  WHATSAPP_LINK_ORIGIN,
} from '@zapbip/types';
import { randomUUID } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { z } from 'zod';
import { DeployEnvironment } from './deploy-environment';
import { parseJsonOrNull } from './json-text';
import type { NameserverResolver } from './nameserver-resolver';
import type { PackageFetcher } from './package-fetcher';
import { isPlaceholderValue } from './placeholder';
import { missingSmokeInputs } from './smoke-inputs';
import { WarnedWorkerSecret, WorkerSecret } from './worker-secret';
import { INSTALL_ROUTE_PATH } from './worker-facts';

const PNPM = 'pnpm';
const GIT = 'git';
const NPM = 'npm';
const SHASUM = 'shasum';
const REMOVE = 'rm';
const WHITESPACE = /\s+/;
const WHEEL_DOWNLOAD_PREFIX = 'zapbip-wheel-';
const WRANGLER_PREFIX = ['--filter', '@zapbip/api', 'exec', 'wrangler'];
const MAIN_BRANCH = 'main';
const ORIGIN_REMOTE = 'origin';
const ORIGIN_MAIN = `${ORIGIN_REMOTE}/${MAIN_BRANCH}`;
const NPM_NOT_FOUND_CODE = 'E404';
const NO_NPM_ANSWER = 'no answer';
const NO_PENDING_MIGRATIONS = 'No migrations to apply';
const NPM_PACKAGE_NAME = 'zapbip';
export const NPM_PUBLISHER_VARIABLE = 'ZAPBIP_NPM_PUBLISHER';
const NPM_REGISTRY_FLAGS = [`--registry=${NPM_REGISTRY_URL}`, `--@zapbip:registry=${NPM_REGISTRY_URL}`];
const DEPLOYABLE_ENVIRONMENTS = [DeployEnvironment.Staging, DeployEnvironment.Production];

export type ShellCommand = { file: string; args: string[]; stdin?: string };
export type ShellResult = { exitCode: number; stdout: string };
export type DeployShell = { run(input: ShellCommand): Promise<ShellResult> };
export type DeployBlock = Record<string, unknown>;
export type EnvironmentVariables = Record<string, string | undefined>;

export enum PreflightStep {
  Environment = 'environment',
  CompanyFacts = 'company facts',
  NpmVersion = 'npm version',
  PluginWheel = 'plugin wheel',
  StartLink = 'start link',
  Git = 'git',
  Gate = 'gate',
  Config = 'config',
  Domain = 'domain',
  Readiness = 'readiness',
  Secrets = 'secrets',
  Migrations = 'migrations',
  SmokeInputs = 'smoke inputs',
}

export type WorkerFacts = { exportsScheduled: boolean; mountsInstallRoute: boolean };

export type PreflightRefusal = { step: PreflightStep; message: string };

export enum PreflightWarningKind {
  PackageUnpublished = 'package unpublished',
  MetaAppSecretMissing = 'meta app secret missing',
  ResendApiKeyMissing = 'resend api key missing',
}

export type PreflightWarning = { kind: PreflightWarningKind; message: string };

export type WorkerPreflightInput = {
  environment: DeployEnvironment;
  firstDeploy: boolean;
  block: DeployBlock;
  workerFacts: WorkerFacts;
  shell: DeployShell;
  isInteractive: boolean;
  environmentVariables: EnvironmentVariables;
  company: CompanyFacts;
  npmVersion: string;
  plugins: AgentPlugin[];
  packageFetcher: PackageFetcher;
  nameserverResolver: NameserverResolver;
  warn: (warning: PreflightWarning) => void;
};

export type DocsPreflightInput = {
  shell: DeployShell;
  company: CompanyFacts;
  npmVersion: string;
  plugins: AgentPlugin[];
  packageFetcher: PackageFetcher;
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
const originBlockSchema = z.object({ vars: z.object({ PUBLIC_ORIGIN: z.string() }) });
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

async function refuseUnsetCompanyFacts(input: { company: CompanyFacts }): Promise<string | null> {
  const unset = Object.entries(input.company)
    .filter(([, value]) => value === COMPANY_FACT_UNSET)
    .map(([field]) => field);
  if (unset.length === 0) return null;
  return `COMPANY facts are still ${COMPANY_FACT_UNSET}: ${unset.join(', ')}; fill the Logic Bit company facts in libs/types before deploying`;
}

type AbsentPackageHandler = (input: { packageSpec: string }) => string | null;

function npmFailureReason(input: { packageSpec: string; stdout: string; onAbsentPackage: AbsentPackageHandler }): string | null {
  const code = npmFailureCodeOf({ stdout: input.stdout });
  if (code === NPM_NOT_FOUND_CODE) return input.onAbsentPackage({ packageSpec: input.packageSpec });
  return `could not reach npm to read ${input.packageSpec} (${code}); check your network and run it again`;
}

function npmFailureCodeOf(input: { stdout: string }): string {
  const failure = npmFailureSchema.safeParse(parseJsonOrNull({ text: input.stdout }));
  return failure.success ? failure.data.error.code : NO_NPM_ANSWER;
}

type PublishedPackage = { name: string; version: string };

function packageSpecOf(input: { published: PublishedPackage }): string {
  return `${input.published.name}@${input.published.version}`;
}

async function untrustedOwnershipReasonOf(input: {
  shell: DeployShell;
  packageSpec: string;
  publisher: string;
  maintainersStdout: string;
}): Promise<string | null> {
  const { shell, packageSpec, publisher } = input;
  const maintainers = npmPeopleSchema.safeParse(parseJsonOrNull({ text: input.maintainersStdout }));
  if (!maintainers.success) return `could not read the maintainers of ${packageSpec} as JSON`;
  const names = npmNamesOf({ people: maintainers.data });
  const hasOnlyPublisher = names.length > 0 && names.every((name) => name === publisher);
  if (!hasOnlyPublisher)
    return `${packageSpec} must be maintained only by the npm user ${publisher}; its maintainers are ${names.join(', ')}`;
  const publisherAnswer = await shell.run({ file: NPM, args: ['view', packageSpec, '_npmUser', '--json', ...NPM_REGISTRY_FLAGS] });
  if (publisherAnswer.exitCode !== 0) return `could not read who published ${packageSpec}`;
  const publishedBy = npmPeopleSchema.safeParse(parseJsonOrNull({ text: publisherAnswer.stdout }));
  if (!publishedBy.success) return `could not read who published ${packageSpec} as JSON`;
  const publishers = npmNamesOf({ people: publishedBy.data });
  if (publishers.length === 1 && publishers[0] === publisher) return null;
  return `${packageSpec} was published by ${publishers.join(', ')}, not by the npm user ${publisher}`;
}

async function untrustedReasonOf(input: {
  shell: DeployShell;
  published: PublishedPackage;
  publisher: string;
  onAbsentPackage: AbsentPackageHandler;
}): Promise<string | null> {
  const { shell, published, publisher, onAbsentPackage } = input;
  const packageSpec = packageSpecOf({ published });
  const versionAnswer = await shell.run({ file: NPM, args: ['view', packageSpec, 'maintainers', '--json', ...NPM_REGISTRY_FLAGS] });
  if (versionAnswer.exitCode === 0) {
    return untrustedOwnershipReasonOf({ shell, packageSpec, publisher, maintainersStdout: versionAnswer.stdout });
  }
  const isVersionAbsent = npmFailureCodeOf({ stdout: versionAnswer.stdout }) === NPM_NOT_FOUND_CODE;
  if (!isVersionAbsent) return npmFailureReason({ packageSpec, stdout: versionAnswer.stdout, onAbsentPackage });
  const nameAnswer = await shell.run({ file: NPM, args: ['view', published.name, 'maintainers', '--json', ...NPM_REGISTRY_FLAGS] });
  if (nameAnswer.exitCode !== 0) return npmFailureReason({ packageSpec, stdout: nameAnswer.stdout, onAbsentPackage });
  const ownershipReason = await untrustedOwnershipReasonOf({
    shell,
    packageSpec: published.name,
    publisher,
    maintainersStdout: nameAnswer.stdout,
  });
  if (ownershipReason !== null) return ownershipReason;
  return onAbsentPackage({ packageSpec });
}

async function firstUntrusted(input: {
  shell: DeployShell;
  packages: PublishedPackage[];
  publisher: string;
  onAbsentPackage: AbsentPackageHandler;
}): Promise<string | null> {
  const [current, ...remaining] = input.packages;
  if (!current) return null;
  const reason = await untrustedReasonOf({ ...input, published: current });
  if (reason !== null) return reason;
  return firstUntrusted({ ...input, packages: remaining });
}

async function refuseUntrustedPackages(input: {
  shell: DeployShell;
  environmentVariables: EnvironmentVariables;
  packages: PublishedPackage[];
  onAbsentPackage: AbsentPackageHandler;
}): Promise<string | null> {
  const publisher = input.environmentVariables[NPM_PUBLISHER_VARIABLE];
  if (publisher === undefined || publisher === '' || isPlaceholderValue({ value: publisher })) {
    return `${NPM_PUBLISHER_VARIABLE} is not set; set it to the npm user that publishes the packages`;
  }
  return firstUntrusted({ shell: input.shell, packages: input.packages, publisher, onAbsentPackage: input.onAbsentPackage });
}

function publishedPackagesOf(input: { npmVersion: string; plugins: AgentPlugin[] }): PublishedPackage[] {
  const npmPlugins = input.plugins.filter((plugin) => plugin.registry === PluginRegistry.Npm);
  return [
    { name: NPM_PACKAGE_NAME, version: input.npmVersion },
    ...npmPlugins.map((plugin) => ({ name: plugin.packageName, version: plugin.version })),
  ];
}

async function refuseUntrustedWorkerPackage(input: WorkerPreflightInput): Promise<string | null> {
  return refuseUntrustedPackages({
    ...input,
    packages: publishedPackagesOf(input),
    onAbsentPackage: ({ packageSpec }) => {
      input.warn({ kind: PreflightWarningKind.PackageUnpublished, message: `${packageSpec} is not on npm yet; publish it before launch` });
      return null;
    },
  });
}

async function refuseUntrustedDocsPackages(input: DocsPreflightInput): Promise<string | null> {
  return refuseUntrustedPackages({
    ...input,
    packages: publishedPackagesOf(input),
    onAbsentPackage: ({ packageSpec }) => `${packageSpec} does not resolve on npm; publish it first`,
  });
}

function hostedArtifactsOf(input: { plugins: AgentPlugin[] }): HostedArtifact[] {
  return input.plugins.flatMap((plugin) => plugin.hostedArtifacts);
}

function hostedUrlOf(input: { artifact: HostedArtifact }): string {
  return `${PRODUCTION_PUBLIC_ORIGIN}${input.artifact.path}`;
}

function hashMismatch(input: { artifact: HostedArtifact; actual: string }): string {
  const { artifact, actual } = input;
  return `the hosted ${artifact.filename} hashes to ${actual}, not ${artifact.expectedSha256}; upload the files in ${artifact.releaseFolder} with the runbook step`;
}

async function workerArtifactRefusal(input: { shell: DeployShell; artifact: HostedArtifact }): Promise<string | null> {
  const { shell, artifact } = input;
  const { filename } = artifact;
  const downloadPath = join(tmpdir(), `${WHEEL_DOWNLOAD_PREFIX}${randomUUID()}-${filename}`);
  const download = wranglerCommand({
    environment: DeployEnvironment.Production,
    args: ['r2', 'object', 'get', `${PRODUCTION_PACKAGES_BUCKET}/${filename}`],
    flags: ['--remote', '--file', downloadPath],
  });
  const downloaded = await shell.run(download);
  if (downloaded.exitCode !== 0) {
    return `${filename} is not readable in the ${PRODUCTION_PACKAGES_BUCKET} bucket; upload it with the runbook step (wrangler r2 object put) or check your Cloudflare login`;
  }
  const hashed = await shell.run({ file: SHASUM, args: ['-a', '256', downloadPath] });
  await shell.run({ file: REMOVE, args: ['-f', downloadPath] });
  const actual = hashed.stdout.trim().split(WHITESPACE)[0];
  if (hashed.exitCode !== 0 || !actual) return `could not hash the downloaded ${filename}`;
  if (actual === artifact.expectedSha256) return null;
  return hashMismatch({ artifact, actual });
}

async function docsArtifactRefusal(input: { packageFetcher: PackageFetcher; artifact: HostedArtifact }): Promise<string | null> {
  const { packageFetcher, artifact } = input;
  const url = hostedUrlOf({ artifact });
  const answer = await packageFetcher({ url }).catch(() => null);
  if (answer === null) return `could not reach ${url}; check your network and run it again`;
  if (answer.status === HttpStatus.NotFound) return `${url} answers 404; upload the file with the runbook step and deploy the Worker first`;
  if (answer.status !== HttpStatus.Ok) return `could not reach ${url}; it answered ${answer.status}`;
  if (answer.sha256 === artifact.expectedSha256) return null;
  return hashMismatch({ artifact, actual: answer.sha256 });
}

async function firstArtifactRefusal(input: {
  artifacts: HostedArtifact[];
  refusalOf: (artifact: HostedArtifact) => Promise<string | null>;
}): Promise<string | null> {
  const [current, ...remaining] = input.artifacts;
  if (!current) return null;
  const refusal = await input.refusalOf(current);
  if (refusal !== null) return refusal;
  return firstArtifactRefusal({ ...input, artifacts: remaining });
}

async function refuseUnhostedWorkerArtifacts(input: WorkerPreflightInput): Promise<string | null> {
  return firstArtifactRefusal({
    artifacts: hostedArtifactsOf(input),
    refusalOf: (artifact) => workerArtifactRefusal({ shell: input.shell, artifact }),
  });
}

async function refuseUnservedStartLink(input: DocsPreflightInput): Promise<string | null> {
  const answer = await input.packageFetcher({ url: START_LINK }).catch(() => null);
  if (answer === null) return `could not reach ${START_LINK}; check your network and run it again`;
  const isWhatsAppRedirect = answer.status === HttpStatus.Found && answer.location?.startsWith(`${WHATSAPP_LINK_ORIGIN}/`) === true;
  if (isWhatsAppRedirect) return null;
  return `${START_LINK} answered ${answer.status} and not a redirect to ${WHATSAPP_LINK_ORIGIN}; deploy the Worker and activate a number first`;
}

async function refuseUnhostedDocsArtifacts(input: DocsPreflightInput): Promise<string | null> {
  return firstArtifactRefusal({
    artifacts: hostedArtifactsOf(input),
    refusalOf: (artifact) => docsArtifactRefusal({ packageFetcher: input.packageFetcher, artifact }),
  });
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
  const args = ['verify'];
  const result = await input.shell.run({ file: PNPM, args });
  if (result.exitCode === 0) return null;
  return `the gate failed: ${PNPM} ${args.join(' ')}`;
}

async function refuseLeftoverPlaceholder(input: WorkerPreflightInput): Promise<string | null> {
  const paths = placeholderPathsOf({ value: input.block, path: '' });
  if (paths.length === 0) return null;
  return `the ${input.environment} block still holds placeholders: ${paths.join(', ')}`;
}

async function nameserversOrReason(input: { nameserverResolver: NameserverResolver }): Promise<string[] | string> {
  try {
    return await input.nameserverResolver({ zone: PRODUCTION_ZONE });
  } catch (error) {
    return `could not look up the ${PRODUCTION_ZONE} nameservers: ${error instanceof Error ? error.message : String(error)}`;
  }
}

async function refuseUnreadyDomain(input: WorkerPreflightInput): Promise<string | null> {
  const origin = originBlockSchema.safeParse(input.block);
  if (!origin.success || origin.data.vars.PUBLIC_ORIGIN !== PRODUCTION_PUBLIC_ORIGIN) {
    return `PUBLIC_ORIGIN must be ${PRODUCTION_PUBLIC_ORIGIN} in production`;
  }
  const nameservers = await nameserversOrReason(input);
  if (typeof nameservers === 'string') return nameservers;
  const isOnCloudflare = nameservers.length > 0 && nameservers.every((name) => name.toLowerCase().endsWith(CLOUDFLARE_NAMESERVER_SUFFIX));
  if (isOnCloudflare) return null;
  return `${PRODUCTION_ZONE} nameservers are ${nameservers.join(', ') || 'none'}; they must be Cloudflare nameservers (*${CLOUDFLARE_NAMESERVER_SUFFIX}); see docs/runbooks/dns.md`;
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

function warnOnUnsetMetaAppSecret(input: { present: string[]; warn: (warning: PreflightWarning) => void }): null {
  if (input.present.includes(WarnedWorkerSecret.MetaAppSecret)) return null;
  input.warn({
    kind: PreflightWarningKind.MetaAppSecretMissing,
    message: `${WarnedWorkerSecret.MetaAppSecret} is not set; the webhook refuses every delivery until you run wrangler secret put ${WarnedWorkerSecret.MetaAppSecret}`,
  });
  return null;
}

async function refuseMissingSecrets(input: WorkerPreflightInput): Promise<string | null> {
  const command = wranglerCommand({ environment: input.environment, args: ['secret', 'list'], flags: ['--format', 'json'] });
  const result = await input.shell.run(command);
  if (result.exitCode !== 0) return 'could not list the Worker secrets';
  const secrets = secretListSchema.safeParse(parseJsonOrNull({ text: result.stdout }));
  if (!secrets.success) return 'the Worker secret list is not JSON; update wrangler or check your login';
  const present = secrets.data.map((secret) => secret.name);
  const missing = Object.values(WorkerSecret).filter((name) => !present.includes(name));
  if (missing.length === 0) return warnOnUnsetMetaAppSecret({ present, warn: input.warn });
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
  { step: PreflightStep.CompanyFacts, refusalOf: productionOnly({ refusalOf: refuseUnsetCompanyFacts }) },
  { step: PreflightStep.NpmVersion, refusalOf: productionOnly({ refusalOf: refuseUntrustedWorkerPackage }) },
  { step: PreflightStep.PluginWheel, refusalOf: productionOnly({ refusalOf: refuseUnhostedWorkerArtifacts }) },
  { step: PreflightStep.Config, refusalOf: refuseLeftoverPlaceholder },
  { step: PreflightStep.Domain, refusalOf: productionOnly({ refusalOf: refuseUnreadyDomain }) },
  { step: PreflightStep.Readiness, refusalOf: refuseUnreadyProduction },
  { step: PreflightStep.SmokeInputs, refusalOf: refuseMissingSmokeInputs },
  { step: PreflightStep.Git, refusalOf: refuseUncleanGit },
  { step: PreflightStep.Secrets, refusalOf: refuseMissingSecrets },
  { step: PreflightStep.Migrations, refusalOf: refusePendingMigrations },
  { step: PreflightStep.Gate, refusalOf: refuseFailedGate },
];

const DOCS_CHECKS: PreflightCheck<DocsPreflightInput>[] = [
  { step: PreflightStep.CompanyFacts, refusalOf: refuseUnsetCompanyFacts },
  { step: PreflightStep.NpmVersion, refusalOf: refuseUntrustedDocsPackages },
  { step: PreflightStep.PluginWheel, refusalOf: refuseUnhostedDocsArtifacts },
  { step: PreflightStep.StartLink, refusalOf: refuseUnservedStartLink },
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
