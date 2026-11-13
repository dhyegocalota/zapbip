import { OwnerLocale } from '@zapbip/types';

export enum ShellCopyKey {
  LocaleLabel = 'locale_label',
  ThemeLabel = 'theme_label',
  ThemeLight = 'theme_light',
  ThemeDark = 'theme_dark',
  ThemeSystem = 'theme_system',
  FooterLinksLabel = 'footer_links_label',
  FooterDocs = 'footer_docs',
  FooterTerms = 'footer_terms',
  FooterPrivacy = 'footer_privacy',
  FooterMadeBy = 'footer_made_by',
  FooterSupport = 'footer_support',
}

const SHELL_COPY: Record<OwnerLocale, Record<ShellCopyKey, string>> = {
  [OwnerLocale.EnglishUs]: {
    [ShellCopyKey.LocaleLabel]: 'Language',
    [ShellCopyKey.ThemeLabel]: 'Theme',
    [ShellCopyKey.ThemeLight]: 'Light',
    [ShellCopyKey.ThemeDark]: 'Dark',
    [ShellCopyKey.ThemeSystem]: 'System',
    [ShellCopyKey.FooterLinksLabel]: 'More about zapbip',
    [ShellCopyKey.FooterDocs]: 'Documentation',
    [ShellCopyKey.FooterTerms]: 'Terms of use',
    [ShellCopyKey.FooterPrivacy]: 'Privacy policy',
    [ShellCopyKey.FooterMadeBy]: 'Made by Logic Bit',
    [ShellCopyKey.FooterSupport]: 'Support',
  },
  [OwnerLocale.PortugueseBrazil]: {
    [ShellCopyKey.LocaleLabel]: 'Idioma',
    [ShellCopyKey.ThemeLabel]: 'Tema',
    [ShellCopyKey.ThemeLight]: 'Claro',
    [ShellCopyKey.ThemeDark]: 'Escuro',
    [ShellCopyKey.ThemeSystem]: 'Sistema',
    [ShellCopyKey.FooterLinksLabel]: 'Mais sobre o zapbip',
    [ShellCopyKey.FooterDocs]: 'Documentação',
    [ShellCopyKey.FooterTerms]: 'Termos de uso',
    [ShellCopyKey.FooterPrivacy]: 'Política de privacidade',
    [ShellCopyKey.FooterMadeBy]: 'Feito pela Logic Bit',
    [ShellCopyKey.FooterSupport]: 'Suporte',
  },
};

export function renderShellCopy(input: { key: ShellCopyKey; locale: OwnerLocale }): string {
  return SHELL_COPY[input.locale][input.key];
}
