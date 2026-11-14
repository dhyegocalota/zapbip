import { SITE_ORIGIN } from '@zapbip/types';
import type { CSSProperties } from 'react';
import { APPLE_TOUCH_ICON_PATH } from '../../src/site/site-paths';
import { TextDirection } from '../../src/web-shell/locale-profiles';

const BRAND_COLOR = '#128C7E';
const TEXT_COLOR = '#0E1F1A';
const MUTED_TEXT_COLOR = '#4B5E57';
const PAGE_COLOR = '#F6F8F5';
const CARD_COLOR = '#FFFFFF';
const RULE_COLOR = '#DCE5E0';
const ON_BRAND_COLOR = '#FFFFFF';

export const EMAIL_LOGO_URL = `${SITE_ORIGIN}${APPLE_TOUCH_ICON_PATH}`;
export const EMAIL_LOGO_SIZE = 48;

export const EMAIL_FONT_STACKS: Record<TextDirection, string> = {
  [TextDirection.LeftToRight]: "system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
  [TextDirection.RightToLeft]: "system-ui, -apple-system, 'Geeza Pro', 'Segoe UI', 'Noto Sans Arabic', Tahoma, sans-serif",
};

export const BODY_STYLE: CSSProperties = { backgroundColor: PAGE_COLOR, color: TEXT_COLOR, margin: 0, padding: '24px 12px' };
export const CARD_STYLE: CSSProperties = {
  backgroundColor: CARD_COLOR,
  border: `1px solid ${RULE_COLOR}`,
  borderRadius: '16px',
  maxWidth: '560px',
  padding: '32px',
};
export const LOGO_STYLE: CSSProperties = { borderRadius: '12px' };
export const HEADING_STYLE: CSSProperties = { color: TEXT_COLOR, fontSize: '24px', lineHeight: '32px', margin: '24px 0 16px' };
export const SUBHEADING_STYLE: CSSProperties = { color: TEXT_COLOR, fontSize: '17px', lineHeight: '24px', margin: '24px 0 8px' };
export const PARAGRAPH_STYLE: CSSProperties = { color: TEXT_COLOR, fontSize: '16px', lineHeight: '24px', margin: '0 0 16px' };
export const LINE_STYLE: CSSProperties = { color: TEXT_COLOR, fontSize: '15px', lineHeight: '22px', margin: '0 0 4px' };
export const ACTION_STYLE: CSSProperties = { margin: '8px 0 24px' };
export const BUTTON_STYLE: CSSProperties = {
  backgroundColor: BRAND_COLOR,
  borderRadius: '999px',
  color: ON_BRAND_COLOR,
  fontSize: '16px',
  fontWeight: 600,
  padding: '12px 24px',
  textDecoration: 'none',
};
export const LINK_STYLE: CSSProperties = { color: BRAND_COLOR, fontWeight: 600 };
export const RULE_STYLE: CSSProperties = { borderColor: RULE_COLOR, margin: '24px 0' };
export const FOOTER_STYLE: CSSProperties = { color: MUTED_TEXT_COLOR, fontSize: '13px', lineHeight: '20px', margin: 0 };
