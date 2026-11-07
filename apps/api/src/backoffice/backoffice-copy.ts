import { OwnerLocale } from '@zapbip/types';

export enum BackofficeCopyKey {
  SkipToContent = 'skip_to_content',
  NumbersView = 'numbers_view',
}

export const BACKOFFICE_COPY: Record<OwnerLocale, Record<BackofficeCopyKey, string>> = {
  [OwnerLocale.PortugueseBrazil]: {
    [BackofficeCopyKey.SkipToContent]: 'Ir para o conteúdo',
    [BackofficeCopyKey.NumbersView]: 'Ver {label}',
  },
  [OwnerLocale.EnglishUs]: { [BackofficeCopyKey.SkipToContent]: 'Skip to content', [BackofficeCopyKey.NumbersView]: 'View {label}' },
};

export function renderBackofficeCopy(_input: { key: BackofficeCopyKey; locale: OwnerLocale; values?: Record<string, string> }): string {
  throw new Error('renderBackofficeCopy is not implemented');
}
