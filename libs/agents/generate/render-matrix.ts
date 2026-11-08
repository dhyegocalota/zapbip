import { DocsLanguage } from '@zapbip/types';
import { WAKE_RUNG_LABELS, agentPagePathOf } from '../src/docs';
import { OrderSurface } from '../src/order';
import { orderedAgentsOf, type ResolvedAgent } from './agent';
import { DELAY_NOT_MEASURED, MATRIX_HEADERS } from './matrix-copy';

const SECONDS_PER_HOUR = 3600;
const CELL_SEPARATOR = ' | ';

function delayLabelOf(input: { expectedDelaySeconds: number | null; language: DocsLanguage }): string {
  if (input.expectedDelaySeconds === null) return DELAY_NOT_MEASURED[input.language];
  const isWholeHours = input.expectedDelaySeconds % SECONDS_PER_HOUR === 0;
  const unit = isWholeHours ? 'hour' : 'second';
  const amount = isWholeHours ? input.expectedDelaySeconds / SECONDS_PER_HOUR : input.expectedDelaySeconds;
  return new Intl.NumberFormat(input.language, { style: 'unit', unit, unitDisplay: 'long' }).format(amount);
}

function rowOf(input: { agent: ResolvedAgent; language: DocsLanguage }): string {
  const { docs, listen } = input.agent.definition;
  const pageLink = `[${docs.linkName[input.language]}](/${agentPagePathOf({ client: input.agent.id, language: input.language })})`;
  return rowTextOf({
    cells: [
      docs.matrixName[input.language],
      WAKE_RUNG_LABELS[input.language][listen.rung],
      delayLabelOf({ expectedDelaySeconds: listen.expectedDelaySeconds, language: input.language }),
      pageLink,
    ],
  });
}

function rowTextOf(input: { cells: string[] }): string {
  return `| ${input.cells.join(CELL_SEPARATOR)} |`;
}

export function renderMatrix(input: { agents: ResolvedAgent[]; language: DocsLanguage }): string {
  const header = MATRIX_HEADERS[input.language];
  const separator = header.map(() => '---');
  const rows = orderedAgentsOf({ agents: input.agents, surface: OrderSurface.Matrix }).map((agent) =>
    rowOf({ agent, language: input.language }),
  );
  return [rowTextOf({ cells: header }), rowTextOf({ cells: separator }), ...rows, ''].join('\n');
}
