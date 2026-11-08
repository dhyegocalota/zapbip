import { vi } from 'vitest';

export function captureLogLines(): string[] {
  const lines: string[] = [];
  (['log', 'info', 'warn', 'error', 'debug'] as const).forEach((method) =>
    vi.spyOn(console, method).mockImplementation((...parts: unknown[]) => void lines.push(parts.join(' '))),
  );
  return lines;
}
