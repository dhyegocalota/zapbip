import type { OwnerLocale } from '@zapbip/types';
import { Flag } from './flags';
import { LOCALE_PROFILES, MENU_LOCALES, languageOf } from './locale-profiles';
import { ShellCopyKey, renderShellCopy } from './shell-copy';
import type { ShellHiddenField } from './shell-fields';

export function LanguageMenu(props: { locale: OwnerLocale; action: string; hiddenFields: ShellHiddenField[] }) {
  const { locale } = props;
  const label = renderShellCopy({ key: ShellCopyKey.LocaleLabel, locale });
  return (
    <details class="lang-menu">
      <summary class="lang-trigger" aria-label={`${label}: ${LOCALE_PROFILES[locale].shortName}`}>
        <Flag locale={locale} />
        <span class="lang-code">{LOCALE_PROFILES[locale].shortName}</span>
      </summary>
      <form class="lang-list" method="post" action={props.action}>
        {props.hiddenFields.map((field) => (
          <input type="hidden" name={field.name} value={field.value} />
        ))}
        {MENU_LOCALES.map((option) => (
          <button
            type="submit"
            name="locale"
            value={option}
            lang={languageOf({ locale: option })}
            class="lang-option"
            aria-current={option === locale ? 'true' : undefined}
          >
            <Flag locale={option} />
            <span>{LOCALE_PROFILES[option].nativeName}</span>
          </button>
        ))}
      </form>
    </details>
  );
}
