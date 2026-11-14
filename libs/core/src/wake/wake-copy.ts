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
    [OwnerLocale.Spanish]:
      'No pude despertar al agente {agent}. Tu mensaje espera en la bandeja de entrada; pídele que vuelva a ejecutar set_wake.',
    [OwnerLocale.German]:
      'Ich konnte den Agenten {agent} nicht wecken. Deine Nachricht wartet im Posteingang; bitte ihn, set_wake erneut auszuführen.',
    [OwnerLocale.French]:
      'Je n’ai pas pu réveiller l’agent {agent}. Votre message attend dans la boîte de réception\u202f; demandez-lui de relancer set_wake.',
    [OwnerLocale.Japanese]:
      'エージェント{agent}を起動できませんでした。メッセージは受信箱で待機しています。もう一度set_wakeを実行するよう伝えてください。',
    [OwnerLocale.Korean]:
      '에이전트 {agent}을(를) 깨우지 못했어요. 메시지는 받은 편지함에서 기다려요. set_wake를 다시 실행하라고 요청해 주세요.',
    [OwnerLocale.ChineseSimplified]: '我没能唤醒智能体 {agent}。你的消息在收件箱里等候；请让它重新运行 set_wake。',
    [OwnerLocale.Arabic]: 'تعذّر عليّ إيقاظ الوكيل {agent}. رسالتك تنتظر في صندوق الوارد؛ اطلب منه تشغيل set_wake من جديد.',
  },
  [WakeCopyKey.ExpectedDelayNote]: {
    [OwnerLocale.PortugueseBrazil]: 'O agente {agent} confere o inbox {cadence}. {lastPoll} Sua mensagem espera lá até a próxima checagem.',
    [OwnerLocale.EnglishUs]: 'The agent {agent} checks the inbox {cadence}. {lastPoll} Your message waits there until the next check.',
    [OwnerLocale.Spanish]: 'El agente {agent} revisa la bandeja {cadence}. {lastPoll} Tu mensaje espera allí hasta la próxima revisión.',
    [OwnerLocale.German]:
      'Der Agent {agent} prüft den Posteingang {cadence}. {lastPoll} Deine Nachricht wartet dort bis zur nächsten Prüfung.',
    [OwnerLocale.French]:
      'L’agent {agent} consulte la boîte {cadence}. {lastPoll} Votre message y attend jusqu’à la prochaine consultation.',
    [OwnerLocale.Japanese]: 'エージェント{agent}は{cadence}受信箱を確認します。{lastPoll}メッセージは次の確認まで受信箱で待機します。',
    [OwnerLocale.Korean]:
      '에이전트 {agent}은(는) 받은 편지함을 {cadence} 확인해요. {lastPoll} 메시지는 다음 확인 때까지 그곳에서 기다려요.',
    [OwnerLocale.ChineseSimplified]: '智能体 {agent} {cadence}检查一次收件箱。{lastPoll}你的消息会在那里等到下一次检查。',
    [OwnerLocale.Arabic]: 'يفحص الوكيل {agent} صندوق الوارد {cadence}. {lastPoll} رسالتك تنتظر هناك حتى الفحص التالي.',
  },
  [WakeCopyKey.StaleNotice]: {
    [OwnerLocale.PortugueseBrazil]: '{agent} {lastPoll}: suas mensagens esperam',
    [OwnerLocale.EnglishUs]: '{agent} {lastPoll}: your messages wait',
    [OwnerLocale.Spanish]: '{agent} {lastPoll}: tus mensajes esperan',
    [OwnerLocale.German]: '{agent} {lastPoll}: deine Nachrichten warten',
    [OwnerLocale.French]: '{agent} {lastPoll}\u00a0: vos messages attendent',
    [OwnerLocale.Japanese]: '{agent}は{lastPoll}: メッセージは待機中です',
    [OwnerLocale.Korean]: '{agent}: {lastPoll}, 메시지가 대기 중이에요',
    [OwnerLocale.ChineseSimplified]: '{agent}{lastPoll}：你的消息在等候',
    [OwnerLocale.Arabic]: '{agent} {lastPoll}: رسائلك تنتظر',
  },
  [WakeCopyKey.CadenceHourly]: {
    [OwnerLocale.PortugueseBrazil]: 'de hora em hora',
    [OwnerLocale.EnglishUs]: 'every hour',
    [OwnerLocale.Spanish]: 'cada hora',
    [OwnerLocale.German]: 'jede Stunde',
    [OwnerLocale.French]: 'toutes les heures',
    [OwnerLocale.Japanese]: '1時間ごとに',
    [OwnerLocale.Korean]: '1시간마다',
    [OwnerLocale.ChineseSimplified]: '每小时',
    [OwnerLocale.Arabic]: 'كل ساعة',
  },
  [WakeCopyKey.CadenceHours]: {
    [OwnerLocale.PortugueseBrazil]: 'a cada {count} horas',
    [OwnerLocale.EnglishUs]: 'every {count} hours',
    [OwnerLocale.Spanish]: 'cada {count} horas',
    [OwnerLocale.German]: 'alle {count} Stunden',
    [OwnerLocale.French]: 'toutes les {count} heures',
    [OwnerLocale.Japanese]: '{count}時間ごとに',
    [OwnerLocale.Korean]: '{count}시간마다',
    [OwnerLocale.ChineseSimplified]: '每 {count} 小时',
    [OwnerLocale.Arabic]: 'كل {count} س',
  },
  [WakeCopyKey.CadenceMinute]: {
    [OwnerLocale.PortugueseBrazil]: 'a cada minuto',
    [OwnerLocale.EnglishUs]: 'every minute',
    [OwnerLocale.Spanish]: 'cada minuto',
    [OwnerLocale.German]: 'jede Minute',
    [OwnerLocale.French]: 'toutes les minutes',
    [OwnerLocale.Japanese]: '1分ごとに',
    [OwnerLocale.Korean]: '1분마다',
    [OwnerLocale.ChineseSimplified]: '每分钟',
    [OwnerLocale.Arabic]: 'كل دقيقة',
  },
  [WakeCopyKey.CadenceMinutes]: {
    [OwnerLocale.PortugueseBrazil]: 'a cada {count} minutos',
    [OwnerLocale.EnglishUs]: 'every {count} minutes',
    [OwnerLocale.Spanish]: 'cada {count} minutos',
    [OwnerLocale.German]: 'alle {count} Minuten',
    [OwnerLocale.French]: 'toutes les {count} minutes',
    [OwnerLocale.Japanese]: '{count}分ごとに',
    [OwnerLocale.Korean]: '{count}분마다',
    [OwnerLocale.ChineseSimplified]: '每 {count} 分钟',
    [OwnerLocale.Arabic]: 'كل {count} د',
  },
  [WakeCopyKey.ElapsedMinutes]: {
    [OwnerLocale.PortugueseBrazil]: 'Última checagem há {count} min.',
    [OwnerLocale.EnglishUs]: 'Last check {count} min ago.',
    [OwnerLocale.Spanish]: 'Última revisión hace {count} min.',
    [OwnerLocale.German]: 'Letzte Prüfung vor {count} Min.',
    [OwnerLocale.French]: 'Dernière consultation il y a {count} min.',
    [OwnerLocale.Japanese]: '最後の確認は{count}分前です。',
    [OwnerLocale.Korean]: '마지막 확인은 {count}분 전이에요.',
    [OwnerLocale.ChineseSimplified]: '上次检查是在 {count} 分钟前。',
    [OwnerLocale.Arabic]: 'آخر فحص كان قبل {count} د.',
  },
  [WakeCopyKey.ElapsedHours]: {
    [OwnerLocale.PortugueseBrazil]: 'Última checagem há {count} h.',
    [OwnerLocale.EnglishUs]: 'Last check {count} h ago.',
    [OwnerLocale.Spanish]: 'Última revisión hace {count} h.',
    [OwnerLocale.German]: 'Letzte Prüfung vor {count} Std.',
    [OwnerLocale.French]: 'Dernière consultation il y a {count} h.',
    [OwnerLocale.Japanese]: '最後の確認は{count}時間前です。',
    [OwnerLocale.Korean]: '마지막 확인은 {count}시간 전이에요.',
    [OwnerLocale.ChineseSimplified]: '上次检查是在 {count} 小时前。',
    [OwnerLocale.Arabic]: 'آخر فحص كان قبل {count} س.',
  },
  [WakeCopyKey.NeverPolled]: {
    [OwnerLocale.PortugueseBrazil]: 'Ainda não conferiu o inbox.',
    [OwnerLocale.EnglishUs]: 'It has not checked the inbox yet.',
    [OwnerLocale.Spanish]: 'Todavía no ha revisado la bandeja.',
    [OwnerLocale.German]: 'Er hat den Posteingang noch nicht geprüft.',
    [OwnerLocale.French]: 'Il n’a pas encore consulté la boîte.',
    [OwnerLocale.Japanese]: 'まだ受信箱を確認していません。',
    [OwnerLocale.Korean]: '아직 받은 편지함을 확인하지 않았어요.',
    [OwnerLocale.ChineseSimplified]: '它还没有检查过收件箱。',
    [OwnerLocale.Arabic]: 'لم يفحص صندوق الوارد بعد.',
  },
  [WakeCopyKey.StaleElapsedMinutes]: {
    [OwnerLocale.PortugueseBrazil]: 'não checa há {count} min',
    [OwnerLocale.EnglishUs]: "hasn't checked in {count} min",
    [OwnerLocale.Spanish]: 'no revisa desde hace {count} min',
    [OwnerLocale.German]: 'hat seit {count} Min. nicht geprüft',
    [OwnerLocale.French]: 'n’a pas consulté depuis {count} min',
    [OwnerLocale.Japanese]: '{count}分間確認していません',
    [OwnerLocale.Korean]: '{count}분째 확인하지 않음',
    [OwnerLocale.ChineseSimplified]: '已 {count} 分钟没有检查',
    [OwnerLocale.Arabic]: 'لم يفحص منذ {count} د',
  },
  [WakeCopyKey.StaleElapsedHours]: {
    [OwnerLocale.PortugueseBrazil]: 'não checa há {count} h',
    [OwnerLocale.EnglishUs]: "hasn't checked in {count} h",
    [OwnerLocale.Spanish]: 'no revisa desde hace {count} h',
    [OwnerLocale.German]: 'hat seit {count} Std. nicht geprüft',
    [OwnerLocale.French]: 'n’a pas consulté depuis {count} h',
    [OwnerLocale.Japanese]: '{count}時間確認していません',
    [OwnerLocale.Korean]: '{count}시간째 확인하지 않음',
    [OwnerLocale.ChineseSimplified]: '已 {count} 小时没有检查',
    [OwnerLocale.Arabic]: 'لم يفحص منذ {count} س',
  },
  [WakeCopyKey.StaleNeverPolled]: {
    [OwnerLocale.PortugueseBrazil]: 'ainda não checou',
    [OwnerLocale.EnglishUs]: "hasn't checked yet",
    [OwnerLocale.Spanish]: 'todavía no ha revisado',
    [OwnerLocale.German]: 'hat noch nicht geprüft',
    [OwnerLocale.French]: 'n’a pas encore consulté',
    [OwnerLocale.Japanese]: 'まだ確認していません',
    [OwnerLocale.Korean]: '아직 확인하지 않음',
    [OwnerLocale.ChineseSimplified]: '还没有检查过',
    [OwnerLocale.Arabic]: 'لم يفحص بعد',
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
