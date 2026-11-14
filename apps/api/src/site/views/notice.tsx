import type { OwnerLocale } from '@zapbip/types';
import { NoticeVariant } from '../../backoffice/backoffice-notice';
import { copyOf } from '../site-copy-text';
import { SiteCopyKey } from '../site-copy';

const VARIANT_LABELS: Record<NoticeVariant, SiteCopyKey> = {
  [NoticeVariant.Info]: SiteCopyKey.NoticeLabelInfo,
  [NoticeVariant.Success]: SiteCopyKey.NoticeLabelSuccess,
  [NoticeVariant.Warning]: SiteCopyKey.NoticeLabelWarning,
  [NoticeVariant.Error]: SiteCopyKey.NoticeLabelError,
};
const VARIANT_GLYPHS: Record<NoticeVariant, string> = {
  [NoticeVariant.Info]: 'ℹ',
  [NoticeVariant.Success]: '✓',
  [NoticeVariant.Warning]: '!',
  [NoticeVariant.Error]: '✕',
};
const ALERT_VARIANTS = [NoticeVariant.Warning, NoticeVariant.Error];

export function Notice(props: { variant: NoticeVariant; locale: OwnerLocale; title: string | null; message: string; id?: string }) {
  const translate = copyOf({ locale: props.locale });
  const role = ALERT_VARIANTS.includes(props.variant) ? 'alert' : 'status';
  return (
    <div class={`notice notice-${props.variant}`} role={role} id={props.id}>
      <span class="notice-glyph" aria-hidden="true">
        {VARIANT_GLYPHS[props.variant]}
      </span>
      <strong>{props.title === null ? translate(VARIANT_LABELS[props.variant]) : props.title}</strong>
      <p>{props.message}</p>
    </div>
  );
}
