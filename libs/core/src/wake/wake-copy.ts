import { OwnerLocale, WakeCopyKey } from '@zapbip/types';
import { invalidInput } from '../inbox/inbox-error-factories';

const AGENT_TOKEN = '{agent}';

export const WAKE_COPY: Record<WakeCopyKey, Record<OwnerLocale, string>> = {
  [WakeCopyKey.WakeFailed]: {
    [OwnerLocale.PortugueseBrazil]:
      'Não consegui acordar o agente {agent}. Sua mensagem espera no inbox; peça a ele para rodar set_wake de novo.',
    [OwnerLocale.EnglishUs]: 'I could not wake the agent {agent}. Your message waits in the inbox; ask it to run set_wake again.',
  },
};

export function wakeFailedCopy(input: { locale: OwnerLocale; agent: string }): string {
  const text = WAKE_COPY[WakeCopyKey.WakeFailed][input.locale];
  if (text === undefined) throw invalidInput({ message: 'wake: unknown locale' });
  return text.replace(AGENT_TOKEN, input.agent);
}
