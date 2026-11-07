import { OwnerLocale } from '@zapbip/types';
import { BackofficeCopyKey, renderBackofficeCopy } from '../backoffice-copy';
import { BackofficePath } from '../backoffice-paths';

const LOCALE_OPTIONS: { locale: OwnerLocale; languageTag: string; label: BackofficeCopyKey }[] = [
  { locale: OwnerLocale.PortugueseBrazil, languageTag: 'pt-BR', label: BackofficeCopyKey.LocalePortuguese },
  { locale: OwnerLocale.EnglishUs, languageTag: 'en', label: BackofficeCopyKey.LocaleEnglish },
];

export function LocaleSwitch(props: { locale: OwnerLocale; csrfToken: string; returnTo: string }) {
  return (
    <form
      method="post"
      action={BackofficePath.Locale}
      class="locale-switch"
      aria-label={renderBackofficeCopy({ key: BackofficeCopyKey.LocaleLabel, locale: props.locale })}
    >
      <input type="hidden" name="csrf" value={props.csrfToken} />
      <input type="hidden" name="returnTo" value={props.returnTo} />
      {LOCALE_OPTIONS.map((option) => (
        <button
          type="submit"
          name="locale"
          value={option.locale}
          lang={option.languageTag}
          aria-pressed={String(option.locale === props.locale)}
          class="button button-secondary"
        >
          {renderBackofficeCopy({ key: option.label, locale: props.locale })}
        </button>
      ))}
    </form>
  );
}
