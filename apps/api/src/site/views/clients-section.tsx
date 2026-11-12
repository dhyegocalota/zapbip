import type { OwnerLocale } from '@zapbip/types';
import { CLIENT_WAKE_SECONDS } from '../site-constants';
import { SiteCopyKey } from '../site-copy';
import { copyOf } from '../site-copy-text';

type ClientTile = { name: SiteCopyKey; chip: SiteCopyKey; seconds: string | null; isLive: boolean };

const CLIENT_TILES: ClientTile[] = [
  { name: SiteCopyKey.ClientNameClaudeCode, chip: SiteCopyKey.ClientsWakeSeconds, seconds: CLIENT_WAKE_SECONDS.claudeCode, isLive: true },
  { name: SiteCopyKey.ClientNameCodex, chip: SiteCopyKey.ClientsWakeSeconds, seconds: CLIENT_WAKE_SECONDS.codex, isLive: true },
  { name: SiteCopyKey.ClientNameGrokBot, chip: SiteCopyKey.ClientsWakeSeconds, seconds: CLIENT_WAKE_SECONDS.grokBot, isLive: true },
  { name: SiteCopyKey.ClientNameClaudeAi, chip: SiteCopyKey.ClientsWakeSeconds, seconds: CLIENT_WAKE_SECONDS.claudeAi, isLive: true },
  { name: SiteCopyKey.ClientNameChatGpt, chip: SiteCopyKey.ClientsHourly, seconds: null, isLive: false },
  { name: SiteCopyKey.ClientNameCursor, chip: SiteCopyKey.ClientsLocal, seconds: null, isLive: false },
  { name: SiteCopyKey.ClientNameGeminiCli, chip: SiteCopyKey.ClientsLocal, seconds: null, isLive: false },
];

export function ClientsSection(props: { locale: OwnerLocale }) {
  const translate = copyOf({ locale: props.locale });
  return (
    <section class="block" id="clients" aria-labelledby="clients-title">
      <div class="container">
        <p class="eyebrow">{translate(SiteCopyKey.ClientsEyebrow)}</p>
        <h2 class="section-title" id="clients-title">
          {translate(SiteCopyKey.ClientsTitle)}
        </h2>
        <div class="clients">
          {CLIENT_TILES.map((tile) => (
            <div class="card client">
              <strong>{translate(tile.name)}</strong>
              <span>
                {tile.isLive ? <i class="live-dot" /> : null}
                {translate(tile.chip, tile.seconds === null ? undefined : { seconds: tile.seconds })}
              </span>
            </div>
          ))}
          <div class="card client hero-card">
            <strong>{translate(SiteCopyKey.ClientsAnyMcpName)}</strong>
            <span>{translate(SiteCopyKey.ClientsAnyMcp)}</span>
          </div>
        </div>
        <p class="footnote">{translate(SiteCopyKey.ClientsFootnote)}</p>
      </div>
    </section>
  );
}
