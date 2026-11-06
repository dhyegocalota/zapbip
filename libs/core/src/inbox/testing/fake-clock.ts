import type { Clock } from '../ports';

type ScheduledTask = { runAt: number; run: () => void };

export type FakeClock = Clock & { advance(input: { ms: number }): Promise<void> };

function settlePendingWork(): Promise<void> {
  return new Promise((resolve) => setImmediate(resolve));
}

export function createFakeClock(input: { startAt: number }): FakeClock {
  let currentTime = input.startAt;
  const tasks = new Set<ScheduledTask>();

  function earliestDue(until: number): ScheduledTask | null {
    const due = [...tasks].filter((task) => task.runAt <= until).sort((first, second) => first.runAt - second.runAt);
    return due[0] === undefined ? null : due[0];
  }

  async function advance(advanceInput: { ms: number }): Promise<void> {
    const target = currentTime + advanceInput.ms;
    await settlePendingWork();
    for (let task = earliestDue(target); task !== null; task = earliestDue(target)) {
      tasks.delete(task);
      currentTime = Math.max(currentTime, task.runAt);
      task.run();
      await settlePendingWork();
    }
    currentTime = target;
    await settlePendingWork();
  }

  return {
    now: () => currentTime,
    schedule: ({ delayMs, run }) => {
      const task: ScheduledTask = { runAt: currentTime + delayMs, run };
      tasks.add(task);
      return { cancel: () => tasks.delete(task) };
    },
    advance,
  };
}
