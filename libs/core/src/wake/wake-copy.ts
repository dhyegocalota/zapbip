import { OwnerLocale, WakeCopyKey } from '@zapbip/types';
import { invalidInput } from '../inbox/inbox-error-factories';

export const WAKE_COPY: Record<WakeCopyKey, Record<OwnerLocale, string>> = {
  [WakeCopyKey.WakeFailed]: {
    [OwnerLocale.PortugueseBrazil]:
      'Não consegui acordar seu agente. Sua mensagem espera no inbox; peça a ele para rodar set_wake de novo.',
    [OwnerLocale.EnglishUs]: 'I could not wake your agent. Your message waits in the inbox; ask it to run set_wake again.',
  },
};

export function wakeFailedCopy(input: { locale: OwnerLocale }): string {
  const text = WAKE_COPY[WakeCopyKey.WakeFailed][input.locale];
  if (text === undefined) throw invalidInput({ message: 'wake: unknown locale' });
  return text;
}
