import type { OwnerLocale } from '@zapbip/types';
import { BackofficeCopyKey, renderBackofficeCopy } from '../backoffice-copy';
import { BackofficePath } from '../backoffice-paths';
import { BackofficeTheme } from '../backoffice-theme';
import { MonitorIcon, MoonIcon, SunIcon } from './icons';

const THEME_OPTIONS: { theme: BackofficeTheme; label: BackofficeCopyKey; Icon: typeof SunIcon }[] = [
  { theme: BackofficeTheme.Light, label: BackofficeCopyKey.ThemeLight, Icon: SunIcon },
  { theme: BackofficeTheme.Dark, label: BackofficeCopyKey.ThemeDark, Icon: MoonIcon },
  { theme: BackofficeTheme.System, label: BackofficeCopyKey.ThemeSystem, Icon: MonitorIcon },
];

export function ThemeSwitch(props: { locale: OwnerLocale; theme: BackofficeTheme; csrfToken: string; returnTo: string }) {
  return (
    <form
      method="post"
      action={BackofficePath.Theme}
      class="theme-switch"
      aria-label={renderBackofficeCopy({ key: BackofficeCopyKey.ThemeLabel, locale: props.locale })}
    >
      <input type="hidden" name="csrf" value={props.csrfToken} />
      <input type="hidden" name="returnTo" value={props.returnTo} />
      {THEME_OPTIONS.map((option) => {
        const label = renderBackofficeCopy({ key: option.label, locale: props.locale });
        return (
          <button
            type="submit"
            name="theme"
            value={option.theme}
            aria-label={label}
            title={label}
            aria-pressed={String(option.theme === props.theme)}
            class="button button-secondary"
          >
            <option.Icon />
          </button>
        );
      })}
    </form>
  );
}
