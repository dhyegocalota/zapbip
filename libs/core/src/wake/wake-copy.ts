import { HOUR_MS, MINUTE_MS, OwnerLocale, WakeCopyKey } from '@zapbip/types';
import type { AgentName } from '../inbox/connection';
import { fillCopyTokens } from '../inbox/inbox-copy';
import { invalidInput } from '../inbox/inbox-error-factories';

const MINUTES_PER_HOUR = HOUR_MS / MINUTE_MS;
const SINGLE_MINUTE = MINUTE_MS / MINUTE_MS;

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
  [WakeCopyKey.CadenceMinute]: {
    [OwnerLocale.PortugueseBrazil]: 'a cada minuto',
    [OwnerLocale.EnglishUs]: 'every minute',
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

function renderWakeCopy(input: { key: WakeCopyKey; locale: OwnerLocale; values: Record<string, string> }): string {
  const text = WAKE_COPY[input.key][input.locale];
  if (text === undefined) throw invalidInput({ message: 'wake: unknown locale' });
  return fillCopyTokens({ text, values: input.values });
}

export function wakeFailedCopy(input: { locale: OwnerLocale }): string {
  return renderWakeCopy({ key: WakeCopyKey.WakeFailed, locale: input.locale, values: {} });
}

function cadenceCopy(input: { locale: OwnerLocale; intervalMinutes: number }): string {
  const { locale, intervalMinutes } = input;
  if (intervalMinutes === MINUTES_PER_HOUR) return renderWakeCopy({ key: WakeCopyKey.CadenceHourly, locale, values: {} });
  if (intervalMinutes % MINUTES_PER_HOUR === 0) {
    const count = String(intervalMinutes / MINUTES_PER_HOUR);
    return renderWakeCopy({ key: WakeCopyKey.CadenceHours, locale, values: { count } });
  }
  if (intervalMinutes === SINGLE_MINUTE) return renderWakeCopy({ key: WakeCopyKey.CadenceMinute, locale, values: {} });
  return renderWakeCopy({ key: WakeCopyKey.CadenceMinutes, locale, values: { count: String(intervalMinutes) } });
}

function lastPollCopy(input: { locale: OwnerLocale; elapsedSinceLastPollMs: number | null }): string {
  const { locale, elapsedSinceLastPollMs } = input;
  if (elapsedSinceLastPollMs === null) return renderWakeCopy({ key: WakeCopyKey.NeverPolled, locale, values: {} });
  if (elapsedSinceLastPollMs < HOUR_MS) {
    const count = String(Math.floor(elapsedSinceLastPollMs / MINUTE_MS));
    return renderWakeCopy({ key: WakeCopyKey.ElapsedMinutes, locale, values: { count } });
  }
  const count = String(Math.floor(elapsedSinceLastPollMs / HOUR_MS));
  return renderWakeCopy({ key: WakeCopyKey.ElapsedHours, locale, values: { count } });
}

export function expectedDelayNoteCopy(input: {
  locale: OwnerLocale;
  agent: AgentName;
  intervalMinutes: number;
  elapsedSinceLastPollMs: number | null;
}): string {
  const { locale, agent, intervalMinutes, elapsedSinceLastPollMs } = input;
  const cadence = cadenceCopy({ locale, intervalMinutes });
  const lastPoll = lastPollCopy({ locale, elapsedSinceLastPollMs });
  return renderWakeCopy({ key: WakeCopyKey.ExpectedDelayNote, locale, values: { agent, cadence, lastPoll } });
}

export function staleNoticeCopy(input: { locale: OwnerLocale; agent: AgentName; elapsedSinceLastPollMs: number | null }): string {
  const { locale, agent, elapsedSinceLastPollMs } = input;
  const lastPoll = lastPollCopy({ locale, elapsedSinceLastPollMs });
  return renderWakeCopy({ key: WakeCopyKey.StaleNotice, locale, values: { agent, lastPoll } });
}
