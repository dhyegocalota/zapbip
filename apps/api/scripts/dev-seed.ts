import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parseArgs } from 'node:util';
import { InboxError } from '@zapbip/core';
import { DEVELOPMENT_ENVIRONMENT } from '../src/contract/constants';
import { assertOwnerAbsent, buildDirectorySeed, findOwnerStatement } from './build-directory-seed';

const DATABASE_BINDING = 'CONNECTIONS';
const SEED_FILE_NAME = 'seed.sql';
const AGENT_SEPARATOR = ',';

type WranglerRows = { results: { total: number }[] }[];

function runWrangler(input: { arguments: string[]; persistTo: string | undefined }): string {
  const persistArguments = input.persistTo === undefined ? [] : ['--persist-to', input.persistTo];
  return execFileSync(
    'pnpm',
    [
      'exec',
      'wrangler',
      'd1',
      'execute',
      DATABASE_BINDING,
      '--env',
      DEVELOPMENT_ENVIRONMENT,
      '--local',
      ...persistArguments,
      '--json',
      ...input.arguments,
    ],
    {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'inherit'],
    },
  );
}

async function seed(): Promise<void> {
  const { values } = parseArgs({
    options: {
      phone: { type: 'string' },
      agents: { type: 'string' },
      json: { type: 'boolean', default: false },
      'persist-to': { type: 'string' },
    },
  });
  if (values.phone === undefined || values.agents === undefined)
    throw new Error('usage: --phone <digits> --agents <name,name> [--json] [--persist-to <dir>]');
  const persistTo = values['persist-to'];
  const owners: WranglerRows = JSON.parse(
    runWrangler({ arguments: ['--command', findOwnerStatement({ phone: values.phone })], persistTo }),
  );
  const [ownerCount] = owners.flatMap((entry) => entry.results);
  if (ownerCount === undefined) throw new Error('owner count missing');
  assertOwnerAbsent({ existingCount: ownerCount.total });
  const directorySeed = await buildDirectorySeed({
    phone: values.phone,
    agents: values.agents.split(AGENT_SEPARATOR),
    createdAt: Date.now(),
  });
  const seedFile = join(mkdtempSync(join(tmpdir(), 'zapbip-seed-')), SEED_FILE_NAME);
  writeFileSync(seedFile, directorySeed.statements.map((statement) => statement + ';').join('\n'));
  runWrangler({ arguments: ['--file', seedFile], persistTo });
  const output = { connections: directorySeed.connections };
  console.log(
    values.json
      ? JSON.stringify(output)
      : directorySeed.connections.map((connection) => connection.agent + ' ' + connection.secret).join('\n'),
  );
}

seed().catch((error: unknown) => {
  console.error(error instanceof InboxError ? error.code + ': ' + error.message : error);
  process.exit(1);
});
