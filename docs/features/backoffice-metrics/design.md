# Design: Backoffice metrics

Moved from `backoffice/design.md` §4.8 and §5.3. Components: `FigureNumber`, `BarChart` (with optional reference lines), `FilterForm`, `SummaryTable`. The single `BudgetBar` was replaced by a per-day `BarChart` with the limit and the 80 % line. The budget is account-wide and ignores the number filter; a note on the page says so (`MetricsBudgetAccountWide`).

## Metrics page (`GET /metrics`)

```
1280
+------------------------------------------------------------------------+
| Metrics            Number [All v]  Period [30 days v]  [Apply]          |
| Updated hourly: messages, templates, failures, wake, budget.            |
| +--------+ +--------+ +--------+ +--------+     <- FigureNumber row     |
| |Accounts| |Agents  | |Agents  | |Blocked |                             |
| |   38   | |active  | |connect.| |phones 2|                             |
| +--------+ +--------+ +--------+ +--------+                             |
| Accounts            (card)  by state (table) | per number (table)       |
| New accounts / day  (BarChart + Show values)                            |
| Agents              by client (table) | created and revoked / day (chart)|
| Messages            in and out / day (BarChart, two series)             |
| Template sends      notice and question (table by day)                  |
| Send failures       / day (BarChart)                                    |
| Wake success        % per day (BarChart) + overall figure               |
| Durable Object budget  (one bar per day, limit and 80% lines)       |
| Restricted numbers  (table)                                             |

375: filter controls stack (labels above), figure cards 2 per row, then one card
per row; charts scale to the width; no horizontal scroll.
```

| State | What shows |
|---|---|
| Populated | All cards. Today's row of an hourly metric reads "updates hourly". |
| Empty (no accounts, no activity yet) | Each card renders its own empty text ("No data yet") and the figures read `0`. Charts are replaced by that text, never an empty axis. |
| One number selected | Cards show that number only; "Accounts per number" collapses to one row. |
| Many | Charts show up to 30 bars; the numeric table holds the exact values. |
| Budget below 80% | One bar per day of the period in `--color-brand` against a dashed limit line and a dashed 80% line, status text "Within budget" for today. |
| Budget at or above 80% (`isBudgetWarning`) | Today's status text reads "Warning: above 80% of the daily budget" in `--color-warning`; the dashed 80% line is labelled in every state. |
| Query failure | The 500 page. |

Chart rules:

- Bars are SVG `<rect>` with a class; a bar's height is an attribute computed server-side. Two-series charts (messages in and out) use `--color-brand` and `--color-action` and differ by pattern (solid and hatched), and a legend with the series names, so the series are not told apart by colour alone.
- Each chart is `role="img"`, with a `<title>` ("New accounts per day, last 30 days") and a `<desc>` giving the range and the total. Right under it, `<details><summary>Show values</summary>` holds the exact data as a table. Both are native and need no script.
- Axes: a baseline and the maximum value as text; no gridlines. Day labels every seventh bar in text.
- Wake success is shown as a percentage with one decimal, and "no wakes" when the denominator is zero (never `0%`, never `NaN`).
- Freshness: every card sourced from `activity_daily` or `usage_daily` carries "Updated hourly" in its subtitle; D1-live cards carry "Live".

Accessibility: the filter form is labelled and keyboard operable; `FigureNumber` is a `<p>` pair (label then value) in a `<section aria-labelledby>`; headings go `h1` page, `h2` card, `h3` sub-block; no information lives only in a chart (the tables carry it).

Copy keys: `MetricsTitle`, `MetricsFilterNumber`, `MetricsFilterNumberAll`, `MetricsFilterPeriod`, `MetricsPeriod7`, `MetricsPeriod30`, `MetricsFilterApply`, `MetricsFreshnessLive`, `MetricsFreshnessHourly`, `MetricsUpdatesHourly`, `MetricsNoData`, `MetricsShowValues`, `MetricsAccountsTitle`, `MetricsAccountsByState`, `MetricsAccountsPerNumber`, `MetricsAccountStateWaitlisted`, `MetricsAccountStateActive`, `MetricsAccountStateSuspended`, `MetricsAccountStateDeleting`, `MetricsNewAccountsPerDay`, `MetricsAgentsTitle`, `MetricsAgentsActive`, `MetricsAgentsConnected`, `MetricsAgentsByClient`, `MetricsAgentsNotReported`, `MetricsAgentsCreatedRevoked`, `MetricsMessagesTitle`, `MetricsMessagesIn`, `MetricsMessagesOut`, `MetricsTemplatesTitle`, `MetricsTemplatesNotice`, `MetricsTemplatesQuestion`, `MetricsFailuresTitle`, `MetricsWakeTitle`, `MetricsWakeNoWakes`, `MetricsBudgetTitle`, `MetricsBudgetWithin`, `MetricsBudgetWarning`, `MetricsBudgetThreshold`, `MetricsBudgetUsed` (with `{used}` and `{limit}`), `MetricsBlockedPhones`, `MetricsRestrictedTitle`, `ChartLegendSolid`, `ChartLegendHatched`, `ChartTitle` (with `{metric}` and `{days}`), `ChartDescription` (with `{from}`, `{to}`, `{total}`), `ColumnDay`, `ColumnCount`, `ColumnCreated`, `ColumnRevoked`.

