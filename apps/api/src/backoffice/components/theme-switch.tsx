import type { OwnerLocale } from '@zapbip/types';
import type { BackofficeTheme } from '../backoffice-theme';

export function ThemeSwitch(props: { locale: OwnerLocale; theme: BackofficeTheme; csrfToken: string; returnTo: string }) {
  throw new Error(`ThemeSwitch is not implemented for ${props.returnTo}`);
}
