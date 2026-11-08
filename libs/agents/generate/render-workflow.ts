import { pluginAgentsOf, type ResolvedAgent } from './agent';

enum WorkflowRegion {
  MatrixRows = 'unit matrix rows',
  PipInstalls = 'pip install lines',
}

const POINTER = '# NB ADR 0033: generated';
const PIP_INSTALL_COMMAND = '- run: python3 -m pip install --require-hashes -r "$REQUIREMENTS"';
const PIP_ENVIRONMENT_HEADER = '  env:';
const PIP_ENVIRONMENT_VARIABLE = '    REQUIREMENTS:';

function boundaryOf(input: { region: WorkflowRegion; edge: 'begin' | 'end' }): string {
  return `${POINTER} ${input.region} ${input.edge}`;
}

function regionPatternOf(input: { region: WorkflowRegion }): RegExp {
  const begin = boundaryOf({ region: input.region, edge: 'begin' });
  const end = boundaryOf({ region: input.region, edge: 'end' });
  return new RegExp(`^( *)${begin}\\n[\\s\\S]*?^ *${end}$`, 'gm');
}

function replaceRegion(input: { source: string; region: WorkflowRegion; lines: string[] }): string {
  const { source, region, lines } = input;
  const pattern = regionPatternOf({ region });
  if (!pattern.test(source)) throw new Error(`verify.yml has no ${region} region to rewrite`);
  return source.replace(pattern, (_whole, indent: string) =>
    [boundaryOf({ region, edge: 'begin' }), ...lines, boundaryOf({ region, edge: 'end' })].map((line) => `${indent}${line}`).join('\n'),
  );
}

export function renderWorkflow(input: { source: string; agents: ResolvedAgent[] }): string {
  const plugins = pluginAgentsOf({ agents: input.agents }).map((agent) => agent.plugin);
  const matrixRows = plugins.map((plugin) => `- { name: ${plugin.workflow.name}, filter: "${plugin.workflow.filter}" }`);
  const requirements = plugins.flatMap((plugin) =>
    plugin.workflow.pythonRequirements === null ? [] : [plugin.workflow.pythonRequirements],
  );
  const pipInstalls = [...new Set(requirements)].flatMap((path) => [
    PIP_INSTALL_COMMAND,
    PIP_ENVIRONMENT_HEADER,
    `${PIP_ENVIRONMENT_VARIABLE} ${path}`,
  ]);
  const withRows = replaceRegion({ source: input.source, region: WorkflowRegion.MatrixRows, lines: matrixRows });
  return replaceRegion({ source: withRows, region: WorkflowRegion.PipInstalls, lines: pipInstalls });
}
