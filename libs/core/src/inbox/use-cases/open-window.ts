import type { OwnerWindow } from '../inbox-records';
import { flushQueue } from './flush-queue';
import type { OpenWindowInput } from './types';

export function openedWindow(input: { window: OwnerWindow; at: number }): OwnerWindow {
  const { window, at } = input;
  const lastOwnerMessageAt = window.lastOwnerMessageAt === null ? at : Math.max(window.lastOwnerMessageAt, at);
  return {
    lastOwnerMessageAt,
    noticeSentForClosedWindow: false,
    closedAt: null,
    noticeRetryLocale: null,
    noticeRetryAt: null,
    noticeRetryAttempt: 0,
  };
}

export async function openWindow(input: OpenWindowInput): Promise<void> {
  const { dependencies, ownerLocale, at } = input;
  const { repository } = dependencies;
  const window = await repository.findWindow();
  await repository.saveWindow({ window: openedWindow({ window, at }) });
  await flushQueue({ dependencies, ownerLocale });
}
