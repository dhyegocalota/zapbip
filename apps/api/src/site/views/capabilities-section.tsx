import type { OwnerLocale } from '@zapbip/types';
import { SiteCopyKey } from '../site-copy';
import { copyOf } from '../site-copy-text';

const LIST_GLYPH = '☰';
const FILE_GLYPH = '▤';
const VOICE_NOTE = '▶ ▂▅▃▆▂▇▃▅▂ 0:07';

export function CapabilitiesSection(props: { locale: OwnerLocale }) {
  const translate = copyOf({ locale: props.locale });
  return (
    <section class="block" id="capabilities" aria-labelledby="capabilities-title">
      <div class="container">
        <p class="eyebrow">{translate(SiteCopyKey.CapabilitiesEyebrow)}</p>
        <h2 class="section-title" id="capabilities-title">
          {translate(SiteCopyKey.CapabilitiesTitle)}
        </h2>
        <p class="lead">{translate(SiteCopyKey.CapabilitiesLead)}</p>
        <div class="card-grid">
          <article class="card">
            <h3>{translate(SiteCopyKey.CapabilityButtonsTitle)}</h3>
            <p>{translate(SiteCopyKey.CapabilityButtonsBody)}</p>
            <div class="mini-chat" aria-hidden="true">
              <span class="in">
                <span class="name">{translate(SiteCopyKey.ClientNameCodex)}</span>
                {translate(SiteCopyKey.CapabilityButtonsChatQuestion)}
              </span>
              <span class="pill">{translate(SiteCopyKey.CapabilityButtonsChatYes)}</span>
              <span class="pill">{translate(SiteCopyKey.CapabilityButtonsChatNo)}</span>
            </div>
          </article>
          <article class="card">
            <h3>{translate(SiteCopyKey.CapabilityListTitle)}</h3>
            <p>{translate(SiteCopyKey.CapabilityListBody)}</p>
            <div class="mini-chat" aria-hidden="true">
              <span class="in">
                <span class="name">{translate(SiteCopyKey.SenderClaude)}</span>
                {translate(SiteCopyKey.CapabilityListChatQuestion)}
              </span>
              <span class="pill">
                {LIST_GLYPH} {translate(SiteCopyKey.CapabilityListChatButton)}
              </span>
              <span class="divider">{translate(SiteCopyKey.CapabilityListChatRows)}</span>
            </div>
          </article>
          <article class="card">
            <h3>{translate(SiteCopyKey.CapabilityMediaTitle)}</h3>
            <p>{translate(SiteCopyKey.CapabilityMediaBody)}</p>
            <div class="mini-chat" aria-hidden="true">
              <span class="in">
                <span class="name">{translate(SiteCopyKey.ClientNameChatGpt)}</span>
                <span class="file">
                  {FILE_GLYPH} {translate(SiteCopyKey.CapabilityMediaChatFile)}
                </span>
                {translate(SiteCopyKey.CapabilityMediaChatText)}
              </span>
              <span class="out">{VOICE_NOTE}</span>
            </div>
          </article>
          <article class="card">
            <h3>{translate(SiteCopyKey.CapabilityWakeTitle)}</h3>
            <p>{translate(SiteCopyKey.CapabilityWakeBody)}</p>
            <div class="mini-chat" aria-hidden="true">
              <span class="out">{translate(SiteCopyKey.CapabilityWakeChatYou)}</span>
              <span class="chip">{translate(SiteCopyKey.CapabilityWakeChatChip)}</span>
              <span class="in">
                <span class="name">{translate(SiteCopyKey.ClientNameClaudeCode)}</span>
                {translate(SiteCopyKey.CapabilityWakeChatAgent)}
              </span>
            </div>
          </article>
          <article class="card">
            <h3>{translate(SiteCopyKey.CapabilityRoutingTitle)}</h3>
            <p>{translate(SiteCopyKey.CapabilityRoutingBody)}</p>
            <div class="mini-chat" aria-hidden="true">
              <span class="in">
                <span class="name">{translate(SiteCopyKey.SenderClaude)}</span>
                {translate(SiteCopyKey.CapabilityRoutingChatFirst)}
              </span>
              <span class="in">
                <span class="name">{translate(SiteCopyKey.ClientNameCodex)}</span>
                {translate(SiteCopyKey.CapabilityRoutingChatSecond)}
              </span>
              <span class="out">{translate(SiteCopyKey.CapabilityRoutingChatReply)}</span>
            </div>
          </article>
          <article class="card">
            <h3>{translate(SiteCopyKey.CapabilityWaitTitle)}</h3>
            <p>{translate(SiteCopyKey.CapabilityWaitBody)}</p>
            <div class="mini-chat" aria-hidden="true">
              <span class="in">
                <span class="name">{translate(SiteCopyKey.SenderClaude)}</span>
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
