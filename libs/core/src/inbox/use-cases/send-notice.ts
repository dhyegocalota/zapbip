import { MessageKind, TemplateKind, type OwnerLocale } from '@zapbip/types';
import { NOTICE_RETRY_BACKOFF_FACTOR, NOTICE_RETRY_MAX_MS, NOTICE_RETRY_MS } from '../constants';
import { NoticeFailedError } from '../errors';
import { buildNoticePreview } from '../inbox-copy';
import type { AgentName } from '../connection';
import type { MessageContent } from '../message';
import type { CoreDependencies } from '../ports';

type SendNoticeInput = { dependencies: CoreDependencies; ownerLocale: OwnerLocale; agent: AgentName; content: MessageContent };

async function noticePreview(input: { dependencies: CoreDependencies; content: MessageContent; locale: OwnerLocale }): Promise<string> {
  const { content, locale } = input;
  if (content.kind !== MessageKind.Choice) return buildNoticePreview({ content, locale });
  const question = await input.dependencies.repository.findQuestion({ questionId: content.questionId });
  if (question === null) return buildNoticePreview({ content, locale });
  return buildNoticePreview({ content: { kind: MessageKind.Text, text: question.text }, locale });
}

async function releaseNotice(input: { dependencies: CoreDependencies; ownerLocale: OwnerLocale }): Promise<void> {
  const { repository, clock } = input.dependencies;
  const window = await repository.findWindow();
  const retryDelayMs = Math.min(NOTICE_RETRY_MS * NOTICE_RETRY_BACKOFF_FACTOR ** window.noticeRetryAttempt, NOTICE_RETRY_MAX_MS);
  await repository.saveWindow({
    window: {
      ...window,
      noticeSentForClosedWindow: false,
      noticeRetryLocale: input.ownerLocale,
      noticeRetryAt: clock.now() + retryDelayMs,
      noticeRetryAttempt: window.noticeRetryAttempt + 1,
    },
  });
}

async function resetNoticeAttempts(input: { dependencies: CoreDependencies }): Promise<void> {
  const { repository } = input.dependencies;
  const window = await repository.findWindow();
  const hasAttempts = window.noticeRetryAttempt > 0;
  if (!hasAttempts) return;
  await repository.saveWindow({ window: { ...window, noticeRetryAttempt: 0 } });
}

export async function sendNotice(input: SendNoticeInput): Promise<void> {
  const { dependencies, ownerLocale, agent, content } = input;
  const isNoticeOwner = await dependencies.repository.claimNotice();
  if (!isNoticeOwner) return;
  const preview = await noticePreview({ dependencies, content, locale: ownerLocale });
  const templateKind = content.kind === MessageKind.Choice ? TemplateKind.QuestionNotice : TemplateKind.Notice;
  try {
    await dependencies.sender.template({ kind: templateKind, locale: ownerLocale, parameters: [agent, preview] });
  } catch {
    await releaseNotice({ dependencies, ownerLocale });
    throw new NoticeFailedError({ templateKind });
  }
  await resetNoticeAttempts({ dependencies });
}
