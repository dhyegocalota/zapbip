import { INSTALL_SECTIONS } from '@zapbip/core';
import { InstallClient, OwnerLocale } from '@zapbip/types';
import { describe, expect, it } from 'vitest';
import { setWakeInputShape } from '../../src/contract/mcp-schemas';

const CONNECTION_LINK = 'https://api.test/c/zb_conn_x/mcp';
const STANDBY_AGENT_OPTIONS = ['standby', null];
const SET_WAKE_MODE_PATTERN = /set_wake\(\{mode: "(\w+)"/g;

function wakeModesNamedBy(input: { client: InstallClient }): string[] {
  const texts = Object.values(OwnerLocale).flatMap((locale) =>
    STANDBY_AGENT_OPTIONS.map((standbyAgent) => INSTALL_SECTIONS[input.client]({ connectionLink: CONNECTION_LINK, locale, standbyAgent })),
  );
  return texts.flatMap((text) => [...text.matchAll(SET_WAKE_MODE_PATTERN)].map((match) => match[1]!));
}

describe('install copy and the set_wake contract', () => {
  it.each(Object.values(InstallClient))('every set_wake mode the %s section names is accepted by the server', (client) => {
    const refused = wakeModesNamedBy({ client }).filter((mode) => !setWakeInputShape.mode.safeParse(mode).success);
    expect(refused).toEqual([]);
  });
});
