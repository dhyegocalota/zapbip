import { DURABLE_OBJECT_DAILY_GIGABYTE_SECONDS, DAILY_BUDGET_WARNING_RATIO } from '../../operations/constants';
import { isBudgetWarning } from '../../account-inbox/usage-meter';
import { BackofficeCopyKey, renderBackofficeCopy } from '../backoffice-copy';
import type { OwnerLocale } from '@zapbip/types';

const BAR_WIDTH = 640;
const BAR_HEIGHT = 24;
const TICK_HEIGHT = 36;
const BUDGET_HATCH_ID = 'budget-hatch';
const HATCH_SIZE = 6;
const HATCH_ROTATION = 45;

export function BudgetBar(props: { locale: OwnerLocale; used: number }) {
  const { locale, used } = props;
  const translate = (key: BackofficeCopyKey, values?: Record<string, string>): string => renderBackofficeCopy({ key, locale, values });
  const isWarning = isBudgetWarning({ gigabyteSeconds: used });
  const fillWidth = Math.min(used / DURABLE_OBJECT_DAILY_GIGABYTE_SECONDS, 1) * BAR_WIDTH;
  const tickX = DAILY_BUDGET_WARNING_RATIO * BAR_WIDTH;
  const statusKey = isWarning ? BackofficeCopyKey.MetricsBudgetWarning : BackofficeCopyKey.MetricsBudgetWithin;
  return (
    <div class={isWarning ? 'budget budget-warning' : 'budget'}>
      <svg
        class="budget-plot"
        viewBox={`0 0 ${BAR_WIDTH} ${TICK_HEIGHT}`}
        role="img"
        aria-label={translate(BackofficeCopyKey.MetricsBudgetTitle)}
      >
        <defs>
          <pattern
            id={BUDGET_HATCH_ID}
            width={HATCH_SIZE}
            height={HATCH_SIZE}
            patternUnits="userSpaceOnUse"
            patternTransform={`rotate(${HATCH_ROTATION})`}
          >
            <line class="hatch-line" x1="0" y1="0" x2="0" y2={HATCH_SIZE} />
          </pattern>
        </defs>
        <rect class="budget-track" x="0" y="0" width={BAR_WIDTH} height={BAR_HEIGHT} />
        <rect
          class="budget-fill"
          x="0"
          y="0"
          width={fillWidth}
          height={BAR_HEIGHT}
          fill={isWarning ? `url(#${BUDGET_HATCH_ID})` : undefined}
        />
        <line class="budget-tick" x1={tickX} y1="0" x2={tickX} y2={TICK_HEIGHT} />
      </svg>
      <p class="figure-freshness">{translate(BackofficeCopyKey.MetricsBudgetThreshold)}</p>
      <p>
        {translate(BackofficeCopyKey.MetricsBudgetUsed, {
          used: String(Math.round(used)),
          limit: String(DURABLE_OBJECT_DAILY_GIGABYTE_SECONDS),
        })}
      </p>
      <p class="budget-status">{translate(statusKey)}</p>
    </div>
  );
}
