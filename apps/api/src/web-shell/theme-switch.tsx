import type { WebLocale } from '@zapbip/types';
import { ShellCopyKey, renderShellCopy } from './shell-copy';
import type { ShellHiddenField } from './shell-fields';
import { ShellTheme } from './shell-theme';
import { ThemeIcon } from './theme-icons';

const THEME_OPTIONS: { theme: ShellTheme; label: ShellCopyKey }[] = [
  { theme: ShellTheme.Light, label: ShellCopyKey.ThemeLight },
  { theme: ShellTheme.Dark, label: ShellCopyKey.ThemeDark },
  { theme: ShellTheme.System, label: ShellCopyKey.ThemeSystem },
];

export function ThemeSwitch(props: {
  locale: WebLocale;
  theme: ShellTheme;
  action: string;
  hiddenFields: ShellHiddenField[];
  id?: string;
}) {
  const { locale } = props;
  return (
    <form
      method="post"
      action={props.action}
      class="switch"
      id={props.id}
      aria-label={renderShellCopy({ key: ShellCopyKey.ThemeLabel, locale })}
    >
      {props.hiddenFields.map((field) => (
        <input type="hidden" name={field.name} value={field.value} />
      ))}
      {THEME_OPTIONS.map((option) => {
        const label = renderShellCopy({ key: option.label, locale });
        return (
          <button
            type="submit"
            name="theme"
            value={option.theme}
            aria-pressed={String(option.theme === props.theme)}
            aria-label={label}
            title={label}
          >
            <ThemeIcon theme={option.theme} />
          </button>
        );
      })}
    </form>
  );
}
