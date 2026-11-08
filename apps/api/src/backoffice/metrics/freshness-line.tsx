import { LiveDot } from '../components/live-dot';

export enum FreshnessKind {
  Live = 'live',
  Hourly = 'hourly',
}

export type Freshness = { kind: FreshnessKind; label: string };

export function FreshnessLine(props: { freshness: Freshness }) {
  const { kind, label } = props.freshness;
  return (
    <p class={`figure-freshness freshness freshness-${kind}`}>
      {kind === FreshnessKind.Live ? <LiveDot /> : null}
      {label}
    </p>
  );
}