## Copy

| Key | pt_BR | en_US |
|---|---|---|
| `MetricsTitle` | Métricas | Metrics |
| `MetricsFilterNumber` | Número | Number |
| `MetricsFilterNumberAll` | Todos | All |
| `MetricsFilterPeriod` | Período | Period |
| `MetricsPeriod7` | 7 dias | 7 days |
| `MetricsPeriod30` | 30 dias | 30 days |
| `MetricsFilterApply` | Aplicar | Apply |
| `MetricsFreshnessLive` | Ao vivo | Live |
| `MetricsFreshnessHourly` | Atualiza de hora em hora | Updated hourly |
| `MetricsUpdatesHourly` | atualiza de hora em hora | updates hourly |
| `MetricsNoData` | Sem dados ainda | No data yet |
| `MetricsShowValues` | Mostrar valores | Show values |
| `MetricsAccountsTitle` | Contas | Accounts |
| `MetricsAccountsByState` | Contas por estado | Accounts by state |
| `MetricsAccountsPerNumber` | Contas por número | Accounts per number |
| `MetricsAccountStateWaitlisted` | Em espera | Waitlisted |
| `MetricsAccountStateActive` | Ativa | Active |
| `MetricsAccountStateSuspended` | Suspensa | Suspended |
| `MetricsAccountStateDeleting` | Em exclusão | Deleting |
| `MetricsNewAccountsPerDay` | Novas contas por dia | New accounts per day |
| `MetricsAgentsTitle` | Agentes | Agents |
| `MetricsAgentsActive` | Agentes ativos | Agents active |
| `MetricsAgentsConnected` | Agentes conectados | Agents connected |
| `MetricsAgentsByClient` | Agentes por cliente | Agents by client |
| `MetricsAgentsNotReported` | Não informado | Not reported |
| `MetricsAgentsCreatedRevoked` | Agentes criados e revogados por dia | Agents created and revoked per day |
| `MetricsMessagesTitle` | Mensagens | Messages |
| `MetricsMessagesIn` | Recebidas | In |
| `MetricsMessagesOut` | Enviadas | Out |
| `MetricsTemplatesTitle` | Envios de modelo | Template sends |
| `MetricsTemplatesNotice` | Avisos | Notices |
| `MetricsTemplatesQuestion` | Perguntas | Questions |
| `MetricsFailuresTitle` | Falhas de envio | Send failures |
| `MetricsWakeTitle` | Sucesso do despertar | Wake success |
| `MetricsWakeNoWakes` | Sem despertares | No wakes |
| `MetricsBudgetTitle` | Orçamento dos Durable Objects | Durable Object budget |
| `MetricsBudgetWithin` | Dentro do orçamento | Within budget |
| `MetricsBudgetWarning` | Atenção: acima de 80% do orçamento diário | Warning: above 80% of the daily budget |
| `MetricsBudgetThreshold` | Limite de 80% | 80% threshold |
| `MetricsBudgetUsed` | {used} de {limit} gigabytes-segundo | {used} of {limit} gigabyte-seconds |
| `MetricsBlockedPhones` | Telefones bloqueados | Blocked phones |
| `MetricsRestrictedTitle` | Números restritos | Restricted numbers |
| `ChartLegendSolid` | Sólido | Solid |
| `ChartLegendHatched` | Hachurado | Hatched |
| `ChartTitle` | {metric}, últimos {days} dias | {metric}, last {days} days |
| `ChartDescription` | De {from} a {to}. Total: {total}. | From {from} to {to}. Total: {total}. |
| `ColumnDay` | Dia | Day |
| `ColumnCount` | Quantidade | Count |
| `ColumnCreated` | Criados | Created |
| `ColumnRevoked` | Revogados | Revoked |
| `MetricsBudgetAccountWide` | Orçamento da conta inteira: o filtro de número não se aplica. | Budget is account-wide: the number filter does not apply. |
| `MetricsPercentValue` | {value}% | {value}% |
| `NoticeMetricsPeriodInvalid` | Período inválido; mostrando 30 dias. | Invalid period; showing 30 days. |
| `NoticeMetricsNumberNotFound` | Número não encontrado. | Number not found. |
