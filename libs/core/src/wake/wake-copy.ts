import { OwnerLocale, WakeCopyKey } from '@zapbip/types';

export const WAKE_COPY: Record<WakeCopyKey, Record<OwnerLocale, string>> = {
  [WakeCopyKey.WakeFailed]: {
    [OwnerLocale.PortugueseBrazil]: 'Não consegui acordar seu agente. Sua mensagem espera no inbox; configure o wake de novo.',
    [OwnerLocale.EnglishUs]: 'I could not wake your agent. Your message waits in the inbox; set the wake again.',
  },
};

export function wakeFailedCopy(input: { locale: OwnerLocale }): string {
  void input;
  throw new Error('wakeFailedCopy is not implemented');
}
