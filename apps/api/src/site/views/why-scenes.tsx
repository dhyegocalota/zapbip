import type { WebLocale } from '@zapbip/types';
import { SENDER_INDEXES, senderNameOf, siteAgentNames } from '../site-agents';
import { SiteCopyKey } from '../site-copy';
import { copyOf } from '../site-copy-text';

const CHECK_GLYPH = '✓';
const SHIELD_VIEWBOX = '0 0 120 142';
const SHIELD_PATH = 'M60 8 L108 26 V70 C108 102 86 124 60 134 C34 124 12 102 12 70 V26 Z';
const SHIELD_CHECK_PATH = 'M38 72 L54 88 L84 54';
const ROUTE_VIEWBOX = '0 0 100 100';
const ROUTE_LIVE_PATH = 'M0 50 C 55 50, 45 75, 100 75';
const ROUTE_GHOST_PATH = 'M0 50 C 55 50, 45 25, 100 25';
const CHIP_AGENT_COUNT = 6;
const TERMINAL_DOT_COUNT = 3;
const TERMINAL_DOTS = Array.from({ length: TERMINAL_DOT_COUNT }, (_value, index) => index);

type SceneProps = { locale: WebLocale };

export function OfficialScene(props: SceneProps) {
  const translate = copyOf({ locale: props.locale });
  return (
    <div class="scene scene-official">
      <svg class="shield scene-step step-1 pop" viewBox={SHIELD_VIEWBOX} aria-hidden="true">
        <path class="shield-body" d={SHIELD_PATH} />
        <path class="shield-check scene-step step-2 draw" d={SHIELD_CHECK_PATH} pathLength="1" />
      </svg>
      <span class="scene-badge scene-step step-3 left">{translate(SiteCopyKey.WhyOfficialBadge)}</span>
      <span class="scene-note scene-step step-4 left">
        {CHECK_GLYPH} {translate(SiteCopyKey.WhyOfficialNote)}
      </span>
    </div>
  );
}

export function AskScene(props: SceneProps) {
  const translate = copyOf({ locale: props.locale });
  return (
    <div class="scene scene-chat mini-chat">
      <span class="in scene-step step-1 left">
        <span class="name">{senderNameOf({ index: SENDER_INDEXES.first })}</span>
        {translate(SiteCopyKey.WhyAskQuestion)}
      </span>
      <span class="pill scene-step step-2">
        {translate(SiteCopyKey.WhyAskShip)}
        <span class="tap-glow scene-step step-3 pop" />
      </span>
      <span class="pill scene-step step-2">{translate(SiteCopyKey.WhyAskWait)}</span>
      <span class="out scene-step step-4 right">{translate(SiteCopyKey.WhyAskShip)}</span>
      <span class="in scene-step step-5 left">
        <span class="name">{senderNameOf({ index: SENDER_INDEXES.first })}</span>
        {CHECK_GLYPH} {translate(SiteCopyKey.WhyAskDone)}
      </span>
    </div>
  );
}

export function RoutingScene(props: SceneProps) {
  const translate = copyOf({ locale: props.locale });
  return (
    <div class="scene scene-route">
      <div class="mini-chat route-chat">
        <span class="out scene-step step-1 right">{translate(SiteCopyKey.CapabilityRoutingChatReply)}</span>
      </div>
      <svg class="route-line" viewBox={ROUTE_VIEWBOX} preserveAspectRatio="none" aria-hidden="true">
        <path class="route-ghost" d={ROUTE_GHOST_PATH} />
        <path class="route-live scene-step step-2 draw" d={ROUTE_LIVE_PATH} pathLength="1" />
      </svg>
      <div class="agent-boxes">
        <span class="agent-box">{senderNameOf({ index: SENDER_INDEXES.first })}</span>
        <span class="agent-box">
          {senderNameOf({ index: SENDER_INDEXES.second })}
          <span class="agent-box-glow scene-step step-3 pop" />
        </span>
      </div>
    </div>
  );
}

export function WakeScene(props: SceneProps) {
  const translate = copyOf({ locale: props.locale });
  return (
    <div class="scene scene-terminal">
      <div class="terminal-bar">
        {TERMINAL_DOTS.map(() => (
          <span class="terminal-dot" />
        ))}
        <span class="terminal-name">{senderNameOf({ index: SENDER_INDEXES.first })}</span>
      </div>
      <p class="terminal-status">
        <span class="status-dot scene-step step-3 pop" />
        <span class="status-text">
          <span class="status-idle scene-leave step-3">{translate(SiteCopyKey.WhyWakeIdle)}</span>
          <span class="status-awake scene-step step-3">{translate(SiteCopyKey.WhyWakeAwake)}</span>
        </span>
      </p>
      <div class="mini-chat">
        <span class="out scene-step step-2 right">{translate(SiteCopyKey.CapabilityWakeChatYou)}</span>
        <span class="chip scene-step step-3 pop">{translate(SiteCopyKey.CapabilityWakeChatChip)}</span>
        <span class="in scene-step step-4 left">
          <span class="name">{senderNameOf({ index: SENDER_INDEXES.first })}</span>
          {translate(SiteCopyKey.CapabilityWakeChatAgent)}
        </span>
      </div>
    </div>
  );
}

export function EveryAgentScene(props: SceneProps) {
  const translate = copyOf({ locale: props.locale });
  return (
    <div class="scene scene-agents">
      {siteAgentNames()
        .slice(0, CHIP_AGENT_COUNT)
        .map((name, index) => (
          <span class={`agent-chip scene-step step-${index + 1} pop`}>{name}</span>
        ))}
      <span class={`agent-chip agent-chip-any scene-step step-${CHIP_AGENT_COUNT + 1} pop`}>
        {translate(SiteCopyKey.ClientsAnyMcpName)}
      </span>
    </div>
  );
}

export function FastScene(props: SceneProps) {
  const translate = copyOf({ locale: props.locale });
  return (
    <div class="scene scene-checklist">
      <span class="time-chip scene-step step-1 pop">{translate(SiteCopyKey.WhyFastTime)}</span>
      <div class="progress" aria-hidden="true">
        <span class="progress-bar scene-step step-1 grow" />
      </div>
      <ul class="checklist">
        <li class="scene-step step-2 left">
          <span class="check">{CHECK_GLYPH}</span> {translate(SiteCopyKey.WhyFastStepMessage)}
        </li>
        <li class="scene-step step-3 left">
          <span class="check">{CHECK_GLYPH}</span> {translate(SiteCopyKey.WhyFastStepPaste)}
        </li>
        <li class="scene-step step-4 left">
          <span class="check">{CHECK_GLYPH}</span> {translate(SiteCopyKey.WhyFastStepDone)}
        </li>
      </ul>
    </div>
  );
}
