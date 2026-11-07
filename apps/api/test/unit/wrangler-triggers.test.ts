import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { unstable_readConfig as readConfig } from 'wrangler';

const CONFIG_PATH = join(import.meta.dirname, '..', '..', 'wrangler.jsonc');
const SCHEDULED_CRON = '*/30 * * * *';

describe.each([
  { name: 'production', environment: undefined },
  { name: 'development', environment: 'development' },
])('wrangler $name cron trigger', ({ environment }) => {
  it('runs the account jobs every 30 minutes', () => {
    expect(readConfig({ config: CONFIG_PATH, env: environment }).triggers.crons).toEqual([SCHEDULED_CRON]);
  });
});
