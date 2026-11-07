import { MessageDirection, type OwnerLocale } from '@zapbip/types';
import type { Message } from '../message';
import type { CoreDependencies } from '../ports';
import { noticeSenderOf, pickNoticeMessage } from './notice-owner';
import { sendNotice } from './send-notice';

type PendingRetry = { ownerLocale: OwnerLocale; dueAt: number };
type NoticeSubject = { message: Message; sender: string };

async function findNoticeSubject(input: { dependencies: CoreDependencies }): Promise<NoticeSubject | null> {
  const queued = await input.dependencies.repository.listQueued();
  const message = pickNoticeMessage({ messages: queued.filter((candidate) => candidate.direction === MessageDirection.ToOwner) });
  if (message === undefined) return null;
  return { message, sender: noticeSenderOf({ message }) };
}

async function findPendingRetry(input: { dependencies: CoreDependencies }): Promise<PendingRetry | null> {
  const { noticeRetryLocale, noticeRetryAt, noticeSentForClosedWindow } = await input.dependencies.repository.findWindow();
  const hasNoPendingRetry = noticeRetryLocale === null || noticeRetryAt === null || noticeSentForClosedWindow;
  if (hasNoPendingRetry) return null;
  return { ownerLocale: noticeRetryLocale, dueAt: noticeRetryAt };
}

export async function findNoticeRetryDueAt(input: { dependencies: CoreDependencies }): Promise<number | null> {
  const { dependencies } = input;
  const pendingRetry = await findPendingRetry({ dependencies });
  if (pendingRetry === null) return null;
  const subject = await findNoticeSubject({ dependencies });
  if (subject === null) return null;
  return pendingRetry.dueAt;
}

export async function retryNotice(input: { dependencies: CoreDependencies }): Promise<void> {
  const { dependencies } = input;
  const pendingRetry = await findPendingRetry({ dependencies });
  if (pendingRetry === null) return;
  const isNotDueYet = dependencies.clock.now() < pendingRetry.dueAt;
  if (isNotDueYet) return;
  const subject = await findNoticeSubject({ dependencies });
  if (subject === null) return;
  await sendNotice({ dependencies, ownerLocale: pendingRetry.ownerLocale, agent: subject.sender, content: subject.message });
}
