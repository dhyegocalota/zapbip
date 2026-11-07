import { HttpStatus } from '@zapbip/types';
import { InboxError, invalidInput } from '@zapbip/core';
import { Hono } from 'hono';
import { z } from 'zod';
import { createPlatformClock } from '../adapters/platform/clock';
import type { AccountOwnerRpc } from '../contract/account-owner-rpc';
import { DEV_SEED_PATH } from '../contract/constants';
import type { Bindings } from '../contract/env';
import { assertOwnerAbsent, buildDirectorySeed, findOwnerStatement } from '../dev/build-directory-seed';
import { accountInboxOf } from './account-inbox-stub';
import { ERROR_STATUS } from './http-status';

const OWNER_COUNT_MISSING_MESSAGE = 'owner count missing';

const seedBodySchema = z.object({ phone: z.string(), agents: z.array(z.string()) });

type SeedBody = z.infer<typeof seedBodySchema>;
type SeededConnection = { agent: string; secret: string };

async function seedDirectory(input: { bindings: Bindings; body: SeedBody }): Promise<SeededConnection[]> {
  const { bindings, body } = input;
  const database = bindings.CONNECTIONS;
  const owners = await database.prepare(findOwnerStatement({ phone: body.phone })).first<{ total: number }>();
  if (owners === null) throw new Error(OWNER_COUNT_MISSING_MESSAGE);
  assertOwnerAbsent({ existingCount: owners.total });
  const directorySeed = await buildDirectorySeed({ ...body, createdAt: createPlatformClock().now() });
  await database.batch(directorySeed.statements.map((statement) => database.prepare(statement)));
  const inbox = accountInboxOf<AccountOwnerRpc>({ bindings, accountId: directorySeed.accountId });
  await Promise.all(directorySeed.connections.map(({ agent, secretDigest }) => inbox.recordCreation({ agent, secretDigest })));
  return directorySeed.connections.map(({ agent, secret }) => ({ agent, secret }));
}

function errorBody(input: { error: InboxError }) {
  return { error: input.error.code, message: input.error.message };
}

export const devSeedRoutes = new Hono<{ Bindings: Bindings }>();

devSeedRoutes.post(DEV_SEED_PATH, async (context) => {
  const parsed = seedBodySchema.safeParse(await context.req.json().catch(() => null));
  if (!parsed.success)
    return context.json(errorBody({ error: invalidInput({ message: z.prettifyError(parsed.error) }) }), HttpStatus.BadRequest);
  try {
    const connections = await seedDirectory({ bindings: context.env, body: parsed.data });
    return context.json({ connections }, HttpStatus.Ok);
  } catch (error) {
    if (!(error instanceof InboxError)) throw error;
    return context.json(errorBody({ error }), ERROR_STATUS[error.code]);
  }
});
