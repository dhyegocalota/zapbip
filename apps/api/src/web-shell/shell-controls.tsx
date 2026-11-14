import type { OwnerLocale } from '@zapbip/types';
import { LanguageMenu } from './language-menu';
import type { ShellHiddenField } from './shell-fields';
import type { ShellTheme } from './shell-theme';
import { ThemeSwitch } from './theme-switch';

export type ShellControlsProps = {
  locale: OwnerLocale;
  theme: ShellTheme;
  localeAction: string;
  themeAction: string;
  hiddenFields: ShellHiddenField[];
  themeId?: string;
};

export function ShellControls(props: ShellControlsProps) {
  return (
    <>
      <LanguageMenu locale={props.locale} action={props.localeAction} hiddenFields={props.hiddenFields} />
      <ThemeSwitch
        locale={props.locale}
        theme={props.theme}
        action={props.themeAction}
        hiddenFields={props.hiddenFields}
        id={props.themeId}
      />
    </>
  );
}
