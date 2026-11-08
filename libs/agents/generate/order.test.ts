import { WakeRung } from '@zapbip/types';
import { describe, expect, test } from 'vitest';
import { agentOrderOf } from '../src/order';
import { SAMPLE_IDS_IN_ORDER, definitionsOf, sampleAgents, sampleDefinitionOf } from './test-agents';

describe('agentOrderOf', () => {
  test('lists the definitions by wake rung, then by lower-case English name', () => {
    const definitions = definitionsOf({ agents: sampleAgents() });
    expect(agentOrderOf({ definitions })).toEqual(SAMPLE_IDS_IN_ORDER);
  });

  test('drops an agent that has no definition', () => {
    const { 'beta-webhook': dropped, ...definitions } = definitionsOf({ agents: sampleAgents() });
    expect(dropped).toBeDefined();
    expect(agentOrderOf({ definitions })).toEqual(SAMPLE_IDS_IN_ORDER.filter((id) => id !== 'beta-webhook'));
  });

  test('places a new agent among the known ones by its rung, then its name', () => {
    const definitions = {
      ...definitionsOf({ agents: sampleAgents() }),
      'new-webhook': sampleDefinitionOf({ name: 'Aardvark Webhook', rung: WakeRung.Webhook, expectedDelaySeconds: null }),
    };
    expect(agentOrderOf({ definitions })).toEqual([
      'alpha-local',
      'zeta-local',
      'new-webhook',
      'beta-webhook',
      'gamma-scheduled',
      'delta-standby',
      'epsilon-inbox',
    ]);
  });

  test('sorts a new agent by the English matrix name in lower case when the rung ties', () => {
    const tied = { rung: WakeRung.Local, expectedDelaySeconds: null };
    const definitions = { zeta: sampleDefinitionOf({ name: 'zeta', ...tied }), alpha: sampleDefinitionOf({ name: 'Alpha', ...tied }) };
    expect(agentOrderOf({ definitions })).toEqual(['alpha', 'zeta']);
  });
});
