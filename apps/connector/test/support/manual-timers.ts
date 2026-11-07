import type { CancelTimer, ConnectorTimers } from '../../src/timers';

type ScheduledTimer = { id: number; dueAtMs: number; repeatMs: number | null; run: () => void };

export type ManualTimers = ConnectorTimers & { advance(input: { ms: number }): void };

export function createManualTimers(): ManualTimers {
  let nowMs = 0;
  let nextId = 0;
  let scheduled: ScheduledTimer[] = [];

  function schedule(input: { run: () => void; delayMs: number; repeatMs: number | null }): CancelTimer {
    nextId += 1;
    const id = nextId;
    scheduled.push({ id, dueAtMs: nowMs + input.delayMs, repeatMs: input.repeatMs, run: input.run });
    return () => {
      scheduled = scheduled.filter((timer) => timer.id !== id);
    };
  }

  function nextDue(input: { untilMs: number }): ScheduledTimer | undefined {
    return scheduled
      .filter((timer) => timer.dueAtMs <= input.untilMs)
      .sort((first, second) => first.dueAtMs - second.dueAtMs || first.id - second.id)[0];
  }

  return {
    every: ({ run, delayMs }) => schedule({ run, delayMs, repeatMs: delayMs }),
    after: ({ run, delayMs }) => schedule({ run, delayMs, repeatMs: null }),
    advance: function advance({ ms }) {
      const untilMs = nowMs + ms;
      const due = nextDue({ untilMs });
      if (due === undefined) {
        nowMs = untilMs;
        return;
      }
      nowMs = due.dueAtMs;
      scheduled = scheduled.filter((timer) => timer.id !== due.id);
      if (due.repeatMs !== null) scheduled.push({ ...due, dueAtMs: nowMs + due.repeatMs });
      due.run();
      advance({ ms: untilMs - nowMs });
    },
  };
}
