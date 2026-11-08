import { AGENT_INSTALLS } from '@zapbip/agents/install';
import type { InstallSection } from '@zapbip/core';
import { OwnerLocale } from '@zapbip/types';
import { describe, expect, it } from 'vitest';
import { setWakeInputShape } from '../../src/contract/mcp-schemas';

const CONNECTION_LINK = 'https://api.test/c/zb_conn_x/mcp';
const STANDBY_AGENT_OPTIONS = ['standby', null];
const SET_WAKE_MODE_PATTERN = /set_wake\(\{mode: "(\w+)"/g;

function wakeModesNamedBy(input: { render: InstallSection }): string[] {
  const texts = Object.values(OwnerLocale).flatMap((locale) =>
    STANDBY_AGENT_OPTIONS.map((standbyAgent) => input.render({ connectionLink: CONNECTION_LINK, locale, standbyAgent })),
  );
  return texts.flatMap((text) => [...text.matchAll(SET_WAKE_MODE_PATTERN)].map((match) => match[1]!));
}

describe('install copy and the set_wake contract', () => {
  it.each(Object.entries(AGENT_INSTALLS))('every set_wake mode the %s section names is accepted by the server', (_client, install) => {
    const refused = wakeModesNamedBy({ render: install.render }).filter((mode) => !setWakeInputShape.mode.safeParse(mode).success);
    expect(refused).toEqual([]);
  });
});
