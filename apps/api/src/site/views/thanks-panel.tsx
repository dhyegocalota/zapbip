import type { WebLocale } from '@zapbip/types';
import { SiteCopyKey } from '../site-copy';
import { copyOf } from '../site-copy-text';

const SUCCESS_MARK = '✓';

export function ThanksPanel(props: { locale: WebLocale }) {
  const translate = copyOf({ locale: props.locale });
  return (
    <div class="thanks hero-card" role="status">
      <div class="thanks-head">
        <span class="thanks-mark" aria-hidden="true">
          {SUCCESS_MARK}
        </span>
        <h2 id="thanks-title" tabindex={-1}>
          {translate(SiteCopyKey.ThanksTitle)}
        </h2>
      </div>
      <p>{translate(SiteCopyKey.ThanksBody)}</p>
    </div>
  );
}
