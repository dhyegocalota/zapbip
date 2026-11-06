import { OwnerLocale, WakeCopyKey } from '@zapbip/types';
import type { AgentName } from '../inbox/connection';
import { invalidInput } from '../inbox/inbox-error-factories';

export const WAKE_COPY: Record<WakeCopyKey, Record<OwnerLocale, string>> = {
  [WakeCopyKey.WakeFailed]: {
    [OwnerLocale.PortugueseBrazil]:
      'Não consegui acordar seu agente. Sua mensagem espera no inbox; peça a ele para rodar set_wake de novo.',
    [OwnerLocale.EnglishUs]: 'I could not wake your agent. Your message waits in the inbox; ask it to run set_wake again.',
  },
  [WakeCopyKey.ExpectedDelayNote]: {
    [OwnerLocale.PortugueseBrazil]: 'O agente {agent} olha a caixa {cadence}. {lastPoll} Sua mensagem espera lá até a próxima olhada.',
    [OwnerLocale.EnglishUs]: 'The agent {agent} checks the inbox {cadence}. {lastPoll} Your message waits there until the next check.',
  },
  [WakeCopyKey.StaleNotice]: {
    [OwnerLocale.PortugueseBrazil]: 'O agente {agent} parou de olhar a caixa. {lastPoll} Suas mensagens esperam lá até ele voltar.',
    [OwnerLocale.EnglishUs]: 'The agent {agent} stopped checking the inbox. {lastPoll} Your messages wait there until it returns.',
  },
  [WakeCopyKey.CadenceHourly]: {
    [OwnerLocale.PortugueseBrazil]: 'de hora em hora',
    [OwnerLocale.EnglishUs]: 'every hour',
  },
  [WakeCopyKey.CadenceHours]: {
    [OwnerLocale.PortugueseBrazil]: 'a cada {count} horas',
    [OwnerLocale.EnglishUs]: 'every {count} hours',
  },
  [WakeCopyKey.CadenceMinutes]: {
    [OwnerLocale.PortugueseBrazil]: 'a cada {count} minutos',
    [OwnerLocale.EnglishUs]: 'every {count} minutes',
  },
  [WakeCopyKey.ElapsedMinutes]: {
    [OwnerLocale.PortugueseBrazil]: 'Última checagem há {count} min.',
    [OwnerLocale.EnglishUs]: 'Last check {count} min ago.',
  },
  [WakeCopyKey.ElapsedHours]: {
    [OwnerLocale.PortugueseBrazil]: 'Última checagem há {count} h.',
    [OwnerLocale.EnglishUs]: 'Last check {count} h ago.',
  },
  [WakeCopyKey.NeverPolled]: {
    [OwnerLocale.PortugueseBrazil]: 'Ainda não olhou a caixa.',
    [OwnerLocale.EnglishUs]: 'It has not checked the inbox yet.',
  },
};

export function wakeFailedCopy(input: { locale: OwnerLocale }): string {
  const text = WAKE_COPY[WakeCopyKey.WakeFailed][input.locale];
  if (text === undefined) throw invalidInput({ message: 'wake: unknown locale' });
  return text;
}

export function expectedDelayNoteCopy(input: {
  locale: OwnerLocale;
  agent: AgentName;
  intervalMinutes: number;
  elapsedSinceLastPollMs: number | null;
}): string {
  void input;
  throw new Error('expectedDelayNoteCopy is not implemented');
}

export function staleNoticeCopy(input: { locale: OwnerLocale; agent: AgentName; elapsedSinceLastPollMs: number | null }): string {
  void input;
  throw new Error('staleNoticeCopy is not implemented');
}
