import { MessageDirection } from '@zapbip/types';
import { NOTICE_RETRY_MS } from '../constants';
import type { Message } from '../message';
import type { CoreDependencies } from '../ports';
import { sendNotice } from './send-notice';

type NoticeSubject = { message: Message; agent: string };

async function findNoticeSubject(input: { dependencies: CoreDependencies }): Promise<NoticeSubject | null> {
  const queued = await input.dependencies.repository.listQueued();
  const message = queued.find((candidate) => candidate.direction === MessageDirection.ToOwner && candidate.agent !== null);
  if (message === undefined || message.agent === null) return null;
  return { message, agent: message.agent };
}

export async function findNoticeRetryDueAt(input: { dependencies: CoreDependencies }): Promise<number | null> {
  const { dependencies } = input;
  const window = await dependencies.repository.findWindow();
  if (window.noticeRetryLocale === null || window.noticeSentForClosedWindow) return null;
  const subject = await findNoticeSubject({ dependencies });
  if (subject === null) return null;
  return dependencies.clock.now() + NOTICE_RETRY_MS;
}

export async function retryNotice(input: { dependencies: CoreDependencies }): Promise<void> {
  const { dependencies } = input;
  const window = await dependencies.repository.findWindow();
  if (window.noticeRetryLocale === null || window.noticeSentForClosedWindow) return;
  const subject = await findNoticeSubject({ dependencies });
  if (subject === null) return;
  await sendNotice({ dependencies, ownerLocale: window.noticeRetryLocale, agent: subject.agent, content: subject.message });
}
