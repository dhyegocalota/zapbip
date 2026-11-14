import { WHATSAPP_LINK_ORIGIN, WHATSAPP_LINK_TEXT_PARAMETER, type WebLocale } from '@zapbip/types';
import { INVITE_METER_GAP, INVITE_METER_SEGMENT_LIMIT, INVITE_METER_VIEWBOX_HEIGHT, INVITE_METER_VIEWBOX_WIDTH } from '../site-constants';
import { SiteCopyKey } from '../site-copy';
import { copyOf } from '../site-copy-text';
import { pagePathOf } from '../site-links';

const FULL_PERCENT = 100;
const SUCCESS_MARK = '✓';
const COPY_GLYPH = '⧉';
const BAR_RADIUS = INVITE_METER_VIEWBOX_HEIGHT / 2;

function InviteMeter(props: { creditedCount: number; cap: number }) {
  const { creditedCount, cap } = props;
  const isSegmented = cap <= INVITE_METER_SEGMENT_LIMIT;
  const segmentWidth = (INVITE_METER_VIEWBOX_WIDTH - INVITE_METER_GAP * (cap - 1)) / cap;
  const fillWidth = (Math.min(creditedCount, cap) / cap) * FULL_PERCENT;
  return (
    <svg
      class="invite-meter"
      viewBox={`0 0 ${INVITE_METER_VIEWBOX_WIDTH} ${INVITE_METER_VIEWBOX_HEIGHT}`}
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      {isSegmented ? (
        Array.from({ length: cap }, (_, index) => (
          <rect
            class={index < creditedCount ? 'filled' : 'empty'}
            x={index * (segmentWidth + INVITE_METER_GAP)}
            y="0"
            width={segmentWidth}
            height={INVITE_METER_VIEWBOX_HEIGHT}
            rx={BAR_RADIUS}
          />
        ))
      ) : (
        <>
          <rect class="empty" x="0" y="0" width={INVITE_METER_VIEWBOX_WIDTH} height={INVITE_METER_VIEWBOX_HEIGHT} rx={BAR_RADIUS} />
          <rect class="filled" x="0" y="0" width={fillWidth} height={INVITE_METER_VIEWBOX_HEIGHT} rx={BAR_RADIUS} />
        </>
      )}
    </svg>
  );
}

export function ReferralThanksPanel(props: {
  locale: WebLocale;
  siteOrigin: string;
  referralCode: string;
  creditedCount: number;
  cap: number;
}) {
  const { locale, siteOrigin, referralCode, creditedCount, cap } = props;
  const translate = copyOf({ locale });
  const inviteLink = `${siteOrigin}${pagePathOf({ locale, agent: null, referralCode })}`;
  const shareText = translate(SiteCopyKey.ThanksShareText, { link: inviteLink });
  const shareHref = `${WHATSAPP_LINK_ORIGIN}/?${WHATSAPP_LINK_TEXT_PARAMETER}=${encodeURIComponent(shareText)}`;
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
      <p>{translate(SiteCopyKey.ThanksReferralBody)}</p>
      <label for="invite-link">{translate(SiteCopyKey.ThanksLinkLabel)}</label>
      <input id="invite-link" readonly value={inviteLink} />
      <div class="thanks-actions">
        <button
          class="button button-primary copy-link"
          type="button"
          data-copied-label={translate(SiteCopyKey.ThanksCopied)}
          data-copied-announcement={translate(SiteCopyKey.ThanksCopiedAnnouncement)}
          data-fallback-announcement={translate(SiteCopyKey.ThanksCopyFallback)}
        >
          <span aria-hidden="true">{COPY_GLYPH}</span>
          <span data-label>{translate(SiteCopyKey.ThanksCopy)}</span>
        </button>
        <a class="button button-secondary" href={shareHref} target="_blank" rel="noopener">
          {translate(SiteCopyKey.ThanksShareWhatsApp)}
        </a>
      </div>
      <span class="visually-hidden" id="copy-announcement" aria-live="polite" />
      <InviteMeter creditedCount={creditedCount} cap={cap} />
      <p class="invite-count">{translate(SiteCopyKey.ThanksInviteCount, { count: String(creditedCount), cap: String(cap) })}</p>
      {creditedCount >= cap ? <p class="cap-reached">{translate(SiteCopyKey.ThanksCapReached)}</p> : null}
    </div>
  );
}
