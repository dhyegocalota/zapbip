import { ConnectorLogEvent, ConnectorWakeOutcome } from '@zapbip/types';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { logConnectorEvent, logConnectorEventToStderr } from '../../src/log';

const NOW = new Date('2026-11-06T12:00:00.000Z');

let writtenChunks: string[];

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
  writtenChunks = [];
  vi.spyOn(process.stdout, 'write').mockImplementation((chunk) => {
    writtenChunks.push(String(chunk));
    return true;
  });
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

function loggedLine(): Record<string, unknown> {
  const [chunk] = writtenChunks;
  if (chunk === undefined) throw new Error('expected a log line');
  return JSON.parse(chunk);
}

describe('logConnectorEvent', () => {
  test('writes one JSON line with the time, the event and the fields', () => {
    logConnectorEvent({
      event: ConnectorLogEvent.WakeFinished,
      fields: { messageId: 'msg_1', outcome: ConnectorWakeOutcome.Answered, exitCode: 0, elapsedMs: 7_000 },
    });
    expect(writtenChunks).toHaveLength(1);
    expect(writtenChunks[0]).toMatch(/\}\n$/);
    expect(loggedLine()).toEqual({
      at: NOW.toISOString(),
      event: ConnectorLogEvent.WakeFinished,
      messageId: 'msg_1',
      outcome: ConnectorWakeOutcome.Answered,
      exitCode: 0,
      elapsedMs: 7_000,
    });
  });

  test('carries null fields as null', () => {
    logConnectorEvent({ event: ConnectorLogEvent.WakeFinished, fields: { messageId: 'msg_1', exitCode: null } });
    expect(loggedLine()).toMatchObject({ exitCode: null });
  });

  test('writes nothing but the time, the event and the fields it was given', () => {
    logConnectorEvent({ event: ConnectorLogEvent.MessagesReceived, fields: { count: 3 } });
    expect(Object.keys(loggedLine()).sort()).toEqual(['at', 'count', 'event']);
  });

  test('keeps the time and the event when a field uses their names', () => {
    logConnectorEvent({ event: ConnectorLogEvent.DoneSent, fields: { at: 'forged', event: 'forged' } });
    expect(loggedLine()).toEqual({ at: NOW.toISOString(), event: ConnectorLogEvent.DoneSent });
  });

  test('writes one line per call', () => {
    logConnectorEvent({ event: ConnectorLogEvent.ConnectorClosed, fields: { code: 1006 } });
    logConnectorEvent({ event: ConnectorLogEvent.ConnectorReconnecting, fields: { attempt: 1, delayMs: 1_000 } });
    expect(writtenChunks).toHaveLength(2);
  });
});

describe('logConnectorEventToStderr', () => {
  test('writes the same line to the error stream and nothing to the output stream', () => {
    const errorChunks: string[] = [];
    vi.spyOn(process.stderr, 'write').mockImplementation((chunk) => {
      errorChunks.push(String(chunk));
      return true;
    });
    logConnectorEventToStderr({ event: ConnectorLogEvent.MessagesReceived, fields: { count: 3 } });
    expect(writtenChunks).toEqual([]);
    expect(JSON.parse(errorChunks[0] as string)).toEqual({ at: NOW.toISOString(), event: ConnectorLogEvent.MessagesReceived, count: 3 });
  });
});
