# Tester briefing: Mobile speed of the landing page

Measured on the local development Worker with `apps/api/scripts/lighthouse-budget.ts http://site.localhost:8787/` (load average about 4, so noisy; two runs each).

| | Mobile score | Mobile TBT | Desktop score | Desktop TBT |
| --- | --- | --- | --- | --- |
| Before | 0.70 | 3.5 s | 0.82 to 0.89 | 270 to 415 ms |
| After | 0.84 and 1.00 | 640 ms and 0 ms | 1.00 and 1.00 | 0 ms |

Production before (idle machine): mobile 0.70, TBT 2.25 to 2.4 s; desktop 0.92, TBT 226 ms. Production after is measured by the orchestrator once deployed.

Look at `/` and `/ar` at 360 px and on desktop: the live dot ring pulses twice, the hero underline draws from the reading start (left in English, right in Arabic), nothing else moves differently.
