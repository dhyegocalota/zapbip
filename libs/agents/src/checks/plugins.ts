import { createHash } from 'node:crypto';
import { PACKAGE_PATH_PREFIX } from '@zapbip/types';
import { PluginRegistry, type AgentPlugin, type HostedArtifact } from '../contract';
import { violationIf } from './registry';

export type PluginCheckEntry = { id: string; plugin: AgentPlugin };

export type PluginCheckSources = {
  applicationPluginFolders: string[];
  readFile: (path: string) => Buffer | null;
  servedFilenames: string[];
};

type PluginCheckInput = { entry: PluginCheckEntry; sources: PluginCheckSources };
type ArtifactCheckInput = PluginCheckInput & { artifact: HostedArtifact };

const WORKFLOW_FILTER_PATTERN = /^[@\w/.-]+$/;
const WORKFLOW_NAME_PATTERN = /^[\w/.-]+$/;
const REQUIREMENTS_PATH_PATTERN = /^[\w/.-]+$/;
const SHA256_PATTERN = /^[0-9a-f]{64}$/;
const SHA256_ALGORITHM = 'sha256';
const HEXADECIMAL_ENCODING = 'hex';

function sha256Of(input: { bytes: Buffer }): string {
  return createHash(SHA256_ALGORITHM).update(input.bytes).digest(HEXADECIMAL_ENCODING);
}

function releasePathOf(input: { artifact: HostedArtifact }): string {
  return `${input.artifact.releaseFolder}/${input.artifact.filename}`;
}

function claimViolationsOf(input: { entries: PluginCheckEntry[]; applicationPluginFolders: string[] }): string[] {
  return input.applicationPluginFolders.flatMap((folder) => {
    const claimants = input.entries.filter((entry) => entry.plugin.packageFolder === folder).map((entry) => entry.id);
    return [
      ...violationIf({ condition: claimants.length === 0, message: `${folder} is claimed by no plugin.ts` }),
      ...violationIf({ condition: claimants.length > 1, message: `${folder} is claimed by ${claimants.join(' and ')}` }),
    ];
  });
}

function versionPinViolationsOf(input: PluginCheckInput): string[] {
  const { entry, sources } = input;
  return entry.plugin.versionPins.flatMap((pin) => {
    const file = sources.readFile(pin.path);
    if (file === null) return [`${entry.id}: ${pin.path} is missing`];
    return violationIf({
      condition: !pin.pattern.test(file.toString()),
      message: `${entry.id}: ${pin.path} does not match ${pin.pattern.source}`,
    });
  });
}

function releaseViolationsOf(input: ArtifactCheckInput): string[] {
  const { entry, sources, artifact } = input;
  const releasePath = releasePathOf({ artifact });
  const file = sources.readFile(releasePath);
  if (file === null) return [`${entry.id}: ${releasePath} is missing`];
  return violationIf({
    condition: sha256Of({ bytes: file }) !== artifact.expectedSha256,
    message: `${entry.id}: ${releasePath} does not hash to ${artifact.expectedSha256}`,
  });
}

function artifactViolationsOf(input: ArtifactCheckInput): string[] {
  const { entry, artifact } = input;
  return [
    ...violationIf({
      condition: artifact.path !== `${PACKAGE_PATH_PREFIX}${artifact.filename}`,
      message: `${entry.id}: ${artifact.filename} must be served at ${PACKAGE_PATH_PREFIX}${artifact.filename}`,
    }),
    ...violationIf({
      condition: !SHA256_PATTERN.test(artifact.expectedSha256),
      message: `${entry.id}: ${artifact.filename} hash must be 64 hexadecimal characters`,
    }),
    ...releaseViolationsOf(input),
    ...violationIf({
      condition: artifact.embeddedInInstallCommand && !entry.plugin.installCommand.includes(artifact.expectedSha256),
      message: `${entry.id}: the install command must embed the hash of ${artifact.filename}`,
    }),
  ];
}

