import { CLIENT_APP_LOGIN_TEXT, OWNER_LOCALE_OF_WEB_LOCALE, type WebLocale } from '@zapbip/types';
import { docsUrlOf } from '../../web-shell/shell-links';
import type { ShellTheme } from '../../web-shell/shell-theme';
import { PHONE_MOCK_LINK_TEXT, PHONE_MOCK_TIME } from '../client-app-constants';
import { ClientAppCopyKey, copyOf } from '../client-app-copy';
import { ClientAppPath } from '../client-app-paths';
import { Layout } from './layout';

const GLYPH_VIEWBOX = '0 0 24 24';
const GLYPH_SIZE = 22;
const GLYPH_PATH = 'M4 20l1.4-4.2A8 8 0 1 1 8.2 18.6L4 20z';
const TRUST_KEYS = [ClientAppCopyKey.SignedOutTrustApi, ClientAppCopyKey.SignedOutTrustPassword, ClientAppCopyKey.SignedOutTrustLink];

function ChatGlyph() {
  return (
    <svg
      class="button-glyph"
      viewBox={GLYPH_VIEWBOX}
      width={GLYPH_SIZE}
      height={GLYPH_SIZE}
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d={GLYPH_PATH} />
    </svg>
  );
}

function PhoneMock(props: { locale: WebLocale }) {
  const { locale } = props;
  const translate = copyOf({ locale });
  return (
    <figure class="phone" aria-label={translate(ClientAppCopyKey.PhoneLabel)}>
      <div class="phone-screen">
        <div class="phone-bar">
          <span class="phone-avatar" aria-hidden="true"></span>
          <span class="phone-name">{translate(ClientAppCopyKey.BrandName)}</span>
        </div>
        <ol class="phone-chat">
          <li class="bubble bubble-outgoing">
            <p>{CLIENT_APP_LOGIN_TEXT[OWNER_LOCALE_OF_WEB_LOCALE[locale]]}</p>
            <span class="bubble-time">{PHONE_MOCK_TIME}</span>
          </li>
          <li class="typing" aria-hidden="true">
            <span></span>
            <span></span>
            <span></span>
          </li>
          <li class="bubble bubble-incoming">
            <p>{translate(ClientAppCopyKey.PhoneReply)}</p>
            <p class="bubble-link">{PHONE_MOCK_LINK_TEXT}</p>
            <span class="bubble-time">{PHONE_MOCK_TIME}</span>
          </li>
        </ol>
      </div>
    </figure>
  );
}

export function SignedOutPage(props: { locale: WebLocale; theme: ShellTheme; whatsappHref: string }) {
  const { locale } = props;
  const translate = copyOf({ locale });
  return (
    <Layout
      locale={locale}
      theme={props.theme}
      title={translate(ClientAppCopyKey.SignedOutTitle)}
      currentPath={ClientAppPath.Home}
      csrfToken={null}
      isWide
    >
      <div class="hero">
        <section class="hero-copy" aria-labelledby="sign-in-title">
          <p class="eyebrow">{translate(ClientAppCopyKey.SignedOutEyebrow)}</p>
          <h1 id="sign-in-title">{translate(ClientAppCopyKey.SignedOutTitle)}</h1>
          <p class="lead">{translate(ClientAppCopyKey.SignedOutLead)}</p>
          <a class="button button-primary button-large button-whatsapp" href={props.whatsappHref}>
            <ChatGlyph />
            {translate(ClientAppCopyKey.SignInWithWhatsapp)}
          </a>
          <p class="note">{translate(ClientAppCopyKey.SignedOutNote)}</p>
          <ul class="trust" aria-label={translate(ClientAppCopyKey.SignedOutTrustLabel)}>
            {TRUST_KEYS.map((key) => (
              <li>{translate(key)}</li>
            ))}
          </ul>
          <p class="agents-line">
            {translate(ClientAppCopyKey.SignedOutAgents)}.{' '}
            <a href={docsUrlOf({ locale, path: '' })}>{translate(ClientAppCopyKey.SignedOutAgentsLink)}</a>
          </p>
        </section>
        <PhoneMock locale={locale} />
      </div>
    </Layout>
  );
}
