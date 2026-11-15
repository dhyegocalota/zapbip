import { posix } from 'node:path';
import { hasValidAgentId } from '../src/checks/registry';
import { constantNameOf, displayNameOf, pascalCaseOf } from './identifiers';
import type { GeneratedFile } from './plan';
import { SUPPORTED_FOLDER } from './repository';

export enum ScaffoldKind {
  Install = 'install',
  Connector = 'connector',
  Plugin = 'plugin',
}

type Template = { agentFolder: string; agentId: string; member: string; englishName: string; portugueseName: string };

const TESTING_FOLDER = 'libs/agents/testing';
const PLUGIN_PACKAGE_TEMPLATE = `${TESTING_FOLDER}/fixture-plugin-package`;
const RAW_FOLDER = 'release';
const TEMPLATES: Record<ScaffoldKind, Template> = {
  [ScaffoldKind.Install]: {
    agentFolder: `${TESTING_FOLDER}/fixture-agent`,
    agentId: 'fixture-agent',
    member: 'FixtureAgent',
    englishName: 'Fixture Agent',
    portugueseName: 'Agente de teste',
  },
  [ScaffoldKind.Connector]: {
    agentFolder: `${TESTING_FOLDER}/fixture-connector-agent`,
    agentId: 'fixture-connector-agent',
    member: 'FixtureConnectorAgent',
    englishName: 'Fixture Connector Agent',
    portugueseName: 'Agente conector de teste',
  },
  [ScaffoldKind.Plugin]: {
    agentFolder: `${TESTING_FOLDER}/fixture-plugin-agent`,
    agentId: 'fixture-plugin-agent',
    member: 'FixturePluginAgent',
    englishName: 'Fixture Plugin Agent',
    portugueseName: 'Agente plugin de teste',
  },
};
const FIXTURE_WORD = 'fixture';
const FIXTURE_CONSTANT_WORD = 'FIXTURE';

function constantWordOf(input: { id: string }): string {
  return input.id.toUpperCase().replaceAll('-', '_');
}

function renamedText(input: { text: string; id: string; template: Template }): string {
  const { text, id, template } = input;
  const displayName = displayNameOf({ id });
  return text
    .replaceAll(PLUGIN_PACKAGE_TEMPLATE, `apps/${id}-plugin`)
    .replaceAll('@zapbip/fixture-plugin-package', `@zapbip/${id}-plugin`)
    .replaceAll('fixture-plugin-package', `@zapbip/${id}-plugin`)
    .replaceAll(template.agentId, id)
    .replaceAll(template.member, pascalCaseOf({ id }))
    .replaceAll(template.englishName, displayName)
    .replaceAll(template.portugueseName, displayName)
    .replaceAll(FIXTURE_CONSTANT_WORD, constantWordOf({ id }))
    .replaceAll(FIXTURE_WORD, id);
}

function copiedFiles(input: {
  id: string;
  template: string;
  destination: string;
  agentTemplate: Template;
  readSource: (path: string) => string;
  listTree: (directory: string) => string[];
}): GeneratedFile[] {
  return input.listTree(input.template).map((relativePath) => {
    const isRaw = relativePath.split('/')[0] === RAW_FOLDER;
    const source = input.readSource(posix.join(input.template, relativePath));
    return {
      path: posix.join(input.destination, relativePath.replaceAll(FIXTURE_WORD, input.id)),
      content: isRaw ? source : renamedText({ text: source, id: input.id, template: input.agentTemplate }),
    };
  });
}

const APPS_README = 'apps/README.md';
const PLUGIN_LICENSE = 'MIT';
const HEADING_PATTERN = /^#/;

function purposeOf(input: { readme: string }): string {
  const [purpose] = input.readme.split('\n').filter((line) => line.trim() !== '' && !HEADING_PATTERN.test(line));
  if (purpose === undefined) throw new Error('the plugin package README has no purpose line');
  return purpose;
}

function appsReadmeWithPluginRow(input: { id: string; source: string; purpose: string }): string {
  const folder = `${input.id}-plugin`;
  const row = `| [${folder}](${folder}/) | ${input.purpose} | ${PLUGIN_LICENSE} |`;
  const lines = input.source.split('\n');
  const lastRowIndex = lines.reduce((last, line, index) => (line.startsWith('|') ? index : last), -1);
  lines.splice(lastRowIndex + 1, 0, row);
  return lines.join('\n');
}

const NAME_DERIVATIONS = [pascalCaseOf, constantNameOf];

function collisionOf(input: { id: string; existingIds: string[] }): string | null {
  const collisions = input.existingIds.flatMap((other) =>
    NAME_DERIVATIONS.flatMap((derive) =>
      derive({ id: other }) === derive({ id: input.id }) ? [`${input.id} collides with ${other} on ${derive({ id: input.id })}`] : [],
    ),
  );
  const [collision] = collisions;
  if (collision === undefined) return null;
  return collision;
}

export function scaffoldFilesOf(input: {
  id: string;
  kind: ScaffoldKind;
  existingIds: string[];
  readSource: (path: string) => string;
  listTree: (directory: string) => string[];
}): GeneratedFile[] {
  if (!hasValidAgentId({ id: input.id })) throw new Error(`${input.id} is not a valid agent id`);
  if (input.existingIds.includes(input.id)) throw new Error(`${input.id} already exists`);
  const collision = collisionOf({ id: input.id, existingIds: input.existingIds });
  if (collision !== null) throw new Error(collision);
  const template = TEMPLATES[input.kind];
  const agentFiles = copiedFiles({
    ...input,
    template: template.agentFolder,
    destination: posix.join(SUPPORTED_FOLDER, input.id),
    agentTemplate: template,
  });
  if (input.kind !== ScaffoldKind.Plugin) return agentFiles;
  const packageFiles = copiedFiles({
    ...input,
    template: PLUGIN_PACKAGE_TEMPLATE,
    destination: `apps/${input.id}-plugin`,
    agentTemplate: template,
  });
  const packageReadme = packageFiles.find((file) => file.path === `apps/${input.id}-plugin/README.md`);
  if (packageReadme === undefined) throw new Error(`the plugin package of ${input.id} has no README`);
  const appsReadme = {
    path: APPS_README,
    content: appsReadmeWithPluginRow({
      id: input.id,
      source: input.readSource(APPS_README),
      purpose: purposeOf({ readme: packageReadme.content }),
    }),
  };
  return [...agentFiles, ...packageFiles, appsReadme];
}
