import { type OwnerLocale, WhatsAppNumberState } from '@zapbip/types';
import { BackofficeCopyKey, renderBackofficeCopy } from '../../backoffice-copy';

const STATE_LABELS: Record<WhatsAppNumberState, BackofficeCopyKey> = {
  [WhatsAppNumberState.Pending]: BackofficeCopyKey.StatePending,
  [WhatsAppNumberState.Active]: BackofficeCopyKey.StateActive,
  [WhatsAppNumberState.Closed]: BackofficeCopyKey.StateClosed,
  [WhatsAppNumberState.Disabled]: BackofficeCopyKey.StateDisabled,
};
const GLYPH_SEPARATOR = ' ';
const STATE_GLYPHS: Record<WhatsAppNumberState, string> = {
  [WhatsAppNumberState.Pending]: '○',
  [WhatsAppNumberState.Active]: '✓',
  [WhatsAppNumberState.Closed]: '◐',
  [WhatsAppNumberState.Disabled]: '✕',
};

export function StateBadge(props: { locale: OwnerLocale; state: WhatsAppNumberState }) {
  return (
    <span class={`state-badge state-${props.state}`}>
      <span aria-hidden="true">{STATE_GLYPHS[props.state]}</span>
      {GLYPH_SEPARATOR}
      {renderBackofficeCopy({ key: STATE_LABELS[props.state], locale: props.locale })}
    </span>
  );
}
