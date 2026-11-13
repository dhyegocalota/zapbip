import { OwnerLocale } from '@zapbip/types';
import { SiteCopyKey } from '../site-copy';
import { copyOf } from '../site-copy-text';
import type { PageModel } from '../page-model';
import { languageOf, pagePathOf } from '../site-links';
import { SitePath } from '../site-paths';
import { Flag } from './flags';

const OPTIONS: { locale: OwnerLocale; short: SiteCopyKey; full: SiteCopyKey }[] = [
  { locale: OwnerLocale.EnglishUs, short: SiteCopyKey.LocaleEnglishShort, full: SiteCopyKey.LocaleEnglish },
  { locale: OwnerLocale.PortugueseBrazil, short: SiteCopyKey.LocalePortugueseShort, full: SiteCopyKey.LocalePortuguese },
];

export function LanguageMenu(props: { model: PageModel }) {
  const { model } = props;
  const translate = copyOf({ locale: model.locale });
  const current = OPTIONS.find((option) => option.locale === model.locale)!;
  return (
    <details class="lang-menu">
      <summary class="lang-trigger" aria-label={`${translate(SiteCopyKey.LocaleLabel)}: ${translate(current.short)}`}>
        <Flag locale={model.locale} />
        <span class="lang-code">{translate(current.short)}</span>
      </summary>
      <form class="lang-list" method="post" action={SitePath.Locale}>
        <input
          type="hidden"
          name="returnTo"
          value={pagePathOf({ locale: model.locale, agent: model.agentParameter, referralCode: model.referralCode })}
        />
        {OPTIONS.map((option) => (
          <button
            type="submit"
            name="locale"
            value={option.locale}
            lang={languageOf({ locale: option.locale })}
            class="lang-option"
            aria-current={option.locale === model.locale ? 'true' : undefined}
          >
            <Flag locale={option.locale} />
            <span>{translate(option.full)}</span>
          </button>
        ))}
      </form>
    </details>
  );
}
