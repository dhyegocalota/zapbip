import type { WebLocale } from '@zapbip/types';
import { SiteCopyKey } from '../site-copy';
import { copyOf } from '../site-copy-text';
import { SENDER_INDEXES, senderNameOf } from '../site-agents';

const LIST_GLYPH = '☰';
const FILE_GLYPH = '▤';
const VOICE_NOTE = '▶ ▂▅▃▆▂▇▃▅▂ 0:07';

export function CapabilitiesSection(props: { locale: WebLocale }) {
  const translate = copyOf({ locale: props.locale });
  const sender = (index: number): string => senderNameOf({ index });
  return (
    <section class="block" id="capabilities" aria-labelledby="capabilities-title">
      <div class="container">
        <p class="eyebrow reveal">{translate(SiteCopyKey.CapabilitiesEyebrow)}</p>
        <h2 class="section-title reveal" id="capabilities-title">
          {translate(SiteCopyKey.CapabilitiesTitle)}
        </h2>
        <p class="lead reveal">{translate(SiteCopyKey.CapabilitiesLead)}</p>
        <div class="card-grid">
          <article class="card reveal">
            <h3>{translate(SiteCopyKey.CapabilityButtonsTitle)}</h3>
            <p>{translate(SiteCopyKey.CapabilityButtonsBody)}</p>
            <div class="mini-chat" aria-hidden="true">
              <span class="in">
                <span class="name">{sender(SENDER_INDEXES.second)}</span>
                {translate(SiteCopyKey.CapabilityButtonsChatQuestion)}
              </span>
              <span class="pill">{translate(SiteCopyKey.CapabilityButtonsChatYes)}</span>
              <span class="pill">{translate(SiteCopyKey.CapabilityButtonsChatNo)}</span>
            </div>
          </article>
          <article class="card reveal">
            <h3>{translate(SiteCopyKey.CapabilityListTitle)}</h3>
            <p>{translate(SiteCopyKey.CapabilityListBody)}</p>
            <div class="mini-chat" aria-hidden="true">
              <span class="in">
                <span class="name">{sender(SENDER_INDEXES.first)}</span>
                {translate(SiteCopyKey.CapabilityListChatQuestion)}
              </span>
              <span class="pill">
                {LIST_GLYPH} {translate(SiteCopyKey.CapabilityListChatButton)}
              </span>
              <span class="divider">{translate(SiteCopyKey.CapabilityListChatRows)}</span>
            </div>
          </article>
          <article class="card reveal">
            <h3>{translate(SiteCopyKey.CapabilityMediaTitle)}</h3>
            <p>{translate(SiteCopyKey.CapabilityMediaBody)}</p>
            <div class="mini-chat" aria-hidden="true">
              <span class="in">
                <span class="name">{sender(SENDER_INDEXES.third)}</span>
                <span class="file">
                  {FILE_GLYPH} {translate(SiteCopyKey.CapabilityMediaChatFile)}
                </span>
                {translate(SiteCopyKey.CapabilityMediaChatText)}
              </span>
              <span class="out">{VOICE_NOTE}</span>
            </div>
          </article>
          <article class="card reveal">
            <h3>{translate(SiteCopyKey.CapabilityWakeTitle)}</h3>
            <p>{translate(SiteCopyKey.CapabilityWakeBody)}</p>
            <div class="mini-chat" aria-hidden="true">
              <span class="out">{translate(SiteCopyKey.CapabilityWakeChatYou)}</span>
              <span class="chip">{translate(SiteCopyKey.CapabilityWakeChatChip)}</span>
              <span class="in">
                <span class="name">{sender(SENDER_INDEXES.first)}</span>
                {translate(SiteCopyKey.CapabilityWakeChatAgent)}
              </span>
            </div>
          </article>
          <article class="card reveal">
            <h3>{translate(SiteCopyKey.CapabilityRoutingTitle)}</h3>
            <p>{translate(SiteCopyKey.CapabilityRoutingBody)}</p>
            <div class="mini-chat" aria-hidden="true">
              <span class="in">
                <span class="name">{sender(SENDER_INDEXES.first)}</span>
                {translate(SiteCopyKey.CapabilityRoutingChatFirst)}
              </span>
              <span class="in">
                <span class="name">{sender(SENDER_INDEXES.second)}</span>
                {translate(SiteCopyKey.CapabilityRoutingChatSecond)}
              </span>
              <span class="out">{translate(SiteCopyKey.CapabilityRoutingChatReply)}</span>
            </div>
          </article>
          <article class="card reveal">
            <h3>{translate(SiteCopyKey.CapabilityWaitTitle)}</h3>
            <p>{translate(SiteCopyKey.CapabilityWaitBody)}</p>
            <div class="mini-chat" aria-hidden="true">
              <span class="in">
                <span class="name">{sender(SENDER_INDEXES.first)}</span>
                {translate(SiteCopyKey.CapabilityWaitChatQuestion)}
              </span>
              <span class="divider">{translate(SiteCopyKey.CapabilityWaitChatDivider)}</span>
              <span class="out">{translate(SiteCopyKey.CapabilityWaitChatReply)}</span>
            </div>
          </article>
        </div>
      </div>
    </section>
  );
}
