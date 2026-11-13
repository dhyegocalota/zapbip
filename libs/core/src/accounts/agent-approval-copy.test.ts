import { OwnerLocale } from '@zapbip/types';
import { describe, expect, test } from 'vitest';
import { BUTTON_TITLE_MAX_CHARS } from '../inbox/constants';
import { ApprovalChoice, approvalTitlesOf } from './agent-approval-copy';

describe('approval button titles', () => {
  test.each(Object.values(OwnerLocale))('every title fits a WhatsApp button in %s', (locale) => {
    Object.values(approvalTitlesOf({ locale })).forEach((title) => expect([...title].length).toBeLessThanOrEqual(BUTTON_TITLE_MAX_CHARS));
  });

  test('the secret-handing button says it sends to the agent in both languages', () => {
    expect(approvalTitlesOf({ locale: OwnerLocale.PortugueseBrazil })[ApprovalChoice.AllowAndSend]).toBe('Enviar ao agente');
    expect(approvalTitlesOf({ locale: OwnerLocale.EnglishUs })[ApprovalChoice.AllowAndSend]).toBe('Allow, send to agent');
  });
});
