import type { MetricCell } from './metric-cell';

export function FigureNumber(props: { id: string; label: string; value: string; cell: MetricCell; freshness: string }) {
  return (
    <div class="figure">
      <p id={props.id} class="figure-label">
        {props.label}
      </p>
      <p class="figure-value" aria-labelledby={props.id} data-cell={props.cell}>
        {props.value}
      </p>
      <p class="figure-freshness">{props.freshness}</p>
    </div>
  );
}
