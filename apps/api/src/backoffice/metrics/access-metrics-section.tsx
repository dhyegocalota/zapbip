import { OwnerLocale } from '@zapbip/types';
import { BackofficeCopyKey, renderBackofficeCopy } from '../backoffice-copy';
import { Sparkline } from '../views/sparkline';
import { accessMonthSeries, accessWindowFigures, accessWindowOf, waitlistTotalOf, type AccessWindowFigures } from './access-metrics';
import { type Freshness, FreshnessLine } from './freshness-line';
import { FigureNumber } from './figure-number';
import { keyedCell, MetricCell } from './metric-cell';
import { ACCESS_MONTH_DAYS, ACCESS_WEEK_DAYS } from './metrics-filter';
import type { AccessReport } from './metrics-report';
import { SummaryTable } from './summary-table';

const LOCALE_LABELS: Record<OwnerLocale, BackofficeCopyKey> = {
  [OwnerLocale.PortugueseBrazil]: BackofficeCopyKey.LocalePortuguese,
  [OwnerLocale.EnglishUs]: BackofficeCopyKey.LocaleEnglish,
};

type WindowRow = { label: BackofficeCopyKey; cell: MetricCell; figure: keyof AccessWindowFigures };

const WINDOW_ROWS: WindowRow[] = [
  { label: BackofficeCopyKey.MetricsAccessWaitlist, cell: MetricCell.AccessJoins, figure: 'joins' },
  { label: BackofficeCopyKey.MetricsAccessInvited, cell: MetricCell.AccessInvited, figure: 'invited' },
  { label: BackofficeCopyKey.MetricsAccessInvitesUsed, cell: MetricCell.AccessInvitesUsed, figure: 'used' },
  { label: BackofficeCopyKey.MetricsAccessReleased, cell: MetricCell.AccessReleased, figure: 'released' },
  { label: BackofficeCopyKey.MetricsAccessReleasedConnected, cell: MetricCell.AccessReleasedConnected, figure: 'releasedConnected' },
  { label: BackofficeCopyKey.MetricsAccessMessages, cell: MetricCell.AccessMessages, figure: 'messages' },
  { label: BackofficeCopyKey.MetricsAccessQuestions, cell: MetricCell.AccessQuestions, figure: 'questions' },
];

export function AccessMetricsSection(props: { locale: OwnerLocale; access: AccessReport; now: number; live: Freshness; noData: string }) {
  const { locale, access, now, live, noData } = props;
  const translate = (key: BackofficeCopyKey): string => renderBackofficeCopy({ key, locale });
  const week = accessWindowFigures({ access, now, window: accessWindowOf({ access, dayCount: ACCESS_WEEK_DAYS }) });
  const month = accessWindowFigures({ access, now, window: accessWindowOf({ access, dayCount: ACCESS_MONTH_DAYS }) });
  const series = accessMonthSeries({ access, now });
  return (
    <section class="card chart-card-wide" aria-labelledby="metrics-access-title">
      <h2 id="metrics-access-title">{translate(BackofficeCopyKey.MetricsAccessTitle)}</h2>
      <FreshnessLine freshness={live} />
      <p class="field-help">{translate(BackofficeCopyKey.MetricsAccessGlobalNote)}</p>
      <div class="figure-grid">
        <FigureNumber
          id="figure-access-waitlist"
          label={translate(BackofficeCopyKey.MetricsAccessWaitlist)}
          value={String(waitlistTotalOf({ access }))}
          cell={MetricCell.AccessWaitlistTotal}
          freshness={live}
        />
        <FigureNumber
          id="figure-access-invited"
          label={translate(BackofficeCopyKey.MetricsAccessInvited)}
          value={String(access.inviteTotals.issued)}
          cell={MetricCell.AccessInvitedTotal}
          freshness={live}
        />
        <FigureNumber
          id="figure-access-used"
          label={translate(BackofficeCopyKey.MetricsAccessInvitesUsed)}
          value={String(access.inviteTotals.used)}
          cell={MetricCell.AccessInvitesUsedTotal}
          freshness={live}
        />
        <FigureNumber
          id="figure-access-released"
          label={translate(BackofficeCopyKey.MetricsAccessReleased)}
          value={String(access.releasedAllTime.released)}
          cell={MetricCell.AccessReleasedTotal}
          freshness={live}
        />
        <FigureNumber
          id="figure-access-connected"
          label={translate(BackofficeCopyKey.MetricsAccessReleasedConnected)}
          value={String(access.releasedAllTime.connected)}
          cell={MetricCell.AccessReleasedConnectedTotal}
          freshness={live}
        />
      </div>
      <h3>{translate(BackofficeCopyKey.MetricsAccessWaitlistByLocale)}</h3>
      <SummaryTable
        caption={translate(BackofficeCopyKey.MetricsAccessWaitlistByLocale)}
        emptyText={noData}
        rows={access.waitlistByLocale.map((entry) => ({
          label: translate(LOCALE_LABELS[entry.locale]),
          value: String(entry.total),
          cell: keyedCell({ cell: MetricCell.AccessWaitlistLocale, key: entry.locale }),
        }))}
      />
      <table class="data-table summary-table">
        <caption class="visually-hidden">{translate(BackofficeCopyKey.MetricsAccessTitle)}</caption>
        <thead>
          <tr>
            <th scope="col">{translate(BackofficeCopyKey.MetricsAccessColumnMetric)}</th>
            <th scope="col">{translate(BackofficeCopyKey.MetricsAccessColumnSevenDays)}</th>
            <th scope="col">{translate(BackofficeCopyKey.MetricsAccessColumnThirtyDays)}</th>
          </tr>
        </thead>
        <tbody>
          {WINDOW_ROWS.map((row) => (
            <tr>
              <th scope="row">{translate(row.label)}</th>
              <td
                data-label={translate(BackofficeCopyKey.MetricsAccessColumnSevenDays)}
                data-cell={keyedCell({ cell: row.cell, key: String(ACCESS_WEEK_DAYS) })}
              >
                {week[row.figure]}
              </td>
              <td
                data-label={translate(BackofficeCopyKey.MetricsAccessColumnThirtyDays)}
                data-cell={keyedCell({ cell: row.cell, key: String(ACCESS_MONTH_DAYS) })}
              >
                {month[row.figure]}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <h3>{translate(BackofficeCopyKey.MetricsAccessWaitlistPerDay)}</h3>
      <Sparkline
        id="access-joins-sparkline"
        locale={locale}
        metricLabel={translate(BackofficeCopyKey.MetricsAccessWaitlistPerDay)}
        values={series.joins}
      />
      <h3>{translate(BackofficeCopyKey.MetricsAccessMessages)}</h3>
      <Sparkline
        id="access-messages-sparkline"
        locale={locale}
        metricLabel={translate(BackofficeCopyKey.MetricsAccessMessages)}
        values={series.messages}
      />
      <h3>{translate(BackofficeCopyKey.MetricsAccessQuestions)}</h3>
      <Sparkline
        id="access-questions-sparkline"
        locale={locale}
        metricLabel={translate(BackofficeCopyKey.MetricsAccessQuestions)}
        values={series.questions}
      />
    </section>
  );
}
