import { posix } from 'node:path';
import { hasValidAgentId } from '../src/checks/registry';
import { displayNameOf, pascalCaseOf } from './identifiers';
import type { GeneratedFile } from './plan';
import { SUPPORTED_FOLDER } from './repository';

const TEMPLATE_FOLDER = 'libs/agents/testing/fixture-agent';
const TEMPLATE_ID = 'fixture-agent';
const TEMPLATE_MEMBER = 'FixtureAgent';
const TEMPLATE_ENGLISH_NAME = 'Fixture Agent';
const TEMPLATE_PORTUGUESE_NAME = 'Agente de teste';

export function scaffoldFilesOf(input: {
  id: string;
  existingIds: string[];
  readSource: (path: string) => string;
  listSource: (directory: string) => string[];
}): GeneratedFile[] {
  if (!hasValidAgentId({ id: input.id })) throw new Error(`${input.id} is not a valid agent id`);
  if (input.existingIds.includes(input.id)) throw new Error(`${input.id} already exists`);
  const displayName = displayNameOf({ id: input.id });
  return input.listSource(TEMPLATE_FOLDER).map((name) => ({
    path: posix.join(SUPPORTED_FOLDER, input.id, name),
    content: input
      .readSource(posix.join(TEMPLATE_FOLDER, name))
      .replaceAll(TEMPLATE_ID, input.id)
      .replaceAll(TEMPLATE_MEMBER, pascalCaseOf({ id: input.id }))
      .replaceAll(TEMPLATE_ENGLISH_NAME, displayName)
      .replaceAll(TEMPLATE_PORTUGUESE_NAME, displayName),
  }));
}
