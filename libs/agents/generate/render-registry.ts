import type { ResolvedAgent } from './agent';
import { camelCaseOf, generatedModulePathOf } from './identifiers';
import { GENERATED_POINTER } from './header';

export type RegistrySpec = {
  agents: ResolvedAgent[];
  exportedName: string;
  moduleFile: string;
  moduleExport: string;
  enumName: string;
  valueType: string;
  contractType: string;
  extraImports: string[];
  extraSource: string[];
};

function importOf(input: { agent: ResolvedAgent; spec: RegistrySpec }): string {
  const modulePath = generatedModulePathOf({ folder: input.agent.folder, file: input.spec.moduleFile });
  return `import { ${input.spec.moduleExport} as ${camelCaseOf({ id: input.agent.id })}${input.spec.contractType} } from '${modulePath}';`;
}

function entryOf(input: { agent: ResolvedAgent; spec: RegistrySpec }): string {
  return `  [${input.spec.enumName}.${input.agent.definition.enumMember}]: ${camelCaseOf({ id: input.agent.id })}${input.spec.contractType},`;
}

export function renderRegistry(input: { spec: RegistrySpec }): string {
  const { spec } = input;
  return [
    GENERATED_POINTER,
    `import type { ${spec.contractType} } from '../contract';`,
    ...spec.extraImports,
    `import { ${spec.enumName} } from './ids';`,
    ...spec.agents.map((agent) => importOf({ agent, spec })),
    `export const ${spec.exportedName}: Record<${spec.enumName}, ${spec.valueType}> = {`,
    ...spec.agents.map((agent) => entryOf({ agent, spec })),
    '};',
    ...spec.extraSource,
  ].join('\n');
}
