import type { WebLocale } from '@zapbip/types';
import { BackofficeCopyKey, renderBackofficeCopy } from '../backoffice-copy';
import { BackofficePath } from '../backoffice-paths';

export function SignOutButton(props: { locale: WebLocale; csrfToken: string }) {
  return (
    <form method="post" action={BackofficePath.SignOut}>
      <input type="hidden" name="csrf" value={props.csrfToken} />
      <button type="submit" class="button button-secondary">
        {renderBackofficeCopy({ key: BackofficeCopyKey.SignOut, locale: props.locale })}
      </button>
    </form>
  );
}
