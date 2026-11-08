import { describe, expect, expectTypeOf, test } from 'vitest';
import { connectCommand } from './connect-command';
import { ConnectorClient } from './generated/ids';

const CONNECTION_LINK = 'https://zapbip.example/c/zb_conn_FAKE/mcp';

describe('connectCommand', () => {
  test.each(Object.values(ConnectorClient))('names the %s runtime in the connect flag', (client) => {
    expect(connectCommand({ connectionLink: CONNECTION_LINK, client })).toMatch(
      new RegExp(`^ZAPBIP_CONNECTION_URL=${CONNECTION_LINK} npx zapbip@\\S+ connect --client ${client}$`),
    );
  });

  test('accepts only a connector client', () => {
    expectTypeOf(connectCommand).parameter(0).toHaveProperty('client').toEqualTypeOf<ConnectorClient>();
  });
});
