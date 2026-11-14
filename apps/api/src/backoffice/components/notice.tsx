import type { WebLocale } from '@zapbip/types';
import { BackofficeCopyKey, renderBackofficeCopy } from '../backoffice-copy';
import { NoticeVariant } from '../backoffice-notice';

const VARIANT_LABELS: Record<NoticeVariant, BackofficeCopyKey> = {
  [NoticeVariant.Info]: BackofficeCopyKey.NoticeLabelInfo,
  [NoticeVariant.Success]: BackofficeCopyKey.NoticeLabelSuccess,
  [NoticeVariant.Warning]: BackofficeCopyKey.NoticeLabelWarning,
  [NoticeVariant.Error]: BackofficeCopyKey.NoticeLabelError,
};
const VARIANT_GLYPHS: Record<NoticeVariant, string> = {
  [NoticeVariant.Info]: 'ℹ',
  [NoticeVariant.Success]: '✓',
  [NoticeVariant.Warning]: '!',
  [NoticeVariant.Error]: '✕',
};
const ALERT_VARIANTS = [NoticeVariant.Warning, NoticeVariant.Error];

export function Notice(props: { variant: NoticeVariant; locale: WebLocale; message: string }) {
  const role = ALERT_VARIANTS.includes(props.variant) ? 'alert' : 'status';
  return (
    <div class={`notice notice-${props.variant}`} role={role}>
      <span class="notice-glyph" aria-hidden="true">
        {VARIANT_GLYPHS[props.variant]}
      </span>
      <strong>{renderBackofficeCopy({ key: VARIANT_LABELS[props.variant], locale: props.locale })}</strong>
      <p>{props.message}</p>
    </div>
  );
}
