import type { AgentDefinition } from '../contract';

export type RegistryEntry = { id: string; definition: AgentDefinition | null };

const FOLDER_NAME_PATTERN = /^[a-z][a-z0-9-]*$/;
const ENUM_MEMBER_PATTERN = /^[A-Z][A-Za-z0-9]*$/;
export const MATRIX_PAGE_NAME = 'supported-agents';

export function hasValidAgentId(input: { id: string }): boolean {
  return FOLDER_NAME_PATTERN.test(input.id) && input.id !== MATRIX_PAGE_NAME;
}

export function violationIf(input: { condition: boolean; message: string }): string[] {
  return input.condition ? [input.message] : [];
}

function entryViolationsOf(input: { entry: RegistryEntry }): string[] {
  const { id, definition } = input.entry;
  const folderViolations = [
    ...violationIf({
      condition: !FOLDER_NAME_PATTERN.test(id),
      message: `supported/${id}: the folder name must match ${FOLDER_NAME_PATTERN.source}`,
    }),
    ...violationIf({ condition: id === MATRIX_PAGE_NAME, message: `${id} is the matrix page` }),
  ];
  if (!definition) return [...folderViolations, `${id}: definition.ts is missing`];
  const { enumMember } = definition;
  const { expectedDelaySeconds } = definition.listen;
  const hasInvalidDelay = expectedDelaySeconds !== null && expectedDelaySeconds <= 0;
  return [
    ...folderViolations,
    ...violationIf({ condition: !ENUM_MEMBER_PATTERN.test(enumMember), message: `${id}: enumMember must be PascalCase` }),
    ...violationIf({ condition: hasInvalidDelay, message: `${id}: expected delay must be positive or null` }),
  ];
}

function duplicateViolationsOf(input: { entries: RegistryEntry[] }): string[] {
  const members = input.entries.flatMap((entry) => (entry.definition ? [entry.definition.enumMember] : []));
  const duplicatedMembers = [...new Set(members.filter((member, index) => members.indexOf(member) !== index))];
  return duplicatedMembers.map((member) => {
    const ids = input.entries.filter((entry) => entry.definition?.enumMember === member).map((entry) => entry.id);
    return `${ids.join(' and ')} both declare the enumMember ${member}`;
  });
}

export function registryViolationsOf(input: { entries: RegistryEntry[] }): string[] {
  return [...input.entries.flatMap((entry) => entryViolationsOf({ entry })), ...duplicateViolationsOf({ entries: input.entries })];
}
