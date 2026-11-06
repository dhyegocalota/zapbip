export type CancelTimer = () => void;

export interface ConnectorTimers {
  every(input: { run: () => void; delayMs: number }): CancelTimer;
  after(input: { run: () => void; delayMs: number }): CancelTimer;
}

export const REAL_TIMERS: ConnectorTimers = {
  every: ({ run, delayMs }) => {
    const handle = setInterval(run, delayMs);
    return () => clearInterval(handle);
  },
  after: ({ run, delayMs }) => {
    const handle = setTimeout(run, delayMs);
    return () => clearTimeout(handle);
  },
};