function embeddingViolationsOf(input: ArtifactCheckInput): string[] {
  const { entry, sources, artifact } = input;
  const embedder = sources.readFile(releasePathOf({ artifact }));
  if (embedder === null) return [];
  const wheels = entry.plugin.hostedArtifacts.filter((other) => !other.embeddedInInstallCommand);
  return wheels.flatMap((other) =>
    violationIf({
      condition: !embedder.toString().includes(other.expectedSha256),
      message: `${entry.id}: ${artifact.filename} must contain the hash of ${other.filename}`,
    }),
  );
}

function embeddedCountViolationsOf(input: PluginCheckInput): string[] {
  const { entry } = input;
  const embeddedCount = entry.plugin.hostedArtifacts.filter((artifact) => artifact.embeddedInInstallCommand).length;
  return violationIf({
    condition: entry.plugin.registry === PluginRegistry.SelfHostedWheel && embeddedCount !== 1,
    message: `${entry.id}: exactly one hosted artifact must be embedded in the install command`,
  });
}

export function pluginWorkflowViolationsOf(input: { entries: PluginCheckEntry[] }): string[] {
  return input.entries.flatMap(({ id, plugin }) => {
    const { name, filter, pythonRequirements } = plugin.workflow;
    const isRequirementsPathSafe =
      pythonRequirements === null ||
      (REQUIREMENTS_PATH_PATTERN.test(pythonRequirements) &&
        pythonRequirements.startsWith(`${plugin.packageFolder}/`) &&
        !pythonRequirements.includes('..'));
    return [
      ...violationIf({
        condition: !WORKFLOW_NAME_PATTERN.test(name),
        message: `${id}: the workflow name must match ${WORKFLOW_NAME_PATTERN.source}`,
      }),
      ...violationIf({
        condition: !WORKFLOW_FILTER_PATTERN.test(filter),
        message: `${id}: the workflow filter must match ${WORKFLOW_FILTER_PATTERN.source}`,
      }),
      ...violationIf({
        condition: !isRequirementsPathSafe,
        message: `${id}: the workflow requirements path must match ${REQUIREMENTS_PATH_PATTERN.source} and sit inside the package folder`,
      }),
    ];
  });
}

function hostedViolationsOf(input: PluginCheckInput): string[] {
  const { entry } = input;
  const artifactViolations = entry.plugin.hostedArtifacts.flatMap((artifact) => artifactViolationsOf({ ...input, artifact }));
  const embeddingViolations = entry.plugin.hostedArtifacts
    .filter((artifact) => artifact.embeddedInInstallCommand)
    .flatMap((artifact) => embeddingViolationsOf({ ...input, artifact }));
  return [...embeddedCountViolationsOf(input), ...artifactViolations, ...embeddingViolations];
}

function allowlistViolationsOf(input: { entries: PluginCheckEntry[]; servedFilenames: string[] }): string[] {
  const hostedFilenames = input.entries.flatMap((entry) => entry.plugin.hostedArtifacts.map((artifact) => artifact.filename));
  const unhosted = input.servedFilenames.filter((filename) => !hostedFilenames.includes(filename));
  const unserved = hostedFilenames.filter((filename) => !input.servedFilenames.includes(filename));
  return [
    ...unhosted.map((filename) => `${PACKAGE_PATH_PREFIX} serves ${filename} but no plugin hosts it`),
    ...unserved.map((filename) => `no ${PACKAGE_PATH_PREFIX} route serves ${filename}`),
  ];
}

export function pluginViolationsOf(input: { entries: PluginCheckEntry[]; sources: PluginCheckSources }): string[] {
  const { entries, sources } = input;
  return [
    ...claimViolationsOf({ entries, applicationPluginFolders: sources.applicationPluginFolders }),
    ...entries.flatMap((entry) => versionPinViolationsOf({ entry, sources })),
    ...entries.flatMap((entry) => hostedViolationsOf({ entry, sources })),
    ...pluginWorkflowViolationsOf({ entries }),
    ...allowlistViolationsOf({ entries, servedFilenames: sources.servedFilenames }),
  ];
}
