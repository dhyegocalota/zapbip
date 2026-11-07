import { parseArgs } from 'node:util';
import { z } from 'zod';
import { DEV_SEED_PATH } from '../src/contract/constants';

const DEFAULT_ORIGIN = 'http://localhost:8787';
const AGENT_SEPARATOR = ',';

const seedOutputSchema = z.object({ connections: z.array(z.object({ agent: z.string(), secret: z.string() })) });
const errorOutputSchema = z.object({ error: z.string(), message: z.string() });

async function seed(): Promise<void> {
  const { values } = parseArgs({
    options: {
      phone: { type: 'string' },
      agents: { type: 'string' },
      json: { type: 'boolean', default: false },
      origin: { type: 'string', default: DEFAULT_ORIGIN },
    },
  });
  if (values.phone === undefined || values.agents === undefined)
    throw new Error('usage: --phone <digits> --agents <name,name> [--json] [--origin <url>]');
  const response = await fetch(`${values.origin}${DEV_SEED_PATH}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone: values.phone, agents: values.agents.split(AGENT_SEPARATOR) }),
  });
  const body: unknown = await response.json();
  if (!response.ok) {
    const failure = errorOutputSchema.parse(body);
    throw new Error(`${failure.error}: ${failure.message}`);
  }
  const output = seedOutputSchema.parse(body);
  console.log(
    values.json ? JSON.stringify(output) : output.connections.map((connection) => connection.agent + ' ' + connection.secret).join('\n'),
  );
}

seed().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
