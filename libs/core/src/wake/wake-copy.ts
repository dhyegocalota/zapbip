import { HOUR_MS, MINUTE_MS, OwnerLocale, WakeCopyKey } from '@zapbip/types';
import type { AgentName } from '../inbox/connection';
import { fillCopyTokens } from '../inbox/inbox-copy';
import { invalidInput } from '../inbox/inbox-error-factories';
import { SCHEDULED_MIN_INTERVAL_MINUTES } from './constants';

const MINUTES_PER_HOUR = HOUR_MS / MINUTE_MS;

export const WAKE_COPY: Record<WakeCopyKey, Record<OwnerLocale, string>> = {
  [WakeCopyKey.WakeFailed]: {
    [OwnerLocale.PortugueseBrazil]:
      'Não consegui acordar o agente {agent}. Sua mensagem espera no inbox; peça a ele para rodar set_wake de novo.',
    [OwnerLocale.EnglishUs]: 'I could not wake the agent {agent}. Your message waits in the inbox; ask it to run set_wake again.',
  },
  [WakeCopyKey.ExpectedDelayNote]: {
    [OwnerLocale.PortugueseBrazil]: 'O agente {agent} olha a caixa {cadence}. {lastPoll} Sua mensagem espera lá até a próxima olhada.',
    [OwnerLocale.EnglishUs]: 'The agent {agent} checks the inbox {cadence}. {lastPoll} Your message waits there until the next check.',
  },
  [WakeCopyKey.StaleNotice]: {
    [OwnerLocale.PortugueseBrazil]: '{agent} {lastPoll}: suas mensagens esperam',
    [OwnerLocale.EnglishUs]: '{agent} {lastPoll}: your messages wait',
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
  [WakeCopyKey.StaleElapsedMinutes]: {
    [OwnerLocale.PortugueseBrazil]: 'não checa há {count} min',
    [OwnerLocale.EnglishUs]: "hasn't checked in {count} min",
  },
  [WakeCopyKey.StaleElapsedHours]: {
    [OwnerLocale.PortugueseBrazil]: 'não checa há {count} h',
    [OwnerLocale.EnglishUs]: "hasn't checked in {count} h",
  },
  [WakeCopyKey.StaleNeverPolled]: {
    [OwnerLocale.PortugueseBrazil]: 'ainda não checou',
    [OwnerLocale.EnglishUs]: "hasn't checked yet",
  },
};

type ElapsedCopyKeys = { never: WakeCopyKey; minutes: WakeCopyKey; hours: WakeCopyKey };

const LAST_POLL_COPY_KEYS: ElapsedCopyKeys = {
  never: WakeCopyKey.NeverPolled,
  minutes: WakeCopyKey.ElapsedMinutes,
  hours: WakeCopyKey.ElapsedHours,
};

const STALE_COPY_KEYS: ElapsedCopyKeys = {
  never: WakeCopyKey.StaleNeverPolled,
  minutes: WakeCopyKey.StaleElapsedMinutes,
  hours: WakeCopyKey.StaleElapsedHours,
};

function renderWakeCopy(input: { key: WakeCopyKey; locale: OwnerLocale; values: Record<string, string> }): string {
  const text = WAKE_COPY[input.key][input.locale];
  if (text === undefined) throw invalidInput({ message: 'wake: unknown locale' });
  return fillCopyTokens({ text, values: input.values });
}

export function wakeFailedCopy(input: { locale: OwnerLocale; agent: AgentName }): string {
  return renderWakeCopy({ key: WakeCopyKey.WakeFailed, locale: input.locale, values: { agent: input.agent } });
}

function cadenceCopy(input: { locale: OwnerLocale; intervalMinutes: number }): string {
  const { locale, intervalMinutes } = input;
  if (intervalMinutes === MINUTES_PER_HOUR) return renderWakeCopy({ key: WakeCopyKey.CadenceHourly, locale, values: {} });
  if (intervalMinutes % MINUTES_PER_HOUR === 0) {
    const count = String(intervalMinutes / MINUTES_PER_HOUR);
    return renderWakeCopy({ key: WakeCopyKey.CadenceHours, locale, values: { count } });
  }
  if (intervalMinutes === SCHEDULED_MIN_INTERVAL_MINUTES) return renderWakeCopy({ key: WakeCopyKey.CadenceMinute, locale, values: {} });
  return renderWakeCopy({ key: WakeCopyKey.CadenceMinutes, locale, values: { count: String(intervalMinutes) } });
}

function elapsedCopy(input: { locale: OwnerLocale; elapsedSinceLastPollMs: number | null; keys: ElapsedCopyKeys }): string {
  const { locale, elapsedSinceLastPollMs, keys } = input;
  if (elapsedSinceLastPollMs === null) return renderWakeCopy({ key: keys.never, locale, values: {} });
  if (elapsedSinceLastPollMs < HOUR_MS) {
    const count = String(Math.floor(elapsedSinceLastPollMs / MINUTE_MS));
    return renderWakeCopy({ key: keys.minutes, locale, values: { count } });
  }
  const count = String(Math.floor(elapsedSinceLastPollMs / HOUR_MS));
  return renderWakeCopy({ key: keys.hours, locale, values: { count } });
}

export function expectedDelayNoteCopy(input: {
  locale: OwnerLocale;
  agent: AgentName;
  intervalMinutes: number;
  elapsedSinceLastPollMs: number | null;
}): string {
  const { locale, agent, intervalMinutes, elapsedSinceLastPollMs } = input;
  const cadence = cadenceCopy({ locale, intervalMinutes });
  const lastPoll = elapsedCopy({ locale, elapsedSinceLastPollMs, keys: LAST_POLL_COPY_KEYS });
  return renderWakeCopy({ key: WakeCopyKey.ExpectedDelayNote, locale, values: { agent, cadence, lastPoll } });
}

export function staleNoticeCopy(input: { locale: OwnerLocale; agent: AgentName; elapsedSinceLastPollMs: number | null }): string {
  const { locale, agent, elapsedSinceLastPollMs } = input;
  const lastPoll = elapsedCopy({ locale, elapsedSinceLastPollMs, keys: STALE_COPY_KEYS });
  return renderWakeCopy({ key: WakeCopyKey.StaleNotice, locale, values: { agent, lastPoll } });
}
