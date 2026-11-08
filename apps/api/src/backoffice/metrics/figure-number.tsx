import { type Freshness, FreshnessLine } from './freshness-line';
import type { MetricCell } from './metric-cell';

export function FigureNumber(props: { id: string; label: string; value: string; cell: MetricCell; freshness: Freshness }) {
  return (
    <div class="figure">
      <p id={props.id} class="figure-label">
        {props.label}
      </p>
      <p class="figure-value" aria-labelledby={props.id} data-cell={props.cell}>
        {props.value}
      </p>
      <FreshnessLine freshness={props.freshness} />
    </div>
  );
}
