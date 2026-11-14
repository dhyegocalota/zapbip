import { Body, Container, Head, Hr, Html, Img, Preview, Text } from '@react-email/components';
import type { OwnerLocale } from '@zapbip/types';
import { createElement, type PropsWithChildren, type ReactElement } from 'react';
import { LOCALE_PROFILES } from '../../src/web-shell/locale-profiles';
import { EMAIL_BRAND_NAME } from '../../src/emails/email-constants';
import {
  BODY_STYLE,
  CARD_STYLE,
  EMAIL_FONT_STACKS,
  EMAIL_LOGO_SIZE,
  EMAIL_LOGO_URL,
  FOOTER_STYLE,
  LOGO_STYLE,
  RULE_STYLE,
} from './email-style';

const COLOR_SCHEME = 'light';

export type EmailLayoutProps = PropsWithChildren<{ locale: OwnerLocale; title: string; preview: string; footer: string }>;

export function EmailLayout(props: EmailLayoutProps): ReactElement {
  const { languageTag, textDirection } = LOCALE_PROFILES[props.locale];
  return createElement(
    Html,
    { lang: languageTag, dir: textDirection },
    createElement(
      Head,
      null,
      createElement('title', null, props.title),
      createElement('meta', { name: 'color-scheme', content: COLOR_SCHEME }),
      createElement('meta', { name: 'supported-color-schemes', content: COLOR_SCHEME }),
    ),
    createElement(Preview, null, props.preview),
    createElement(
      Body,
      { style: { ...BODY_STYLE, fontFamily: EMAIL_FONT_STACKS[textDirection] } },
      createElement(
        Container,
        { style: CARD_STYLE },
        createElement(Img, {
          src: EMAIL_LOGO_URL,
          width: EMAIL_LOGO_SIZE,
          height: EMAIL_LOGO_SIZE,
          alt: EMAIL_BRAND_NAME,
          style: LOGO_STYLE,
        }),
        props.children,
        createElement(Hr, { style: RULE_STYLE }),
        createElement(Text, { style: FOOTER_STYLE }, props.footer),
      ),
    ),
  );
}
